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

✅ **Expected: `9 passed`.** This runs the entire framework — login, dynamic
navigation, record creation, and file upload — against a built-in mock org.
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

# ✍️ Step 8 — Write your own test

Create a file in `tests/`, e.g. `tests/my-test.spec.ts`, then use the building
blocks below. Run with `npm test`.

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
  scripts/whoami.ts         # prints the resolved org
tests/                      # your live-org tests
tests-e2e/                  # mock org + mock CLI + 9 self-contained E2E tests
USER_GUIDE.md               # hands-on user guide + debugging walkthrough
GUIDE.md                    # project adoption, CI, configuration deep-dive
```
