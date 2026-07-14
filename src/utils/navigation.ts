import type { Page } from '@playwright/test';
import { resolvePageUrl } from '../config/env.js';

/**
 * Navigate to a dynamic page within the current org.
 *
 * The org's instance URL is read from the page's own origin, so the same call
 * works against any org (sandbox, scratch, prod) without code changes.
 *
 * @param page     The Playwright page (already authenticated).
 * @param path     A relative path (e.g. "/lightning/o/Account/list") or full URL.
 * @param waitFor  Load state to wait for. Lightning is SPA-heavy, so we default
 *                 to 'networkidle'.
 */
export async function openPage(
  page: Page,
  path: string,
  waitFor: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle',
): Promise<void> {
  const origin = new URL(page.url()).origin;
  const target = resolvePageUrl(origin, path);
  await page.goto(target, { waitUntil: waitFor });
}
