import { test, expect } from '@playwright/test';
import { getOrgAuthInfo, buildFrontdoorUrl } from '../../src/utils/orgAuth.js';
import { SfApi } from '../../src/utils/sfApi.js';
import { waitForLightning, openViaAppLauncher } from '../../src/utils/lightning.js';

async function login(page: import('@playwright/test').Page) {
  const auth = getOrgAuthInfo();
  await page.goto(buildFrontdoorUrl(auth, '/lightning/page/home'), {
    waitUntil: 'networkidle',
  });
}

test.describe('End-to-end: API test-data helper (SfApi)', () => {
  test('creates, queries, and deletes a record via the REST API', async () => {
    const api = new SfApi();

    const id = await api.createRecord('Invoice__c', { Name: 'INV-API-001' });
    expect(id).toMatch(/^[a-zA-Z0-9]{15,18}$/);

    const rows = await api.query<{ Id: string; Name: string }>(
      'SELECT Id, Name FROM Invoice__c',
    );
    expect(rows.some((r) => r.Id === id && r.Name === 'INV-API-001')).toBe(true);

    await api.deleteRecord('Invoice__c', id);
    const after = await api.query<{ Id: string }>('SELECT Id FROM Invoice__c');
    expect(after.some((r) => r.Id === id)).toBe(false);
  });
});

test.describe('End-to-end: Lightning helpers', () => {
  test('waitForLightning waits out the SLDS spinner', async ({ page }) => {
    await login(page); // the mock home shows a spinner for ~400ms
    await waitForLightning(page);
    await expect(page.locator('.slds-spinner')).toBeHidden();
  });

  test('navigates to an object via the App Launcher, by name', async ({ page }) => {
    await login(page);
    await openViaAppLauncher(page, 'Accounts');
    await expect(page).toHaveURL(/\/lightning\/o\/Account\/list/);
    await expect(page.locator('h1')).toHaveText('Account List');
  });

  test('App Launcher works for custom object tabs too', async ({ page }) => {
    await login(page);
    await openViaAppLauncher(page, 'Invoices');
    await expect(page).toHaveURL(/\/lightning\/o\/Invoice__c\/list/);
  });
});
