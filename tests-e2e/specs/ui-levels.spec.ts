import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOrgAuthInfo, buildFrontdoorUrl } from '../../src/utils/orgAuth.js';
import { openPage } from '../../src/utils/navigation.js';
import { RecordForm } from '../../src/pages/recordForm.js';
import { uploadToLightningFileUpload } from '../../src/utils/fileUpload.js';
import { SfApi } from '../../src/utils/sfApi.js';
import { openViaAppLauncher, waitForLightning } from '../../src/utils/lightning.js';

/**
 * The full UI test pyramid, run dynamically against the mock org. Every level
 * is tagged so it can be run on its own:
 *
 *   npx playwright test --config=playwright.e2e.config.ts --grep @smoke
 *   ... @functional | @negative | @a11y | @responsive | @visual
 */
const dir = path.dirname(fileURLToPath(import.meta.url));
const sampleFile = path.join(dir, '..', 'fixtures', 'sample.pdf');

async function login(page: import('@playwright/test').Page) {
  const auth = getOrgAuthInfo();
  await page.goto(buildFrontdoorUrl(auth, '/lightning/page/home'), {
    waitUntil: 'networkidle',
  });
}

/* ------------------------------------------------------------------ */
/* LEVEL 1 — Smoke: is every key page alive?                           */
/* ------------------------------------------------------------------ */
test.describe('L1 Smoke @smoke', () => {
  // Pages generated dynamically — add a path here and it becomes a test.
  const pages = [
    { path: '/lightning/page/home', heading: 'Home' },
    { path: '/lightning/o/Account/list', heading: 'Account List' },
    { path: '/lightning/o/Invoice__c/new', heading: 'New Invoice__c' },
    { path: '/lightning/upload', heading: 'Upload' },
  ];

  for (const p of pages) {
    test(`page ${p.path} loads @smoke`, async ({ page }) => {
      await login(page);
      await openPage(page, p.path);
      await expect(page.locator('h1')).toHaveText(p.heading);
    });
  }
});

/* ------------------------------------------------------------------ */
/* LEVEL 2 — Functional: a complete user journey                       */
/* ------------------------------------------------------------------ */
test.describe('L2 Functional @functional', () => {
  test('full journey: API data -> navigate -> create -> upload -> cleanup', async ({
    page,
  }) => {
    // 1. Seed data through the API (fast, no UI)
    const api = new SfApi();
    const seededId = await api.createRecord('Invoice__c', { Name: 'INV-SEED' });

    // 2. Log in and navigate like a user
    await login(page);
    await openViaAppLauncher(page, 'Invoices');
    await expect(page).toHaveURL(/Invoice__c\/list/);

    // 3. Create a record through the UI
    const form = new RecordForm(page, 'Invoice__c');
    await form.openNew();
    await form.setFields({ Name: 'INV-UI-01', Stage: 'Open', Active: true });
    const { recordId } = await form.save();
    expect(recordId).toBeTruthy();

    // 4. Upload a file through the UI
    await openPage(page, '/lightning/upload');
    await uploadToLightningFileUpload(page, sampleFile);
    await expect(page.locator('#status')).toContainText('sample.pdf');

    // 5. Clean up the seeded data via the API
    await api.deleteRecord('Invoice__c', seededId);
  });
});

/* ------------------------------------------------------------------ */
/* LEVEL 3 — Negative & validation                                     */
/* ------------------------------------------------------------------ */
test.describe('L3 Negative & validation @negative', () => {
  test('required-field validation blocks save @negative', async ({ page }) => {
    await login(page);
    const form = new RecordForm(page, 'Invoice__c');
    await form.openNew();
    // Save with Name empty — must stay on the form and show the error.
    await page.getByRole('button', { name: /^Save$/i }).click();
    await expect(page.getByRole('alert')).toHaveText(/Name is required/);
    await expect(page).toHaveURL(/\/Invoice__c\/new/);
  });

  test('unauthenticated access redirects to login @negative', async ({ page }) => {
    // No login() — a fresh context has no session cookie.
    await page.goto('/lightning/page/home');
    await expect(page).toHaveURL(/\/secur\/login/);
    await expect(page.locator('h1')).toHaveText('Login');
  });

  test('frontdoor without a token is rejected @negative', async ({ page }) => {
    const res = await page.request.get('/secur/frontdoor.jsp');
    expect(res.status()).toBe(401);
  });

  test('REST API rejects an invalid token @negative', async ({ page }) => {
    const res = await page.request.get(
      '/services/data/v62.0/query?q=SELECT Id FROM Invoice__c',
      { headers: { Authorization: 'Bearer WRONG_TOKEN' } },
    );
    expect(res.status()).toBe(401);
    const body = (await res.json()) as Array<{ errorCode: string }>;
    expect(body[0].errorCode).toBe('INVALID_SESSION_ID');
  });
});

/* ------------------------------------------------------------------ */
/* LEVEL 4 — Accessibility                                             */
/* ------------------------------------------------------------------ */
test.describe('L4 Accessibility @a11y', () => {
  test('every form control has an associated label @a11y', async ({ page }) => {
    await login(page);
    await openPage(page, '/lightning/o/Invoice__c/new');

    const controls = page.locator('form input, form textarea, form select');
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const id = await controls.nth(i).getAttribute('id');
      expect(id, 'form control must have an id for its label').toBeTruthy();
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
    await expect(page.getByRole('button', { name: /^Save$/i })).toBeVisible();
  });

  test('record can be saved with the keyboard @a11y', async ({ page }) => {
    await login(page);
    const form = new RecordForm(page, 'Invoice__c');
    await form.openNew();
    await form.setField('Name', 'INV-KEYBOARD');
    await page.getByRole('button', { name: /^Save$/i }).focus();
    await page.keyboard.press('Enter');
    await form.expectToast(/was created/);
  });
});

/* ------------------------------------------------------------------ */
/* LEVEL 5 — Responsive: same flows on other viewports                 */
/* ------------------------------------------------------------------ */
test.describe('L5 Responsive @responsive', () => {
  const viewports = [
    { name: 'mobile (iPhone 14)', width: 390, height: 844 },
    { name: 'tablet (iPad Air)', width: 820, height: 1180 },
  ];

  for (const vp of viewports) {
    test(`record creation works on ${vp.name} @responsive`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await login(page);
      const form = new RecordForm(page, 'Invoice__c');
      await form.openNew();
      await form.setFields({ Name: `INV-${vp.width}px` });
      const { recordId } = await form.save();
      expect(recordId).toBeTruthy();
    });
  }
});

/* ------------------------------------------------------------------ */
/* LEVEL 6 — Visual regression (opt-in: VISUAL_TESTS=1)                */
/* ------------------------------------------------------------------ */
test.describe('L6 Visual regression @visual', () => {
  // Screenshot baselines are rendering-environment-specific, so this level is
  // opt-in. First run: add --update-snapshots to record the baselines.
  test.skip(
    !process.env.VISUAL_TESTS,
    'Set VISUAL_TESTS=1 to run visual regression (record baselines with --update-snapshots).',
  );

  test('new record form matches the baseline @visual', async ({ page }) => {
    await login(page);
    await openPage(page, '/lightning/o/Invoice__c/new');
    await waitForLightning(page);
    await expect(page).toHaveScreenshot('record-form.png', { fullPage: true });
  });

  test('upload page matches the baseline @visual', async ({ page }) => {
    await login(page);
    await openPage(page, '/lightning/upload');
    await waitForLightning(page);
    await expect(page).toHaveScreenshot('upload-page.png', { fullPage: true });
  });
});
