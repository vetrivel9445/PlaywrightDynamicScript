import { test, expect } from '@playwright/test';
import { openPage } from '../src/utils/navigation.js';
import { uploadFiles } from '../src/utils/fileUpload.js';
import { loadMappings } from '../src/utils/mappingSheet.js';

/**
 * Data-driven tests against YOUR org, generated from test-mappings.csv rows
 * whose suite is "live". Add/edit rows in the sheet (it opens in Excel) —
 * no code changes needed:
 *
 *   - name an `object`      -> the URL is auto-mapped to its list view
 *   - or set a `page_path`  -> any explicit page
 *   - set `upload_file`     -> the file is uploaded on that page
 */
const mappings = loadMappings('live');

test.describe('Data-driven from mapping sheet (live org) @sheet', () => {
  test.skip(
    mappings.length === 0,
    'No live rows in test-mappings.csv — add rows with suite=live to generate tests.',
  );

  for (const row of mappings) {
    test(`${row.testName} @sheet`, async ({ page }) => {
      await openPage(page, row.pagePath);
      // Whatever the page, we must still be inside the org — not bounced to login.
      expect(page.url()).not.toMatch(/\/login|\/secur\/login/i);

      if (row.expectHeading) {
        await expect(page.locator('h1').first()).toContainText(row.expectHeading);
      }

      if (row.uploadFile) {
        await uploadFiles(page, row.uploadFile, { input: 'input[type="file"]' });
      }
    });
  }
});
