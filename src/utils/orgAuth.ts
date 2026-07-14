import { execFileSync } from 'node:child_process';

/**
 * Authenticated details for a Salesforce org, resolved dynamically from the
 * Salesforce CLI (the same "default org" you set in VS Code).
 */
export interface OrgAuthInfo {
  /** e.g. https://my-domain.my.salesforce.com */
  instanceUrl: string;
  /** Session id / access token used for the frontdoor login. */
  accessToken: string;
  /** The org's username / alias that resolved. */
  username: string;
  /** The 15/18-char org id, when the CLI returns it. */
  orgId?: string;
}

interface CliOrgResult {
  status: number;
  result?: {
    instanceUrl?: string;
    accessToken?: string;
    username?: string;
    id?: string;
    connectedStatus?: string;
  };
  message?: string;
}

/**
 * Run a CLI command and parse its JSON output. Tries the modern `sf` binary
 * first, then falls back to the legacy `sfdx` binary, so it works regardless
 * of which Salesforce CLI the developer has connected to VS Code.
 */
function runCliJson(args: string[], legacyArgs: string[]): CliOrgResult {
  const attempts: Array<{ bin: string; args: string[] }> = [
    { bin: 'sf', args },
    { bin: 'sfdx', args: legacyArgs },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const stdout = execFileSync(attempt.bin, attempt.args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        // Salesforce CLI is a node script; on Windows it resolves via PATHEXT.
        shell: process.platform === 'win32',
      });
      return JSON.parse(stdout) as CliOrgResult;
    } catch (err) {
      const e = err as { stdout?: Buffer | string; message?: string };
      // The CLI still emits JSON on non-zero exit (e.g. no default org set).
      if (e.stdout) {
        try {
          return JSON.parse(e.stdout.toString()) as CliOrgResult;
        } catch {
          /* fall through to error collection */
        }
      }
      errors.push(`${attempt.bin}: ${e.message ?? 'unknown error'}`);
    }
  }

  throw new Error(
    `Could not run the Salesforce CLI. Make sure "sf" (or "sfdx") is installed ` +
      `and an org is connected in VS Code.\n${errors.join('\n')}`,
  );
}

/**
 * Resolve the org to authenticate against.
 *
 * Resolution order (all dynamic — nothing hardcoded):
 *   1. Explicit `targetOrg` argument
 *   2. SF_TARGET_ORG / SFDX_TARGET_ORG environment variable
 *   3. The default org connected to VS Code (CLI `target-org` config)
 *
 * @param targetOrg Optional username or alias to override the default org.
 */
export function getOrgAuthInfo(targetOrg?: string): OrgAuthInfo {
  const org =
    targetOrg ||
    process.env.SF_TARGET_ORG ||
    process.env.SFDX_TARGET_ORG ||
    undefined;

  // When no org is given, the CLI uses the default org set in VS Code.
  const sfArgs = ['org', 'display', '--json', ...(org ? ['--target-org', org] : [])];
  const sfdxArgs = [
    'force:org:display',
    '--json',
    ...(org ? ['--targetusername', org] : []),
  ];

  const parsed = runCliJson(sfArgs, sfdxArgs);

  if (parsed.status !== 0 || !parsed.result) {
    throw new Error(
      `Salesforce CLI could not display the org. ` +
        `${parsed.message ?? 'Set a default org in VS Code (Set Default Org) or authorize one with "sf org login web".'}`,
    );
  }

  const { instanceUrl, accessToken, username, id } = parsed.result;

  if (!instanceUrl || !accessToken) {
    throw new Error(
      `The org "${username ?? org ?? 'default'}" has no active session. ` +
        `Re-authenticate with "sf org login web" (or open VS Code and reconnect the org).`,
    );
  }

  return {
    instanceUrl: instanceUrl.replace(/\/+$/, ''),
    accessToken,
    username: username ?? org ?? 'unknown',
    orgId: id,
  };
}

/**
 * Build the Salesforce "frontdoor" URL that exchanges an access token for an
 * authenticated browser session — this is what lets Playwright skip the login
 * form entirely.
 *
 * @param auth       Org auth info from {@link getOrgAuthInfo}.
 * @param startPath  Optional relative path to land on after login
 *                   (e.g. "/lightning/setup/SetupOneHome/home").
 */
export function buildFrontdoorUrl(auth: OrgAuthInfo, startPath?: string): string {
  const base = `${auth.instanceUrl}/secur/frontdoor.jsp?sid=${encodeURIComponent(
    auth.accessToken,
  )}`;
  if (!startPath) return base;
  const retURL = startPath.startsWith('/') ? startPath : `/${startPath}`;
  return `${base}&retURL=${encodeURIComponent(retURL)}`;
}
