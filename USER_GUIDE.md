# User Guide — How to Use This Framework (Step by Step)

This guide is for anyone using the framework for the first time. Follow the
steps in order — each step tells you exactly what to type and what you should
see. No prior Playwright knowledge is needed.

> Looking for CI setup, environment variables, or troubleshooting details?
> See [`GUIDE.md`](./GUIDE.md). This document is the hands-on walkthrough.

---

## STEP 1 — Get the project onto your machine

```bash
git clone <this-repo-url>
cd <repo-folder>
```

## STEP 2 — Install everything

```bash
npm install
npx playwright install chromium
```

**What you should see:** npm finishes without errors, and Playwright downloads
a Chromium browser.

## STEP 3 — Prove the framework works (no Salesforce org needed yet)

```bash
npm run test:e2e
```

**What you should see:** `9 passed`. This runs the whole framework — login,
page navigation, file upload, and record creation — against a built-in mock
org. If this passes, your machine is set up correctly.

> ❗ If this step fails, nothing later will work — fix this first
> (usually it's Node < 18 or the browser install; see GUIDE.md troubleshooting).

## STEP 4 — Connect your Salesforce org (the one in VS Code)

If you already use Salesforce in VS Code, you likely have this done. Otherwise:

```bash
sf org login web                              # a browser opens — log in to your org
sf config set target-org=<username-or-alias>  # make it the default
```

Or inside VS Code: **Ctrl/Cmd+Shift+P → "SFDX: Authorize an Org"**, then
**"SFDX: Set a Default Org"**.

## STEP 5 — Check which org the framework will use

```bash
npm run org:whoami
```

**What you should see:**

```
Resolved default org connected to VS Code:
  username:    you@yourcompany.com
  instanceUrl: https://yourdomain.my.salesforce.com
```

If this shows the wrong org, run `sf config set target-org=<the-right-alias>`.

## STEP 6 — Run the tests against your real org

```bash
npm test               # runs headless (no visible browser)
npm run test:headed    # runs with a visible browser so you can watch
```

**What happens behind the scenes:** the framework logs into your default org
once (no password typed — it reuses your CLI session), saves the session, and
every test starts already logged in.

## STEP 7 — See the results

```bash
npm run report
```

Opens an HTML report in your browser with every step, screenshot on failure,
and timings.

---

# Using the framework in your own tests

Create a file in `tests/`, e.g. `tests/my-first-test.spec.ts`, and use the
building blocks below. Run it with `npm test`.

## A. Open any page (standard or custom object)

```ts
import { test, expect } from '@playwright/test';
import { openPage } from '../src/utils/navigation.js';

test('open pages', async ({ page }) => {
  await openPage(page, '/lightning/o/Account/list');     // standard object list
  await openPage(page, '/lightning/o/Invoice__c/list');  // custom object list (__c)
  await openPage(page, '/lightning/page/home');          // home
});
```

**Rule of thumb:** paste any path from your org's address bar (everything after
`.com`) — it works against whichever org is connected.

## B. Create a record (the `RecordForm` component)

```ts
import { RecordForm } from '../src/pages/recordForm.js';

test('create an invoice', async ({ page }) => {
  const invoice = new RecordForm(page, 'Invoice__c');  // 1. name the object
  await invoice.openNew();                             // 2. open the New form
  await invoice.setFields({                            // 3. fill by field LABEL
    Name: 'INV-001',
    Status: 'Draft',      // picklists: just give the option text
    Paid: true,           // checkboxes: true/false
  });
  const { recordId } = await invoice.save();           // 4. save + toast checked
  console.log('Created record:', recordId);
});
```

Step-by-step what each call does:

1. `new RecordForm(page, 'X')` — works for ANY object; use `Account`,
   `Contact`, or your custom `Something__c`.
2. `openNew()` — goes to the New Record page. If your org asks for a record
   type first, pass it: `openNew('Sales Invoice')`.
3. `setFields({...})` — keys are the **labels you see on screen**. The
   framework figures out whether each field is a text box, picklist, checkbox,
   etc. — you don't have to.
4. `save()` — clicks Save, checks the green success toast, and gives you back
   the new record's id.

## C. Upload a file

