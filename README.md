# Playwright Dynamic Org Login (Salesforce)

A Playwright + TypeScript framework that logs into the **default Salesforce org
connected to VS Code** — no hardcoded usernames, passwords, URLs, or file paths.
Everything the tests touch is resolved dynamically at runtime.

| Concern | How it stays dynamic |
| --- | --- |
| **Org login** | Reads the default org from the Salesforce CLI (`sf org display`) — the same org you set in VS Code — and logs in via `frontdoor.jsp` using the access token. No credentials are typed or stored. |
| **Page URLs** | `openPage(page, path)` resolves relative paths against the *current* org's instance URL — works for standard and custom objects alike. |
| **New record pages** | The `RecordForm` component fills any object's New Record form by field label, auto-detecting each control type, and verifies the save toast. |
| **UI file uploads** | `uploadFiles()` / `uploadToLightningFileUpload()` accept any file path(s) at runtime — hidden inputs, Lightning components, and native file-chooser dialogs. |
| **Test data** | `SfApi` creates/queries/deletes records of any object through the REST API with the same dynamic org token — fast setup and cleanup without UI clicks. |
| **In-app navigation** | `openViaAppLauncher(page, name)` opens any app or object tab by name, exactly like a user; `waitForLightning()` waits out SLDS spinners to kill flakiness. |

---

# 🚀 How to Use — Step by Step

Follow these steps in order. Each one tells you what to type and what you
should see. No prior Playwright knowledge needed.

## Step 1 — Get the project

```bash
git clone <this-repo-url>
cd <repo-folder>
```

