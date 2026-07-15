import { expect, type Locator, type Page } from '@playwright/test';
import { openPage } from '../utils/navigation.js';

/**
 * Field values for a record form. Strings fill text/textarea/picklist/lookup
 * fields; booleans toggle checkboxes.
 */
export type RecordFieldValues = Record<string, string | boolean>;

export interface SaveResult {
  /** The created/edited record id parsed from the resulting URL (if present). */
  recordId?: string;
  /** The full URL Playwright landed on after save. */
  url: string;
}

/**
 * Reusable page-object component for the Lightning "New Record" (and edit)
 * form of ANY object — standard (Account, Contact, ...) or custom (Invoice__c).
 *
 * Everything is dynamic:
 *   - the object API name is a constructor argument
 *   - fields are addressed by their visible label, with the control type
 *     (input / textarea / select / picklist-combobox / checkbox) auto-detected
 *   - the optional record-type chooser is handled automatically when it appears
 *   - save() verifies the success toast and returns the new record id
 *
 * @example
 *   const invoice = new RecordForm(page, 'Invoice__c');
 *   await invoice.openNew();
 *   await invoice.setFields({ Name: 'INV-001', Status: 'Draft', Paid__c: true });
 *   const { recordId } = await invoice.save();
 */
export class RecordForm {
  constructor(
    private readonly page: Page,
    /** Object API name, e.g. "Account" or "Invoice__c". */
    public readonly objectApiName: string,
  ) {}

  /** The container the form lives in: the Lightning modal when present, else the page. */
  private scope(): Locator {
    const modal = this.page.locator('.slds-modal, [role="dialog"]');
    return modal.or(this.page.locator('body')).first();
  }

  /**
   * Open the standard "new record" page for the object
   * (`/lightning/o/<Object>/new`) and, if the org shows a record-type chooser,
   * pick the requested type (or just continue with the default).
   */
  async openNew(recordType?: string): Promise<this> {
    await openPage(this.page, `/lightning/o/${this.objectApiName}/new`);
    await this.handleRecordTypeChooser(recordType);
    return this;
  }

  /**
   * Some orgs configure multiple record types, which inserts a
   * "New <Object>: select a record type" step before the form. Handle it when
   * it appears; do nothing when it doesn't — so the same test works in both orgs.
   */
  private async handleRecordTypeChooser(recordType?: string): Promise<void> {
    const next = this.page.getByRole('button', { name: /^Next$/i });
    const chooserVisible = await next
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (!chooserVisible) return;

    if (recordType) {
      await this.page
        .getByRole('radio', { name: recordType })
        .or(this.page.getByText(recordType, { exact: true }))
        .first()
        .click();
    }
    await next.click();
  }

  /**
   * Set a single field by its visible label. The control type is detected at
   * runtime, so the caller never has to know how the field is rendered:
   *   - checkbox            -> checked/unchecked from a boolean
   *   - <select>            -> selectOption by visible text
   *   - Lightning picklist  -> open the combobox, click the option
   *   - input / textarea    -> fill
   */
  async setField(label: string, value: string | boolean): Promise<this> {
    const field = this.scope().getByLabel(label, { exact: false }).first();
    await field.waitFor({ state: 'visible' });

    const kind = await field.evaluate((el) => {
      const tag = el.tagName.toLowerCase();
      const type = (el as HTMLInputElement).type?.toLowerCase?.() ?? '';
      const role = el.getAttribute('role') ?? '';
      if (type === 'checkbox') return 'checkbox';
      if (tag === 'select') return 'select';
      if (role === 'combobox' && tag !== 'input') return 'picklist';
      if (tag === 'input' && role === 'combobox' && (el as HTMLInputElement).readOnly)
        return 'picklist';
      return 'text';
    });

    switch (kind) {
      case 'checkbox':
        await field.setChecked(value === true || value === 'true');
        break;
      case 'select':
        await field.selectOption({ label: String(value) });
        break;
      case 'picklist': {
        await field.click();
        await this.page
          .getByRole('option', { name: String(value) })
          .first()
          .click();
        break;
      }
      default:
        await field.fill(String(value));
    }
    return this;
  }

  /** Set many fields at once, in order. */
  async setFields(fields: RecordFieldValues): Promise<this> {
    for (const [label, value] of Object.entries(fields)) {
      await this.setField(label, value);
    }
    return this;
  }

  /**
   * Click Save, assert the success toast, and wait for the record page.
   * Returns the created record's id parsed from the `/lightning/r/.../view` URL.
   *
   * @param toastText Text expected in the success toast. Defaults to
   *                  "was created" (Salesforce's standard wording).
   */
  async save(toastText: string | RegExp = /was (created|saved)/i): Promise<SaveResult> {
    await this.scope().getByRole('button', { name: /^Save$/i }).first().click();
    await this.expectToast(toastText);

    await this.page
      .waitForURL(/\/lightning\/r\/[^/]+\/[a-zA-Z0-9]{15,18}\/view/, { timeout: 15_000 })
      .catch(() => {
        /* Some flows stay on the same page (e.g. save & new) — id stays undefined. */
      });

    const url = this.page.url();
    const match = url.match(/\/lightning\/r\/[^/]+\/([a-zA-Z0-9]{15,18})\/view/);
    return { recordId: match?.[1], url };
  }

  /** Assert a toast notification containing the given text is shown. */
  async expectToast(text: string | RegExp): Promise<void> {
    const toast = this.page
      .locator('.slds-notify_toast, .slds-notify--toast, lightning-toast, [data-toast]')
      .first();
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toContainText(text);
  }
}
