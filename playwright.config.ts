import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';
import { getOrgAuthInfo } from './src/utils/orgAuth.js';
import { env } from './src/config/env.js';

/**
 * Resolve the org's instance URL at config-load time so `baseURL` is dynamic —
 * it always points at whatever org is currently connected to VS Code. If the
 * CLI is unavailable (e.g. lint/typecheck in CI without an org), we fall back
 * gracefully instead of crashing the whole config.
 */
function resolveBaseUrl(): string | undefined {
  try {
    return getOrgAuthInfo(env.targetOrg || undefined).instanceUrl;
  } catch (err) {
    console.warn(
      `[playwright.config] Could not resolve org base URL: ${(err as Error).message}`,
    );
    return process.env.SF_INSTANCE_URL || undefined;
  }
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  // Log into the default org once and cache the session for all tests.
  globalSetup: './src/utils/globalSetup.ts',

  use: {
    baseURL: resolveBaseUrl(),
    storageState: env.storageStatePath,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Optional: point at a system-provided Chromium (e.g. CI images that
    // pre-install browsers). Unset on a normal dev machine.
    launchOptions: process.env.PW_EXECUTABLE_PATH
      ? { executablePath: process.env.PW_EXECUTABLE_PATH }
      : {},
    // PW_CHANNEL=chrome runs in your installed Google Chrome instead of
    // Playwright's bundled Chromium.
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
