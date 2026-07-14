import { getOrgAuthInfo } from '../utils/orgAuth.js';
import { env } from '../config/env.js';

/**
 * Quick diagnostic: prints which org the framework will authenticate against.
 * Run with:  npm run org:whoami
 */
const auth = getOrgAuthInfo(env.targetOrg || undefined);
console.log('Resolved default org connected to VS Code:');
console.log(`  username:    ${auth.username}`);
console.log(`  instanceUrl: ${auth.instanceUrl}`);
if (auth.orgId) console.log(`  orgId:       ${auth.orgId}`);
console.log(`  accessToken: ${auth.accessToken.slice(0, 8)}… (hidden)`);
