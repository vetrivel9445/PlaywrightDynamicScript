import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Locator, Page } from '@playwright/test';

/** One or more file paths, resolved to absolute paths and validated. */
function normalizeFiles(files: string | string[]): string[] {
  const list = Array.isArray(files) ? files : [files];
  if (list.length === 0) {
    throw new Error('No file path provided to the upload helper.');
  }
  return list.map((f) => {
    const abs = resolve(f);
    if (!existsSync(abs)) {
      throw new Error(`Upload file not found: ${abs}`);
    }
    return abs;
  });
}

export interface UploadOptions {
  /**
   * How to find the file input. Any of these can be passed dynamically:
   *  - `input`: a CSS/text selector for an <input type="file"> (visible or hidden)
   *  - `locator`: a pre-built Playwright Locator
   *  - `trigger`: a selector/locator for the button/dropzone that opens the
   *               native file chooser (used for hidden inputs / custom widgets)
   */
  input?: string;
  locator?: Locator;
  trigger?: string | Locator;
  /** Max time (ms) to wait for the chooser / input. Defaults to 15s. */
  timeout?: number;
}

/**
 * Upload file(s) through any UI, driven entirely by runtime values.
 *
 * Handles the three common Salesforce / web upload patterns:
 *   1. A direct (possibly hidden) `<input type="file">`  -> setInputFiles
 *   2. A custom button/dropzone that opens the OS file chooser -> filechooser event
 *   3. Lightning `<lightning-file-upload>` (renders a hidden input) -> setInputFiles
 *
 * @example
 *   await uploadFiles(page, ['./data/report.pdf'], { input: 'input[type=file]' });
 *   await uploadFiles(page, file, { trigger: 'button:has-text("Upload Files")' });
 */
export async function uploadFiles(
  page: Page,
  files: string | string[],
  options: UploadOptions,
): Promise<void> {
  const paths = normalizeFiles(files);
  const timeout = options.timeout ?? 15_000;

  // Pattern 2: a trigger that opens the native file chooser.
  if (options.trigger) {
    const trigger =
      typeof options.trigger === 'string'
        ? page.locator(options.trigger)
        : options.trigger;
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout }),
      trigger.click(),
    ]);
    await chooser.setFiles(paths);
    return;
  }

  // Patterns 1 & 3: set files directly on an input element.
  const input =
    options.locator ??
    (options.input
      ? page.locator(options.input)
      : page.locator('input[type="file"]'));

  await input.waitFor({ state: 'attached', timeout });
  await input.setInputFiles(paths);
}

/**
 * Convenience wrapper for the standard Salesforce Lightning file upload
 * component. It renders a hidden `<input type="file">`, so we target that
 * directly rather than clicking the "Upload Files" button.
 *
 * @param accept Optional accept-filter narrowing (e.g. 'image/*') if multiple
 *               upload components exist on the page.
 */
export async function uploadToLightningFileUpload(
  page: Page,
  files: string | string[],
  accept?: string,
): Promise<void> {
  const selector = accept
    ? `lightning-file-upload input[type="file"][accept*="${accept}"]`
    : 'lightning-file-upload input[type="file"]';
  await uploadFiles(page, files, { input: selector });
}