```ts
import { uploadFiles, uploadToLightningFileUpload } from '../src/utils/fileUpload.js';

test('upload a file', async ({ page }) => {
  await openPage(page, '/lightning/r/Account/001XXXXXXXXXXXX/view');

  // Most common: the standard "Upload Files" component on a record page
  await uploadToLightningFileUpload(page, './data/contract.pdf');

  // Custom button or dropzone that opens the file picker:
  await uploadFiles(page, './data/contract.pdf', {
    trigger: 'button:has-text("Upload Files")',
  });

  // Several files at once:
  await uploadFiles(page, ['./data/a.png', './data/b.png'], {
    input: 'input[type="file"]',
  });
});
```

## D. Change things per run — without editing code

Create a `.env` file (copy `.env.example`) or set variables in the terminal:

```bash
SF_TARGET_ORG=my-sandbox npm test          # run against a different org
SF_START_PATH=/lightning/o/Case/list npm test   # land on a different page
SF_UPLOAD_FILES=./data/other.pdf npm test  # upload a different file
```

---

# Debugging a failing test (step by step)

Most failures are one of two things: the **selector doesn't match** or the
**page wasn't ready yet**. Work through these in order.

## STEP 1 — Re-run just the failing test, watching the browser

```bash
npx playwright test tests/my-first-test.spec.ts --headed
```

Watch where it stops. The line it fails on is in the terminal output.

## STEP 2 — Use debug mode to pause and inspect

```bash
npm run test:debug
```

This opens the Playwright Inspector. Click **Step over** to run one action at
a time. When it reaches the failing step you can see exactly what the page
looked like at that moment.

## STEP 3 — Find the right selector with the picker

While paused in the Inspector, click **Pick locator**, then click the element
in the browser. Playwright shows you the best locator for it — copy it into
your test. Prefer, in this order:

1. `page.getByRole('button', { name: 'Save' })` — most stable
2. `page.getByLabel('Account Name')` — great for form fields
3. `page.getByText('Upload Files')`
4. CSS selectors (`.slds-button`) — last resort, break most often

## STEP 4 — Read the trace of a failed run

After any failed run:

```bash
npx playwright show-trace test-results/<failing-test-folder>/trace.zip
```

The trace viewer shows a filmstrip of every step: what the page looked like
before and after each action, the network calls, and the console. This is the
fastest way to answer "what did the page actually look like when it failed?"

## STEP 5 — Common Salesforce-specific gotchas

| Symptom | Cause & fix |
| --- | --- |
| Element exists in DevTools but Playwright can't find it | It's inside a shadow root. Playwright pierces shadow DOM automatically with `getByRole`/`getByLabel` — avoid long CSS chains. |
| Click does nothing / flaky | Lightning re-renders after load. Wait for something meaningful first: `await expect(page.getByRole('heading')).toBeVisible()` before clicking. |
| Field label matches two elements | Salesforce renders duplicate labels (visible + assistive). Use `.first()` or make the label more specific. |
| Works headed, fails headless | Usually a timing issue — add an assertion (`await expect(...).toBeVisible()`) before the action instead of a `waitForTimeout`. |
| Login page appears mid-test | Session expired. Delete `.auth/org-session.json` and re-run — the framework logs in fresh. |

## Taking screenshots for your own documentation

Add this anywhere in a test to capture the page:

```ts
await page.screenshot({ path: 'docs/images/new-record.png', fullPage: true });
```

Screenshots are also captured **automatically on every failure** (see
`test-results/`), and the HTML report (`npm run report`) embeds them.

---

# Quick command reference

| I want to… | Command |
| --- | --- |
| Check everything works (no org) | `npm run test:e2e` |
| See which org will be used | `npm run org:whoami` |
| Run tests against my org | `npm test` |
| Watch the browser while it runs | `npm run test:headed` |
| Debug a test step by step | `npm run test:debug` |
| Open the results report | `npm run report` |

# If something goes wrong

| You see… | Do this |
| --- | --- |
| `Could not run the Salesforce CLI` | Install the `sf` CLI and reopen your terminal. |
| `no active session` | Run `sf org login web` and log in again. |
| Wrong org in `org:whoami` | `sf config set target-org=<alias>` |
| A field isn't found by `setFields` | Use the exact label shown on screen (case-insensitive, partial match is OK). |
| `Upload file not found` | The path is relative to the project folder — check it exists. |

More detail on every one of these: [`GUIDE.md`](./GUIDE.md) → Troubleshooting.
