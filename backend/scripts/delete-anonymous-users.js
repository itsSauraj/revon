#!/usr/bin/env node
/**
 * Lists, and with --confirm deletes, anonymous Firebase Auth users (accounts with no sign-in
 * provider, email or phone): the test users from before revon had real sign-in.
 *
 *   npm run users:anonymous              # dry run: count + list, deletes nothing
 *   npm run users:anonymous:delete       # actually delete them
 *
 * Needs an admin service-account key: Firebase console > Project settings > Service accounts >
 * Generate new private key. Save it as backend/service-account.json (gitignored), or pass
 * --key <path>, or set GOOGLE_APPLICATION_CREDENTIALS.
 */
const fs = require('fs');
const path = require('path');
// firebase-admin v14+: modular entry points only.
const { cert, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const keyArg = args[args.indexOf('--key') + 1];
const keyPath = args.includes('--key')
  ? path.resolve(keyArg)
  : process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'service-account.json');

if (!fs.existsSync(keyPath)) {
  console.error(`Service account key not found: ${keyPath}`);
  console.error('Firebase console > Project settings > Service accounts > Generate new private key.');
  process.exit(1);
}

const key = require(keyPath);
if (key.type !== 'service_account') {
  const kind = key.installed || key.web ? 'an OAuth client file (client_secret…json)' : 'not a service-account key';
  console.error(`${keyPath} is ${kind}.`);
  console.error('Use the private key from Firebase console > Project settings > Service accounts >');
  console.error('"Generate new private key". That file starts with "type": "service_account".');
  process.exit(1);
}
initializeApp({ credential: cert(key) });
const auth = getAuth();

const isAnonymous = (u) => u.providerData.length === 0 && !u.email && !u.phoneNumber;

async function listAnonymous() {
  const found = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    found.push(...page.users.filter(isAnonymous));
    pageToken = page.pageToken;
  } while (pageToken);
  return found;
}

(async () => {
  const project = key.project_id;
  const users = await listAnonymous();
  console.log(`Project ${project}: ${users.length} anonymous user(s).`);
  for (const u of users.slice(0, 50)) {
    console.log(`  ${u.uid}  created ${u.metadata.creationTime}  last sign-in ${u.metadata.lastSignInTime ?? '-'}`);
  }
  if (users.length > 50) console.log(`  … and ${users.length - 50} more`);

  if (!users.length) return;
  if (!confirm) {
    console.log('\nDry run: nothing deleted. Re-run with --confirm to delete these users.');
    return;
  }

  let deleted = 0;
  let failed = 0;
  // deleteUsers takes up to 1000 uids per call.
  for (let i = 0; i < users.length; i += 1000) {
    const batch = users.slice(i, i + 1000).map((u) => u.uid);
    const res = await auth.deleteUsers(batch);
    deleted += res.successCount;
    failed += res.failureCount;
    res.errors.forEach((e) => console.error(`  failed ${batch[e.index]}: ${e.error.message}`));
  }
  console.log(`\nDeleted ${deleted} anonymous user(s)${failed ? `, ${failed} failed` : ''}.`);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
