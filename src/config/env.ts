import 'dotenv/config';

/**
 * Central place for runtime-dynamic values. Everything can be overridden with
 * environment variables (e.g. in a `.env` file or CI secrets) so nothing is
 * hardcoded to a single org, page, or file.
 */
export const env = {
  /**
   * Optional org username/alias override. When empty, the framework uses the
   * default org connected to VS Code.
   */
  targetOrg: process.env.SF_TARGET_ORG ?? process.env.SFDX_TARGET_ORG ?? '',

  /**
   * The relative page path Playwright opens after login. Dynamic — point it at
   * any Lightning/Visualforce/app page without touching code.
   * e.g. "/lightning/setup/SetupOneHome/home", "/lightning/o/Account/list"
   */
  startPath: process.env.SF_START_PATH ?? '/lightning/page/home',

  /**
   * Default file(s) used by the dynamic upload helper when a test does not pass
   * its own path. Comma-separate for multiple files.
   */
  uploadFilePaths: (process.env.SF_UPLOAD_FILES ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),

  /** Where the authenticated browser session (storageState) is cached. */
  storageStatePath: process.env.SF_STORAGE_STATE ?? '.auth/org-session.json',
} as const;

/**
 * Resolve a dynamic page URL against the org instance URL.
 *
 * @param instanceUrl The org base URL (from the resolved org auth info).
 * @param path        A relative path or a full URL. Full URLs pass through.
 */
export function resolvePageUrl(instanceUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = instanceUrl.replace(/\/+$/, '');
  const rel = path.startsWith('/') ? path : `/${path}`;
  return `${base}${rel}`;
}
