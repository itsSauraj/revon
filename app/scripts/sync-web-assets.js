#!/usr/bin/env node
/* global __dirname */
/**
 * Copies web-only static files into public/, which Expo serves from the site root (dev server and
 * `expo export`). Runs on `npm install` (postinstall); the copies are gitignored.
 *
 *  - maplibre-gl's web worker: maplibre-gl 6 is ESM-only and locates its worker relative to
 *    `import.meta.url`, which Metro doesn't provide, so the OpenStreetMap web backend points
 *    MapLibre at /maplibre-gl-worker.mjs instead (see src/components/map/osm-map.web.tsx).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = [['maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/maplibre-gl-worker.mjs']];

for (const [from, to] of files) {
  const src = path.join(root, 'node_modules', from);
  const dest = path.join(root, to);
  if (!fs.existsSync(src)) {
    console.warn(`[sync-web-assets] ${from} not found; run npm install first.`);
    process.exitCode = 1;
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[sync-web-assets] ${to} (${(fs.statSync(dest).size / 1024).toFixed(0)} kB)`);
}
