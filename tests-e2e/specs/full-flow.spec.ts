import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOrgAuthInfo, buildFrontdoorUrl } from '../../src/utils/orgAuth.js';
import { openPage } from '../../src/utils/navigation.js';
import { uploadFiles, uploadToLightningFileUpload } from '../../src/utils/fileUpload.js';

/**
 * Full end-to-end verification of the framework using the mock org.
 * These exercise the exact production helpers — nothing is stubbed except the
 * org itself (mock server) and the CLI (mock `sf`).
 */
const dir = path.dirname(fileURLToPath(import.meta.url));
const sampleFile = path.join(dir, '..', 'fixtures', 'sample.pdf');

async function login(page: import('@playwright/test').Page, startPath?: string) {
  const auth = getOrgAuthInfo(); // reads the (mock) default org from the CLI
  await page.goto(buildFrontdoorUrl(auth, startPath), { waitUntil: 'networkidle' });
}

test.describe('End-to-end: dynamic org login', () => {
  test('resolves the default org from the CLI', async () => {
    const auth = getOrgAuthInfo();
    expect(auth.instanceUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(auth.accessToken).toBeTruthy();
    expect(auth.username).toBe('e2e@mock.org.example');
  });

  test('logs in via frontdoor and lands inside the org', async ({ page }) => {
    await login(page, '/lightning/page/home');
    await expect(page.locator('h1')).toHaveText('Home');
    expect(page.url()).not.toMatch(/frontdoor|\/secur\/login/);
  });
});

test.describe('End-to-end: dynamic page navigation', () => {
  test('navigates to a dynamic relative path', async ({ page }) => {
    await login(page);
    await openPage(page, '/lightning/upload');
    await expect(page.locator('h1')).toHaveText('Upload');
  });
});

test.describe('End-to-end: dynamic UI file upload', () => {
  test('uploads via the Lightning file-upload component (hidden input)', async ({ page }) => {
    await login(page);
    await openPage(page, '/lightning/upload');
    await uploadToLightningFileUpload(page, sampleFile);
    await expect(page.locator('#status')).toContainText('sample.pdf');
  });

  test('uploads via a button that opens the native file chooser', async ({ page }) => {
    await login(page);
    await openPage(page, '/lightning/upload');
    await uploadFiles(page, [sampleFile], { trigger: '#btn' });
    await expect(page.locator('#status')).toContainText('sample.pdf');
  });

  test('rejects a missing file with a clear error', async ({ page }) => {
    await login(page);
    await openPage(page, '/lightning/upload');
    await expect(
      uploadFiles(page, './does/not/exist.pdf', { input: '#lfu' }),
    ).rejects.toThrow(/Upload file not found/);
  });
});
