import type { Page } from '@playwright/test';

/**
 * Wait for Lightning to settle: the page is loaded and no SLDS spinner is
 * spinning. Call this after navigation or actions that trigger re-renders —
 * it removes the most common source of flaky Salesforce tests.
 */
export async function waitForLightning(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const spinner = page.locator('.slds-spinner, lightning-spinner').first();
  // "hidden" also covers "never appeared", so this is safe on spinner-less pages.
  await spinner.waitFor({ state: 'hidden', timeout }).catch(() => {
    /* a stuck spinner shouldn't hard-fail the wait — the next assertion will */
  });
}

/**
 * Navigate the way a user does: open the App Launcher (the 3x3 grid), search
 * for an app or item by name, and open it. Fully dynamic — works for any app,
 * standard object, or custom object tab without knowing its URL.
 *
 * @example
 *   await openViaAppLauncher(page, 'Sales');       // an app
 *   await openViaAppLauncher(page, 'Invoices');    // a custom object tab
 */
export async function openViaAppLauncher(page: Page, itemName: string): Promise<void> {
  await waitForLightning(page);
  await page
    .getByRole('button', { name: /app launcher/i })
    .or(page.locator('button[title="App Launcher"], .slds-icon-waffle'))
    .first()
    .click();

  const search = page
    .getByPlaceholder(/search apps/i)
    .or(page.getByRole('combobox', { name: /search/i }))
    .first();
  await search.fill(itemName);

  await page
    .getByRole('option', { name: itemName })
    .or(page.getByRole('link', { name: itemName }))
    .first()
    .click();

  await waitForLightning(page);
}
