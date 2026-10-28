#!/usr/bin/env node
/**
 * Build a shareable, release-signed Android APK: builds/revon-<version>-release.apk
 *
 *  1. `expo prebuild --platform android --clean`: regenerates android/ from app.config.ts.
 *  2. `gradlew app:assembleRelease`: the release build (Gradle signs it with the debug key).
 *  3. `apksigner sign` with the release keystore, then `apksigner verify` and a zipalign check.
 *
 * Needs JDK 17 (JAVA_HOME) and the Android SDK (ANDROID_HOME) like any local build, plus
 * credentials/revon-release.env (gitignored) with:
 *   REVON_KEYSTORE=credentials/revon-release.keystore
 *   REVON_KEY_ALIAS=revon
 *   REVON_STORE_PASSWORD=…
 *   REVON_KEY_PASSWORD=…
 * The same variables can be set in the environment instead (CI). See README → "Shareable APK".
 *
 * Options: --no-prebuild (reuse the existing android/ folder), --out <file>.
 */
/* global __dirname */
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const win = process.platform === 'win32';
const args = process.argv.slice(2);
const noPrebuild = args.includes('--no-prebuild');
const outArg = args[args.indexOf('--out') + 1];

function fail(message) {
  console.error(`\n[build-apk] ${message}`);
  process.exit(1);
}

function run(title, command, commandArgs, options = {}) {
  console.log(`\n=== ${title}\n$ ${[command, ...commandArgs].join(' ')}\n`);
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    // .bat/.cmd files only run through the shell on Windows.
    shell: win,
    ...options,
    env: { ...process.env, ...options.env },
  });
  if (result.error) fail(`${title}: ${result.error.message}`);
  if (result.status !== 0) fail(`${title} failed (exit code ${result.status}).`);
}

// ---- Android SDK tools ----
function sdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'Android', 'sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Android', 'Sdk'),
  ].filter(Boolean);
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'build-tools')));
  if (!found) fail('Android SDK not found. Set ANDROID_HOME (see README → Requirements).');
  return found;
}

function buildTools() {
  const dir = path.join(sdkRoot(), 'build-tools');
  const versions = fs
    .readdirSync(dir)
    .filter((v) => fs.existsSync(path.join(dir, v, win ? 'apksigner.bat' : 'apksigner')))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  if (!versions.length) fail(`No build-tools with apksigner in ${dir}. Install one from Android Studio → SDK Manager.`);
  return path.join(dir, versions[0]);
}

// ---- Signing credentials ----
const envFile = path.join(root, 'credentials', 'revon-release.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}
const missing = ['REVON_KEYSTORE', 'REVON_KEY_ALIAS', 'REVON_STORE_PASSWORD', 'REVON_KEY_PASSWORD'].filter((k) => !process.env[k]);
if (missing.length) {
  fail(
    `Missing ${missing.join(', ')}. Put them in credentials/revon-release.env or the environment.\n` +
      'No keystore yet? Create one (keep it and its passwords safe; updates must be signed with the same key):\n' +
      '  keytool -genkeypair -v -keystore credentials/revon-release.keystore -alias revon -keyalg RSA -keysize 2048 -validity 10000',
  );
}
const keystore = path.resolve(root, process.env.REVON_KEYSTORE);
if (!fs.existsSync(keystore)) fail(`Keystore not found: ${keystore}`);

// ---- Build ----
const { getConfig } = require('@expo/config');
const { exp } = getConfig(root, { skipSDKVersionRequirement: true });
const version = exp.version ?? '0.0.0';
const out = path.resolve(root, outArg ?? path.join('builds', `${exp.slug ?? 'app'}-${version}-release.apk`));

if (!noPrebuild) {
  // CI=1 keeps Expo from prompting (e.g. before deleting android/).
  run('prebuild', 'npx', ['expo', 'prebuild', '--platform', 'android', '--no-install', '--clean'], { env: { CI: '1' } });
}

const gradlew = path.join(root, 'android', win ? 'gradlew.bat' : 'gradlew');
if (!fs.existsSync(gradlew)) fail('android/ folder not found. Run without --no-prebuild.');
run('gradle assembleRelease', gradlew, ['app:assembleRelease', '-x', 'lint', '-x', 'test', '--build-cache'], {
  cwd: path.join(root, 'android'),
});

const unsigned = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!fs.existsSync(unsigned)) fail(`Gradle finished but ${unsigned} is missing.`);

// ---- Sign and verify ----
const tools = buildTools();
const apksigner = path.join(tools, win ? 'apksigner.bat' : 'apksigner');
const zipalign = path.join(tools, win ? 'zipalign.exe' : 'zipalign');
fs.mkdirSync(path.dirname(out), { recursive: true });
run('sign with the release keystore', apksigner, [
  'sign',
  '--ks', keystore,
  '--ks-key-alias', process.env.REVON_KEY_ALIAS,
  '--ks-pass', 'env:REVON_STORE_PASSWORD',
  '--key-pass', 'env:REVON_KEY_PASSWORD',
  '--out', out,
  unsigned,
]);
run('verify signature', apksigner, ['verify', '--print-certs', out]);
run('verify alignment', zipalign, ['-c', '-P', '16', '4', out]);

const bytes = fs.readFileSync(out);
console.log(`
=== Done
APK:     ${out}
Size:    ${(bytes.length / 1024 / 1024).toFixed(1)} MB
SHA-256: ${crypto.createHash('sha256').update(bytes).digest('hex')}
Install: adb install -r "${out}"   (or share the file; "Install unknown apps" must be allowed on the phone)
`);
