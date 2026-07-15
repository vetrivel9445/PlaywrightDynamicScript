import { test, expect } from '@playwright/test';
import { getOrgAuthInfo, buildFrontdoorUrl } from '../../src/utils/orgAuth.js';
import { RecordForm } from '../../src/pages/recordForm.js';

/**
 * End-to-end verification of the RecordForm component (new record page) —
 * same component, driven with a standard and a custom object API name, to
 * prove nothing in it is object-specific.
 */
async function login(page: import('@playwright/test').Page) {
  const auth = getOrgAuthInfo();
  await page.goto(buildFrontdoorUrl(auth, '/lightning/page/home'), {
    waitUntil: 'networkidle',
  });
}

test.describe('End-to-end: RecordForm (new record page)', () => {
  test('creates a STANDARD object record (Account)', async ({ page }) => {
    await login(page);

    const account = new RecordForm(page, 'Account');
    await account.openNew();
    await account.setFields({
      Name: 'Acme Corp',
      Description: 'Created by e2e',
      Stage: 'Open',
      Active: true,
    });
    const { recordId, url } = await account.save();

    expect(recordId).toBe('a01000000000001AAA');
    expect(url).toContain('/lightning/r/Account/');
    await expect(page.locator('#stage')).toHaveText('Open');
    await expect(page.locator('#active')).toHaveText('true');
  });

  test('creates a CUSTOM object record (Invoice__c) with the same component', async ({
    page,
  }) => {
    await login(page);

    const invoice = new RecordForm(page, 'Invoice__c');
    await invoice.openNew();
    await invoice.setFields({ Name: 'INV-001', Stage: 'Draft' });
    const { recordId, url } = await invoice.save();

    expect(recordId).toBeTruthy();
    expect(url).toContain('/lightning/r/Invoice__c/');
    await expect(page.locator('h1')).toHaveText('INV-001');
  });

  test('save() surfaces the success toast', async ({ page }) => {
    await login(page);

    const form = new RecordForm(page, 'Project__c');
    await form.openNew();
    await form.setField('Name', 'Apollo');
    await form.save(/was created/);
    await expect(page.locator('[data-toast]')).toContainText('Apollo');
  });
});
