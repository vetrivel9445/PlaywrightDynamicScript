import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOrgAuthInfo } from './src/utils/orgAuth.js';

/**
 * Self-contained E2E config. It runs the *real* framework helpers against a
 * local mock org server + a mock Salesforce CLI, so the full flow
 * (CLI -> frontdoor login -> dynamic navigation -> dynamic upload) is verified
 * in any environment — including CI — with no live org required.
 */
const dir = path.dirname(fileURLToPath(import.meta.url));
const binDir = path.join(dir, 'tests-e2e', 'bin');

// Put the mock `sf` CLI first on PATH so orgAuth resolves it during E2E.
process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ''}`;

function resolveBaseUrl(): string {
  try {
    return getOrgAuthInfo().instanceUrl;
  } catch {
    return `http://127.0.0.1:${process.env.MOCK_ORG_PORT ?? 8787}`;
  }
}

export default defineConfig({
  testDir: './tests-e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report-e2e' }], ['list']],

  // Boot the mock org before the tests and tear it down after.
  webServer: {
    command: 'node tests-e2e/mock-server.mjs',
    url: `http://127.0.0.1:${process.env.MOCK_ORG_PORT ?? 8787}/health`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
  },

  use: {
    baseURL: resolveBaseUrl(),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Optional: point at a system-provided Chromium (e.g. CI images that
    // pre-install browsers). Unset on a normal dev machine.
    launchOptions: process.env.PW_EXECUTABLE_PATH
      ? { executablePath: process.env.PW_EXECUTABLE_PATH }
      : {},
    // PW_CHANNEL=chrome runs in your installed Google Chrome instead of
    // Playwright's bundled Chromium.
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
