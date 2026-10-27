#!/usr/bin/env node
/**
 * Start the dev server for phones connected over USB, without needing Wi-Fi.
 *
 * Useful on office/proxy networks where the phone can't reach this PC's LAN IP:
 *  1. `adb reverse tcp:8081 tcp:8081` for every connected Android device, so the phone's
 *     localhost:8081 tunnels to this PC over the USB cable.
 *  2. `expo start` listening on all interfaces, with REACT_NATIVE_PACKAGER_HOSTNAME=localhost so the
 *     app is told to load from localhost:8081. (`--localhost` isn't used: on Windows it can bind
 *     only the IPv6 loopback ::1, while `adb reverse` forwards to IPv4 127.0.0.1.)
 *
 * Extra arguments are passed to `expo start` (e.g. `npm run start:usb -- --clear`).
 */
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = '8081';

function findAdb() {
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'Android', 'sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Android', 'Sdk'),
  ].filter(Boolean);
  for (const root of sdkRoots) {
    const candidate = path.join(root, 'platform-tools', exe);
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'adb'; // fall back to PATH
}

const adb = findAdb();

let devices = [];
try {
  devices = execFileSync(adb, ['devices'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);
} catch (e) {
  console.error(`Could not run adb (${adb}): ${e.message}`);
}

if (!devices.length) {
  console.warn('No Android device found over USB. Plug in the phone, unlock it and allow USB debugging.');
}
for (const serial of devices) {
  try {
    execFileSync(adb, ['-s', serial, 'reverse', `tcp:${PORT}`, `tcp:${PORT}`], { stdio: 'ignore' });
    console.log(`USB tunnel ready on ${serial}: phone localhost:${PORT} -> this PC`);
  } catch (e) {
    console.error(`adb reverse failed on ${serial}: ${e.message}`);
  }
}

const child = spawn('npx', ['expo', 'start', '--lan', '--port', PORT, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: 'localhost', NO_PROXY: 'localhost,127.0.0.1' },
});
child.on('exit', (code) => process.exit(code ?? 0));
