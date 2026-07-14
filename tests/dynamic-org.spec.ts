import { test, expect } from '@playwright/test';
import { openPage } from '../src/utils/navigation.js';
import { uploadFiles, uploadToLightningFileUpload } from '../src/utils/fileUpload.js';
import { env } from '../src/config/env.js';

/**
 * These tests start already authenticated against the default org connected to
 * VS Code (see globalSetup). Nothing below is hardcoded to a specific org —
 * URLs and file paths are all resolved dynamically at runtime.
 */
test.describe('Dynamic org session', () => {
  test('lands inside the org after frontdoor login', async ({ page }) => {
    await openPage(page, env.startPath);
    // We should be on a *.salesforce.com / *.force.com page, not the login form.
    expect(page.url()).not.toMatch(/\/login|\/secur\/login/i);
  });

  test('navigates to a dynamic page URL', async ({ page }) => {
    // env.startPath (SF_START_PATH) drives where we go — swap it per run.
    await openPage(page, env.startPath);
    await expect(page).toHaveTitle(/.+/);
  });

  test('uploads a file dynamically in the UI', async ({ page }) => {
    test.skip(
      env.uploadFilePaths.length === 0,
      'Set SF_UPLOAD_FILES to run the upload demo (e.g. SF_UPLOAD_FILES=./data/sample.pdf).',
    );

    // Example: navigate to a record/page that exposes an upload control, then
    // drive the upload with the runtime-provided file(s).
    await openPage(page, env.startPath);

    // Standard Lightning "Upload Files" component (hidden input under the hood).
    await uploadToLightningFileUpload(page, env.uploadFilePaths);

    // Generic fallback for any <input type="file"> or custom dropzone:
    // await uploadFiles(page, env.uploadFilePaths, {
    //   trigger: 'button:has-text("Upload Files")',
    // });
  });
});
