import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildFrontdoorUrl, getOrgAuthInfo } from './orgAuth.js';
import { env } from '../config/env.js';

/**
 * Playwright global setup: log into the default org connected to VS Code once,
 * then persist the authenticated browser session (storageState) so every test
 * starts already logged in. No credentials are stored or typed — we exchange
 * the CLI access token via Salesforce's frontdoor.jsp.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const auth = getOrgAuthInfo(env.targetOrg || undefined);
  const frontdoorUrl = buildFrontdoorUrl(auth, env.startPath);

  console.log(`[org-login] Authenticating as ${auth.username} @ ${auth.instanceUrl}`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(frontdoorUrl, { waitUntil: 'networkidle' });

  // Make sure we actually landed inside the org and not on the login page.
  if (/\/login|\/secur\/login/i.test(page.url())) {
    await browser.close();
    throw new Error(
      `frontdoor login failed — the org session may be expired. ` +
        `Run "sf org login web" (or reconnect the org in VS Code) and retry.`,
    );
  }

  mkdirSync(dirname(env.storageStatePath), { recursive: true });
  await context.storageState({ path: env.storageStatePath });

  console.log(`[org-login] Session saved to ${env.storageStatePath}`);
  await browser.close();
}