**Prerequisites:** [Node.js 18+](https://nodejs.org) and the
[Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli)
(`sf --version` to check).

## Step 2 — Install

```bash
npm install
npx playwright install chromium
```

## Step 3 — Verify everything works (no Salesforce org needed)

```bash
npm run test:e2e
```

✅ **Expected: `13 passed`.** This runs the entire framework — login, dynamic
navigation, record creation, file upload, API data setup, and App Launcher
navigation — against a built-in mock org.
If this passes, your machine is set up correctly. If it fails, fix this before
going further (usually Node < 18 or the browser install).

## Step 4 — Connect your Salesforce org

If you already use Salesforce in VS Code, this is likely done. Otherwise:

```bash
sf org login web                              # a browser opens — log in
sf config set target-org=<username-or-alias>  # make it the default
```

Or inside VS Code: **Ctrl/Cmd+Shift+P → "SFDX: Authorize an Org"**, then
**"SFDX: Set a Default Org"**.

## Step 5 — Check which org the framework will use

```bash
npm run org:whoami
```

✅ **Expected:**

```
Resolved default org connected to VS Code:
  username:    you@yourcompany.com
  instanceUrl: https://yourdomain.my.salesforce.com
```

Wrong org? Run `sf config set target-org=<the-right-alias>` and check again.

## Step 6 — Run the tests against your org

```bash
npm test               # headless
npm run test:headed    # watch the browser while it runs
```

The framework logs in once (reusing your CLI session — no password typed),
caches the session, and every test starts already logged in.

## Step 7 — See the results

```bash
npm run report
```

Opens an HTML report with every step, timings, and screenshots on failure.

---

# 🧪 Run tests from VS Code, in Chrome — Step by Step

You can run and debug every test from inside VS Code with a real Chrome
window, without touching the terminal.

## Step 1 — Install the Playwright extension

1. Open VS Code in this project folder (`code .`).
2. Go to **Extensions** (Ctrl/Cmd+Shift+X).
3. Search for **"Playwright Test for VSCode"** (publisher: **Microsoft**) and
   click **Install**.

## Step 2 — Open the Testing panel

Click the **beaker icon** 🧪 in the left sidebar (or **View → Testing**).
All tests appear in a tree: `tests/` (your org tests) and `tests-e2e/`
(the mock-org suite).

> If the tree is empty, click the **refresh** icon at the top of the panel,
> and make sure `npm install` has been run.

## Step 3 — Choose which config to run

In the Testing panel, find the **Playwright** section (bottom of the sidebar):

- Under **PROJECTS**, tick **chromium**.
- If both configs are listed, pick `playwright.e2e.config.ts` to run against
  the mock org (no Salesforce needed) or `playwright.config.ts` for your real
  org (do Steps 4–5 of the setup above first).

## Step 4 — Make the browser visible (run in a Chrome window)

In the same Playwright section, tick **"Show browser"**.
Now every test run opens a real Chrome window you can watch.

> **Want your installed Google Chrome instead of Playwright's Chromium?**
> Run from the terminal with `PW_CHANNEL=chrome npm test` — the config picks
> it up automatically. (Chromium and Chrome behave identically for Salesforce.)

## Step 5 — Run a test

- Click the **▶ play button** next to any test, file, or folder in the tree.
- Or open a spec file — a green **▶** appears in the editor gutter next to
  each `test(...)`. Click it to run just that test.
- ✅ Pass = green check; ❌ fail = red cross with the error inline in the editor.

## Step 6 — Debug a test with breakpoints

1. Click in the gutter left of a line number to set a **red breakpoint dot**.
2. **Right-click** the test's ▶ button → **Debug Test**.
3. Chrome opens and pauses at your breakpoint — inspect variables, step
   through line by line (F10), and watch what the browser does at each step.

## Step 7 — Let VS Code find selectors for you

With the Playwright extension:

- **Pick locator**: click **"Pick locator"** in the Playwright section, then
  click any element in the open Chrome window — the best selector appears in
  VS Code. Copy it into your test.
- **Record new**: click **"Record new"** to open Chrome and click through your
  flow — Playwright *writes the test code for you* as you click. Great
  starting point; then swap in the framework helpers (`openPage`, `RecordForm`).

## Step 8 — See results and traces in VS Code

- Hover a failed test → **"Show trace"** opens the trace viewer with a
  filmstrip of every step.
- The **Test Results** panel (bottom) shows the full error and console output.

---

# ✍️ Write your own test

Create a file in `tests/`, e.g. `tests/my-test.spec.ts`, then use the building
blocks below. Run with `npm test` or the ▶ button in VS Code.

### Open any page — standard or custom object

```ts
import { test } from '@playwright/test';
import { openPage } from '../src/utils/navigation.js';

test('open pages', async ({ page }) => {
  await openPage(page, '/lightning/o/Account/list');     // standard object
  await openPage(page, '/lightning/o/Invoice__c/list');  // custom object (__c)
});
```

💡 Paste any path from your org's address bar (everything after `.com`) — it
works against whichever org is connected.

### Create a record — any object, by field label

```ts
import { RecordForm } from '../src/pages/recordForm.js';

test('create an invoice', async ({ page }) => {
  const invoice = new RecordForm(page, 'Invoice__c');  // 1. name the object
  await invoice.openNew();                             // 2. open the New form
  await invoice.setFields({                            // 3. fill by LABEL
    Name: 'INV-001',
    Status: 'Draft',       // picklist: just the option text
    Paid: true,            // checkbox: true/false
  });
  const { recordId } = await invoice.save();           // 4. save + toast checked
});
```

The component auto-detects each field's control type (text, picklist,
checkbox, …) and handles the record-type chooser if your org shows one.

### Upload a file — any widget, any file

```ts
import { uploadFiles, uploadToLightningFileUpload } from '../src/utils/fileUpload.js';

// Standard Lightning "Upload Files" component:
await uploadToLightningFileUpload(page, './data/contract.pdf');

// A custom button/dropzone that opens the OS file picker:
await uploadFiles(page, './data/contract.pdf', {
  trigger: 'button:has-text("Upload Files")',
});
```

### Set up test data via the API — no UI clicks

```ts
import { SfApi } from '../src/utils/sfApi.js';

test('UI shows a record created via API', async ({ page }) => {
  const api = new SfApi();                       // same dynamic org token
  const id = await api.createRecord('Invoice__c', { Name: 'INV-999' });

  await openPage(page, `/lightning/r/Invoice__c/${id}/view`);
  // ... UI assertions ...

  await api.deleteRecord('Invoice__c', id);      // clean up
});
```

This is the fastest pattern for Salesforce testing: **create data via API,
verify via UI, clean up via API** — no slow, flaky UI data entry.

