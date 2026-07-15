# Step-by-Step Guide — Dynamic Org Login for Any Project

> 👋 New user? [`USER_GUIDE.md`](./USER_GUIDE.md) is the friendlier hands-on
> walkthrough of the same steps, with copy-paste examples for every helper.
> This document goes deeper: project adoption, CI, and configuration.

This framework is **project-agnostic**. Nothing is hardcoded to one org, one
page, or one file, so you can drop it into any Salesforce project and point it
at whatever org, pages, and uploads that project needs. This guide walks you
from zero to a passing test.

There are two testing modes, and you'll use both:

| Mode | Command | Needs a real org? | Purpose |
| --- | --- | --- | --- |
| **Self-contained E2E** | `npm run test:e2e` | ❌ No | Proves the framework works anywhere (CI, laptop, review) against a mock org + mock CLI. |
| **Live org tests** | `npm test` | ✅ Yes | Runs your real tests against the default org connected to VS Code. |

---

## Part A — One-time setup (any project)

### Step 1. Install prerequisites
- **Node.js 18+** — check with `node -v`.
- **Salesforce CLI** — `sf --version`. Install from
  <https://developer.salesforce.com/tools/salesforcecli> if missing.
  (The legacy `sfdx` CLI also works; the framework auto-detects it.)

### Step 2. Add the framework to your project
Copy these into your project root (or clone this repo as a starting point):
```
playwright.config.ts
playwright.e2e.config.ts
tsconfig.json
package.json          # merge the scripts + devDependencies if you already have one
src/                  # the reusable helpers
tests/                # your live-org tests
tests-e2e/            # the self-contained mock suite
.env.example
```

### Step 3. Install dependencies
```bash
npm install
npx playwright install chromium
```

### Step 4. Verify it works WITHOUT an org (do this first)
```bash
npm run test:e2e
```
Expected: **6 passed**. This confirms login, dynamic navigation, and dynamic
uploads all work before you touch a real org. If this passes, the framework is
healthy — any later failure is about your org or your selectors, not the setup.

---

## Part B — Connect your org (per project / per machine)

### Step 5. Authorize and set the default org in VS Code
```bash
sf org login web                              # opens a browser to log in
sf config set target-org=<username-or-alias>  # make it the default
```
Or in VS Code: **Command Palette → “SFDX: Authorize an Org”**, then
**“SFDX: Set a Default Org.”**

### Step 6. Confirm the framework sees your org
```bash
npm run org:whoami
```
It prints the resolved username and instance URL. If it errors, your org isn’t
connected — repeat Step 5.

### Step 7. (Optional) Set project-specific dynamic values
Copy `.env.example` to `.env` and edit:
```bash
SF_TARGET_ORG=            # blank = default org; or an alias to override
SF_START_PATH=/lightning/page/home     # the page your tests should open
SF_UPLOAD_FILES=./data/sample.pdf      # file(s) for the upload demo
```
Every value is optional and can also be passed as a shell variable per run.

---

## Part C — Run against your real org

### Step 8. Run the live tests
```bash
npm test                # headless
npm run test:headed     # watch the browser
npm run report          # open the HTML report
```
On the first run, the framework logs in once via `frontdoor.jsp` and caches the
session to `.auth/org-session.json`; every test reuses it.

---

## Part D — Adapt it to YOUR project

The three helpers are the building blocks. Use them in any test:

### Dynamic navigation — go to any page
```ts
import { openPage } from '../src/utils/navigation.js';

await openPage(page, '/lightning/o/Account/list');        // list view
await openPage(page, '/lightning/r/Account/001.../view'); // record page
await openPage(page, '/apex/MyVisualforcePage');          // Visualforce
```
Paths are resolved against whatever org is live, so the same test runs against a
sandbox, scratch org, or production without edits.

### Dynamic file upload — upload any file, any widget
```ts
import { uploadFiles, uploadToLightningFileUpload } from '../src/utils/fileUpload.js';

// Standard Lightning "Upload Files" component:
await uploadToLightningFileUpload(page, './data/contract.pdf');

// A custom button/dropzone that opens the OS file chooser:
await uploadFiles(page, ['./data/a.png', './data/b.png'], {
  trigger: 'button:has-text("Upload Files")',
});

// A specific (even hidden) <input type="file">:
await uploadFiles(page, './data/logo.png', { input: 'input[type="file"]' });
```

### New record page — use the `RecordForm` component
Don't script the new-record modal by hand — use the reusable component. It
works for **any object, standard or custom**, auto-detects each field's control
type from its label, handles the record-type chooser when the org has one, and
verifies the success toast on save:

```ts
import { RecordForm } from '../src/pages/recordForm.js';

// Standard object
const account = new RecordForm(page, 'Account');
await account.openNew();
await account.setFields({ Name: 'Acme Corp', Active: true });
const { recordId } = await account.save();

// Custom object — same component, just the API name changes
const invoice = new RecordForm(page, 'Invoice__c');
await invoice.openNew('Sales Invoice');       // record type, if your org asks
await invoice.setFields({ Name: 'INV-001', Status: 'Draft' });
await invoice.save();
```

`setField(label, value)` detects checkboxes, `<select>`s, Lightning picklist
comboboxes, and plain inputs/textareas at runtime, so the caller never needs to
know how a field is rendered. `save()` returns the created record's id parsed
from the resulting `/lightning/r/.../view` URL.

### Dynamic org selection — target a specific org in one test
```ts
import { getOrgAuthInfo } from '../src/utils/orgAuth.js';
const auth = getOrgAuthInfo('my-sandbox-alias'); // overrides the default org
```

---

## Part E — Add your own end-to-end tests

Put live-org specs in `tests/`. A typical test:
```ts
import { test, expect } from '@playwright/test';
import { openPage } from '../src/utils/navigation.js';
import { uploadToLightningFileUpload } from '../src/utils/fileUpload.js';

test('attach a file to an Account', async ({ page }) => {
  await openPage(page, '/lightning/o/Account/list');
  await page.getByRole('link', { name: 'Acme' }).click();
  await page.getByRole('button', { name: 'Upload Files' }).first().click();
  await uploadToLightningFileUpload(page, './data/contract.pdf');
  await expect(page.getByText('contract.pdf')).toBeVisible();
});
```

---

## Part F — Run it in CI (no real org needed)

The self-contained E2E suite runs anywhere. Minimal GitHub Actions step:
```yaml
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: npm run test:e2e
```
If your CI image already ships a Chromium, point at it instead of downloading:
```yaml
- run: PW_EXECUTABLE_PATH=/path/to/chrome npm run test:e2e
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Could not run the Salesforce CLI` | Install `sf`/`sfdx` and ensure it’s on `PATH`. |
| `no active session` / redirected to login | Session expired — `sf org login web` again. |
| `org:whoami` shows the wrong org | `sf config set target-org=<alias>` or set `SF_TARGET_ORG`. |
| Upload does nothing | Confirm the selector; try the `trigger:` (file-chooser) form for custom widgets. |
| Browser won’t launch in CI | `npx playwright install --with-deps chromium`, or set `PW_EXECUTABLE_PATH`. |
| `Upload file not found` | The path is resolved from the working directory — use a path that exists. |
