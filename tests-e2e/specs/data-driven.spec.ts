import { test, expect } from '@playwright/test';
import path from 'node:path';
import { getOrgAuthInfo, buildFrontdoorUrl } from '../../src/utils/orgAuth.js';
import { openPage } from '../../src/utils/navigation.js';
import { uploadFiles } from '../../src/utils/fileUpload.js';
import { loadMappings } from '../../src/utils/mappingSheet.js';

/**
 * Data-driven UI tests, NPSP/Robot-Framework style: one test is GENERATED per
 * row of test-mappings.csv. URLs are auto-mapped from object names (or taken
 * from the sheet), and upload files come from the sheet too — no code changes
 * needed to add a test.
 */
const mappings = loadMappings('mock');

async function login(page: import('@playwright/test').Page) {
  const auth = getOrgAuthInfo();
  await page.goto(buildFrontdoorUrl(auth, '/lightning/page/home'), {
    waitUntil: 'networkidle',
  });
}

test.describe('Data-driven from mapping sheet @sheet', () => {
  test('the mapping sheet has runnable rows', async () => {
    expect(mappings.length).toBeGreaterThan(0);
  });

  for (const row of mappings) {
    test(`${row.testName} @sheet`, async ({ page }) => {
      await login(page);

      // 1. Dynamic URL — auto-mapped from the object, or from the sheet.
      await openPage(page, row.pagePath);
      expect(page.url()).toContain(row.pagePath);

      // 2. Optional heading assertion from the sheet.
      if (row.expectHeading) {
        await expect(page.locator('h1')).toHaveText(row.expectHeading);
      }

      // 3. Optional dynamic file upload from the sheet.
      if (row.uploadFile) {
        await uploadFiles(page, row.uploadFile, { input: 'input[type="file"]' });
        await expect(page.locator('#status')).toContainText(
          path.basename(row.uploadFile),
        );
      }
    });
  }
});
