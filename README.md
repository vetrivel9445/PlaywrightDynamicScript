# Playwright Dynamic Org Login (Salesforce)

A Playwright + TypeScript framework that logs into the **default Salesforce org
connected to VS Code** — no hardcoded usernames, passwords, URLs, or file paths.
Everything the tests touch is resolved dynamically at runtime.

> 👋 **First time using this? Start with [`USER_GUIDE.md`](./USER_GUIDE.md)** —
> a plain-language, step-by-step walkthrough: install → verify → connect your
> org → run tests → write your own (with copy-paste examples for every helper).
>
> 📘 For deeper setup, CI, and configuration details, see [`GUIDE.md`](./GUIDE.md) —
> including a self-contained test suite you can run **without a real org**
> (`npm run test:e2e`).

## What's dynamic

| Concern | How it stays dynamic |
| --- | --- |
| **Org login** | Reads the default org from the Salesforce CLI (`sf org display`) — the same org you set in VS Code — and logs in via `frontdoor.jsp` using the access token. No credentials are typed or stored. |
| **Page URLs** | `openPage(page, path)` resolves relative paths against the *current* org's instance URL. Set the landing page with `SF_START_PATH`. |
| **UI file uploads** | `uploadFiles()` / `uploadToLightningFileUpload()` accept any file path(s) at runtime via `SF_UPLOAD_FILES` or arguments — supports hidden inputs, Lightning components, and native file-chooser dialogs. |

## Prerequisites

- Node.js 18+
- Salesforce CLI (`sf`, or legacy `sfdx`) installed and on `PATH`
- An org authorized and set as default in VS Code:
  ```bash
  sf org login web            # authorize an org
  sf config set target-org=<username-or-alias>   # or use "SFDX: Set a Default Org" in VS Code
  ```

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env          # optional — tweak the dynamic values
```

Confirm which org will be used:

```bash
npm run org:whoami
```

## Run

```bash
npm test                # headless
npm run test:headed     # watch it drive the browser
npm run test:ui         # Playwright UI mode
npm run report          # open the HTML report
```

On the first run, `globalSetup` logs in once via `frontdoor.jsp` and caches the
authenticated session to `.auth/org-session.json`; every test reuses it.

## Configuration (all optional, via `.env` or shell)

| Variable | Purpose | Default |
| --- | --- | --- |
| `SF_TARGET_ORG` | Org username/alias override | default org in VS Code |
| `SF_START_PATH` | Dynamic landing page | `/lightning/page/home` |
| `SF_UPLOAD_FILES` | Comma-separated upload file paths | _(none)_ |
| `SF_STORAGE_STATE` | Cached session location | `.auth/org-session.json` |
| `SF_INSTANCE_URL` | Fallback base URL if CLI is unavailable | _(none)_ |

## Using the helpers in your own tests

```ts
import { test } from '@playwright/test';
import { openPage } from '../src/utils/navigation.js';
import { uploadFiles } from '../src/utils/fileUpload.js';

test('upload on a dynamic page', async ({ page }) => {
  // Navigate anywhere by relative path — resolved against the live org.
  await openPage(page, '/lightning/o/Account/list');

  // Upload any file at runtime — button that opens the OS chooser:
  await uploadFiles(page, ['./data/contract.pdf'], {
    trigger: 'button:has-text("Upload Files")',
  });

  // ...or straight to a (possibly hidden) file input:
  await uploadFiles(page, './data/logo.png', { input: 'input[type="file"]' });
});
```

## Project layout

```
playwright.config.ts        # dynamic baseURL + cached session
src/
  config/env.ts             # runtime-configurable values + URL resolver
  utils/
    orgAuth.ts              # reads default org from SF CLI, builds frontdoor URL
    globalSetup.ts          # one-time frontdoor login -> storageState
    navigation.ts           # openPage() dynamic URL navigation
    fileUpload.ts           # dynamic UI file-upload helpers
  scripts/whoami.ts         # prints the resolved org
tests/
  dynamic-org.spec.ts       # demo of login + dynamic URL + dynamic upload
```