### Navigate like a user — App Launcher + Lightning waits

```ts
import { openViaAppLauncher, waitForLightning } from '../src/utils/lightning.js';

test('open a tab by name', async ({ page }) => {
  await openViaAppLauncher(page, 'Invoices');   // any app or object tab, by name
  await waitForLightning(page);                 // spinners are gone — safe to act
});
```

### Change org / page / files per run — no code edits

```bash
SF_TARGET_ORG=my-sandbox npm test               # different org
SF_START_PATH=/lightning/o/Case/list npm test   # different landing page
SF_UPLOAD_FILES=./data/other.pdf npm test       # different upload file
```

(Or copy `.env.example` to `.env` and set them there.)

---

# 📋 Quick command reference

| I want to… | Command |
| --- | --- |
| Check everything works (no org) | `npm run test:e2e` |
| See which org will be used | `npm run org:whoami` |
| Run tests against my org | `npm test` |
| Watch the browser while it runs | `npm run test:headed` |
| Debug a test step by step | `npm run test:debug` |
| Open the results report | `npm run report` |

# 🔧 If something goes wrong

| You see… | Do this |
| --- | --- |
| `Could not run the Salesforce CLI` | Install the `sf` CLI and reopen your terminal. |
| `no active session` | Run `sf org login web` and log in again. |
| Wrong org in `org:whoami` | `sf config set target-org=<alias>` |
| Login page appears mid-test | Delete `.auth/org-session.json` and re-run. |
| A field isn't found by `setFields` | Use the exact label shown on screen. |
| `Upload file not found` | Path is relative to the project folder — check it exists. |

Full debugging walkthrough (Inspector, locator picker, trace viewer,
Salesforce-specific gotchas): **[USER_GUIDE.md](./USER_GUIDE.md)**.
Deeper setup, CI, and configuration: **[GUIDE.md](./GUIDE.md)**.

---

# Configuration (all optional, via `.env` or shell)

| Variable | Purpose | Default |
| --- | --- | --- |
| `SF_TARGET_ORG` | Org username/alias override | default org in VS Code |
| `SF_START_PATH` | Dynamic landing page | `/lightning/page/home` |
| `SF_UPLOAD_FILES` | Comma-separated upload file paths | _(none)_ |
| `SF_STORAGE_STATE` | Cached session location | `.auth/org-session.json` |
| `SF_INSTANCE_URL` | Fallback base URL if CLI is unavailable | _(none)_ |
| `PW_EXECUTABLE_PATH` | Use a system-provided Chromium (CI) | _(none)_ |

# Project layout

```
playwright.config.ts        # dynamic baseURL + cached session (live-org tests)
playwright.e2e.config.ts    # self-contained suite vs. built-in mock org
src/
  config/env.ts             # runtime-configurable values + URL resolver
  pages/recordForm.ts       # RecordForm component (new record page)
  utils/
    orgAuth.ts              # reads default org from SF CLI, builds frontdoor URL
    globalSetup.ts          # one-time frontdoor login -> storageState
    navigation.ts           # openPage() dynamic URL navigation
    fileUpload.ts           # dynamic UI file-upload helpers
    sfApi.ts                # REST API test-data helper (create/query/delete)
    lightning.ts            # App Launcher navigation + spinner waits
  scripts/whoami.ts         # prints the resolved org
tests/                      # your live-org tests
tests-e2e/                  # mock org + mock CLI + 13 self-contained E2E tests
USER_GUIDE.md               # hands-on user guide + debugging walkthrough
GUIDE.md                    # project adoption, CI, configuration deep-dive
```

# References

Patterns in this framework draw on the community's Salesforce automation work:
[Salesforce's UI test automation guidance](https://developer.salesforce.com/blogs/2020/01/ui-test-automation-on-salesforce),
[krutiunnithan/playwright-automation-framework](https://github.com/krutiunnithan/playwright-automation-framework)
(API-based test data + fixtures),
[TestLeafInc/playwright-salesforce](https://github.com/TestLeafInc/playwright-salesforce)
(UI/API bridge, auto-login), and
[foleyautomated/playwright-for-salesforce](https://github.com/foleyautomated/playwright-for-salesforce)
(VS Code workflow).
