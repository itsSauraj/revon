# revon app (Expo / React Native)

The revon mobile app for Android and iOS, plus a web build, made with Expo SDK 57, React Native 0.86,
TypeScript and Expo Router.

> **Set up Firebase first.** Sign-in, phone verification and rides all need the Firebase project
> configured. See [backend/README.md](../backend/README.md).

## Contents

- [Requirements](#requirements)
- [1. Install](#1-install)
- [2. Configure](#2-configure)
  - [Environment variables](#environment-variables)
  - [Firebase config files](#firebase-config-files)
  - [Google Maps Platform](#google-maps-platform)
  - [Map sources](#map-sources)
- [3. Run](#3-run)
- [When to rebuild](#when-to-rebuild)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Requirements

| What | Version / notes |
|---|---|
| **Node.js** + npm | Current LTS |
| **Android Studio** | For the Android SDK and platform tools. The first build installs the NDK and SDK platform it needs. |
| **JDK 17** | Use JDK 17. Android Studio's bundled Java is newer (25) and fails the build with *"A restricted method in java.lang.System has been called"*. On Windows: `winget install --id Microsoft.OpenJDK.17 -e` |
| **Android phone** | With **Developer options → USB debugging** on, or an emulator |
| iOS (optional) | A Mac with Xcode 26.2+ for local builds, or **EAS** cloud builds plus an Apple Developer account |

**Expo Go is not supported.** The app uses native modules (React Native Firebase, Google Sign-In,
maps, background location), so it runs as a **development build** of revon itself.

### Environment variables for Android builds (one time)

Point the build at JDK 17 and the Android SDK. On **Windows (PowerShell)**, adjust the JDK folder to
yours, then **open a new terminal**:

```powershell
setx JAVA_HOME "C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot"
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
```

On **macOS / Linux** (`~/.zshrc` or `~/.bashrc`):

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)     # macOS
export ANDROID_HOME=$HOME/Library/Android/sdk        # macOS (Linux: $HOME/Android/Sdk)
export PATH=$ANDROID_HOME/platform-tools:$PATH
```

On Windows, if `adb version` prints **1.0.31**, an old "Universal Adb Driver" copy comes first on your
PATH. It doesn't support `adb reverse` and keeps disconnecting the phone. Uninstall it from **Settings
→ Apps**, or call the SDK's `adb` directly (`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`).

---

## 1. Install

```bash
cd app
npm install
```

Use `npx expo install <package>` (not plain `npm install <package>`) when adding dependencies, so
versions match Expo SDK 57.

## 2. Configure

### Environment variables

```bash
cp .env.example .env.local      # Windows: copy .env.example .env.local
```

`.env.local` is gitignored. Fill it in:

| Variable | Required | What it's for / where to get it |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | **yes** | Google Maps on Android/iOS, and Places + Routes unless overridden. Must start with `AIza…`. See [Google Maps Platform](#google-maps-platform). |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | **yes** | Firebase web app config ([backend step 6](../backend/README.md#6-register-the-apps-and-download-the-config-files)) |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | **yes** | 〃 |
| `EXPO_PUBLIC_FIREBASE_DATABASE_URL` | **yes** | Realtime Database URL, `https://<name>.<region>.firebasedatabase.app` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | **yes** | 〃 |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | **yes** | 〃 |
| `GOOGLE_MAPS_ANDROID_KEY` / `GOOGLE_MAPS_IOS_KEY` | no | Separate map keys per platform (recommended before release). Falls back to `GOOGLE_MAPS_API_KEY`. |
| `EXPO_PUBLIC_GOOGLE_API_KEY` | no | Separate key for Places (New) + Routes. Falls back to `GOOGLE_MAPS_API_KEY`. |
| `EXPO_PUBLIC_PHONE_TEST_MODE` | no | `1` skips reCAPTCHA / Play Integrity for phone sign-in. **Development builds only**, and only Firebase test numbers work. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | no | Override the Google Sign-In web client ID (normally read from `google-services.json`). |
| `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_PLIST` | no | Paths to the Firebase config files (used by EAS file variables). |

The config prints a warning on `expo start` / builds if a Maps key doesn't look like a Google API key
(for example, if the package name was pasted by mistake). That mistake builds fine but shows a blank map.

### Firebase config files

Download these from the Firebase console
([backend step 6](../backend/README.md#6-register-the-apps-and-download-the-config-files)) and put
them in `app/`:

| File | Platform | Notes |
|---|---|---|
| `app/google-services.json` | Android | Re-download after adding SHA fingerprints or enabling Google sign-in |
| `app/GoogleService-Info.plist` | iOS | |

Both are gitignored. Without `google-services.json`, Android builds print
`[revon] ./google-services.json not found` and sign-in shows *"Firebase is not configured"*.

### Google Maps Platform

Use the Google Cloud project that owns the Firebase project. In
[Google Cloud console](https://console.cloud.google.com) → **APIs & Services → Library**, enable:

| API | Used for |
|---|---|
| **Maps SDK for Android** | The map on Android |
| **Maps SDK for iOS** | The map on iOS |
| **Maps JavaScript API** | The map in the web build |
| **Places API (New)** | Destination search |
| **Routes API** | Routes, ETAs, turn-by-turn steps |

Then create a key under **APIs & Services → Credentials → Create credentials → API key**:

- **Simplest (development):** one key, with **API restrictions** limited to the five APIs above and no
  *application* restriction. Put it in `GOOGLE_MAPS_API_KEY`.
- **Before release**, split it into restricted keys:
  - Android map key → **Android apps**, package `com.velobits.Revon` + SHA-1 → `GOOGLE_MAPS_ANDROID_KEY`
  - iOS map key → **iOS apps**, bundle `com.velobits.Revon` → `GOOGLE_MAPS_IOS_KEY`
  - Places + Routes + Maps JavaScript key → **Websites** (your domain and `http://localhost:8081/*`),
    restricted to those APIs → `EXPO_PUBLIC_GOOGLE_API_KEY`. Search and routes are web requests, so
    they **fail with an app-restricted key**.

### Map sources

The map, place search and routing come from one of two stacks, chosen per phone in **Settings → Map**.
Rides don't care which: routes are stored the same way, and riders in one group can mix sources.
Options a source can't offer (traffic on OpenStreetMap, the bicycling layer on Google's mobile SDKs)
are left out of the layers sheet, and both the sheet and the Settings picker say so.

| | Google Maps | OpenStreetMap |
|---|---|---|
| Map | Maps SDKs / Maps JavaScript API | MapLibre with [OpenFreeMap](https://openfreemap.org) vector tiles (no key, no limits) |
| Search | Places API (New) | [Photon](https://photon.komoot.io) by komoot |
| Routing | Routes API: two-wheeler where available, traffic-aware | [Valhalla](https://valhalla1.openstreetmap.de) motorcycle costing (FOSSGIS), OSRM as fallback |
| Satellite / terrain | Google imagery | Esri World Imagery / OpenTopoMap rasters |
| Traffic | yes | no free source |
| 3D buildings | yes | yes (OpenMapTiles building heights) |
| Bicycling | web only | Waymarked Trails cycling overlay |
| Needs | Google API keys and Google Play services | nothing; works on phones without Google services |

The default is Google when the build has a Google key, OpenStreetMap otherwise. The OpenStreetMap
services are public fair-use servers: fine for development and small groups, and the map shows the
required attribution. Before a large release, point `src/components/map/osm-styles.ts` and
`src/lib/osm.ts` at paid tiers (for example MapTiler or Stadia tiles, Stadia or OpenRouteService
routing) or your own servers.

Switching sources needs no rebuild, but MapLibre is a native module: after pulling this change,
rebuild the dev app once (`npx expo prebuild --platform android`, then `npm run android:dev`).

On web, MapLibre runs its tile parsing in a web worker that Metro can't bundle, so `npm install`
copies it from `node_modules` to `public/maplibre-gl-worker.mjs` (`scripts/sync-web-assets.js`,
gitignored), where Expo serves it from the site root.

---

## 3. Run

### Android phone over USB (recommended)

Works on any network, including office networks with a proxy, because the app's code comes over the
USB cable rather than Wi-Fi.

**First time, or after native changes** (see [When to rebuild](#when-to-rebuild)):

```bash
cd app
npx expo prebuild --platform android          # generates android/ from the config
npm run android:dev -- --device <device>      # builds, installs and opens revon
```

`<device>` is the phone's model or serial from `adb devices -l`, e.g. `A142`. Note the `--` before
`--device`: without it npm treats `--device` as its own option. The first build downloads Gradle, the
NDK and many libraries and can take **20–40 minutes**. Later builds take a few minutes.

**Every day:**

```bash
npm run start:usb
```

Then open **revon** on the phone (close it fully first if it was open). `start:usb` sets up
`adb reverse` for every connected phone and starts the dev server so the app loads from
`localhost:8081` through the cable. Keep the terminal open. Code changes reload instantly. Run it
again after unplugging the phone or a reboot.

### Android over Wi-Fi

Phone and computer on the same network:

```bash
npm run start
```

Then open revon and pick the server, or scan the QR code with the revon app. If you get *"Failed to
connect to 192.168.x.x:8081"*, the network blocks it: use `start:usb`.

### Emulator

Start an emulator from Android Studio's Device Manager, then `npm run android:dev`. Set a location in
the emulator's *Extended controls → Location* (a GPX route works well for testing rides).

### Web

```bash
npm run web          # http://localhost:8081
```

Needs **Maps JavaScript API** on the key. Google sign-in uses a popup, and phone verification uses an
invisible reCAPTCHA. Background location isn't available in browsers.

### Cloud builds (EAS)

For testers, iOS without a Mac, or store builds. The EAS project is `@velobits-dev/revon`.

```bash
npm run env:push:dev          # copy .env.local values to EAS (development environment)
npm run build:dev:android     # or build:dev:ios / build:preview:* / build:prod:*
```

Also upload `google-services.json` / `GoogleService-Info.plist` as EAS **file** variables named
`GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_PLIST` (EAS dashboard → Environment variables), because
gitignored files aren't uploaded to EAS. Add the EAS build's SHA-1/SHA-256
(`npx eas-cli@latest credentials -p android`) to Firebase.

### Shareable APK (local)

A release build signed with the project's own key, to send to testers directly (no EAS account or Play
Store needed):

```bash
npm run apk                       # → builds/revon-<version>-release.apk
```

It runs `expo prebuild --clean`, Gradle's `assembleRelease`, then signs the APK with
`credentials/revon-release.keystore` and verifies it. `credentials/` and `builds/` are gitignored. It reads
`credentials/revon-release.env`:

```
REVON_KEYSTORE=credentials/revon-release.keystore
REVON_KEY_ALIAS=revon
REVON_STORE_PASSWORD=…
REVON_KEY_PASSWORD=…
```

No keystore yet? Create one and keep it (and the passwords) safe: every later update must be signed with
the same key, and Google sign-in only works in builds whose key is registered in Firebase.

```bash
keytool -genkeypair -v -keystore credentials/revon-release.keystore -alias revon -keyalg RSA -keysize 2048 -validity 10000
keytool -list -v -keystore credentials/revon-release.keystore -alias revon    # SHA-1 / SHA-256 for Firebase
```

Testers install the file with `adb install -r <file>`, or open it on the phone (Android asks once to allow
installs from that app). Add `-- --no-prebuild` to reuse the current `android/` folder.

### First launch

The app shows a welcome intro, then sign-in (Google or email), email verification for email accounts,
then name and mobile number with an SMS code. Use a Firebase **test number** while developing
([backend step 4](../backend/README.md#4-test-phone-numbers-development)).

---

## When to rebuild

| You changed… | Do this |
|---|---|
| JavaScript/TypeScript in `src/` | Nothing: the app reloads |
| `EXPO_PUBLIC_*` values in `.env.local` | Restart the dev server with a clean cache: `npm run start:usb:clear` |
| A Maps key, `google-services.json`, `GoogleService-Info.plist`, `app.config.ts` | `npx expo prebuild --platform android`, then `npm run android:dev -- --device <device>` |
| Added or upgraded a package with native code (e.g. `expo-haptics`) | Same as above |

Stop the dev server before `prebuild` or `npm install`. If it's left running while thousands of files
change, it can stop responding (the app then shows a white screen), and you'll need to restart it.

---

## Scripts

| Script | What it does |
|---|---|
| `npm run start:usb` | Dev server for phones over USB (`adb reverse` + localhost). `start:usb:clear` also clears the cache. |
| `npm run start` / `start:clear` | Dev server over Wi-Fi/LAN |
| `npm run web` | Web build in the browser |
| `npm run android:dev` | Local debug build, installed on a device/emulator (add `-- --device <name>`) |
| `npm run android:release` | Local release build, installed on a device/emulator |
| `npm run apk` | Release APK signed with the release keystore, for testers → `builds/` ([details](#shareable-apk-local)) |
| `npm run ios:dev` / `ios:release` | Local iOS builds (Mac only) |
| `npm run build:dev:android` / `:ios` | EAS development build |
| `npm run build:preview:android` / `:ios` | EAS preview build (APK on Android, for testers) |
| `npm run build:prod:android` / `:ios` / `build:prod` | EAS production builds |
| `npm run submit:android` / `submit:ios` | Upload a production build to the stores |
| `npm run env:push:dev` / `:preview` / `:prod` | Copy `.env.local` to an EAS environment |
| `npm run env:pull:dev` | Download EAS development variables into `.env.local` (**overwrites it**) |
| `npm run typecheck` / `lint` / `doctor` / `check` | TypeScript, ESLint, `expo-doctor`, or all three |

The `go`, `go:clear` and `go:tunnel` scripts start the server in Expo Go mode. Expo Go can't run the
current app (it needs native modules); they're kept for reference.

---

## Project structure

```
app/
├── app.config.ts             Expo config: keys, plugins, Firebase files, EAS project
├── plugins/                  Expo config plugins (Android Kotlin pin for React Native Firebase)
├── scripts/start-usb.js      Dev server over USB
├── scripts/build-apk.js      Release APK signed with the release keystore
├── src/
│   ├── app/                  Screens (Expo Router)
│   │   ├── welcome.tsx       First-launch intro
│   │   ├── auth/             Sign in / register, forgot password, verify email, phone, OTP
│   │   ├── (tabs)/           Map (home) and Settings
│   │   ├── ride/[id].tsx     Group ride screen
│   │   └── join/             Join by code / invite link
│   ├── components/           UI (ui/, map/, nav/, ride/, auth/, welcome/)
│   │   └── map/              map-view picks a backend: google-map or osm-map (+ .web variants)
│   ├── hooks/                use-ride, use-route-follow, use-map-heading, …
│   ├── constants/theme.ts    Colors (light/dark), sizes, type scale
│   └── lib/                  auth, db, firebase (native + .web variants), rides, map-source,
│                             places + directions (Google or OpenStreetMap), validation, countries,
│                             session, location task, alerts, geo
└── assets/revon.icon/        App icons
```

Files ending in `.web.ts(x)` replace their native counterparts in the web build (for example
`lib/auth.web.ts` uses the Firebase JS SDK, while `lib/auth.ts` uses React Native Firebase).

---

## Motion and interaction

The interface follows one motion system (`src/lib/motion.ts`), translated from Apple's fluid-interface
guidance to Reanimated:

- **Springs take Apple's two parameters** (`duration` = response, `dampingRatio`). `Spring.settle`
  (no overshoot) for anything that moves without a finger; `Spring.sheet(velocity)` /
  `Spring.momentum(velocity)` after a drag or flick, carrying the release velocity so there's no seam
  between the gesture and the animation.
- **Timing** (`Timing.press/toggle/enter/exit/move`) with `EASE_OUT` for enter/exit and `EASE_IN_OUT`
  for movement; never ease-in. CSS-transition forms live in `src/components/ui/transition.ts`.
- **Everything a finger touches runs on the UI thread**: `PressableScale` (press-in scale on every
  button and chip), `BottomSheet` / `SheetModal` (`src/components/ui/sheet.tsx`: 1:1 drag with the
  grab offset, rubber-banding at the ends, momentum projection to pick the detent, interruptible
  mid-flight, swipe to dismiss), swipe-to-dismiss alerts, the SOS hold.
- **Haptics** (`haptic.*`, expo-haptics): one per user action, on the same frame as the visual, never
  the only feedback: sheet detents, chip and layer selection, SOS trigger, sign-in success/error.
- **Reduced motion / reduced transparency** are respected everywhere: configs carry
  `ReduceMotion.System`, screen transitions become a cross-fade, parallax and shakes are dropped, and
  glass surfaces go solid (`src/hooks/use-reduce-transparency.ts`).
- **Typography** uses `TextStyles` from the theme: tracking tightens as text grows and loosens on tiny
  labels; line height scales the other way.

Feel can only be judged on a device, in a release build, ideally on the slowest Android you support.
Expo Go and the simulator hide exactly the problems that matter.

---

## Troubleshooting

### Build

| Problem | Fix |
|---|---|
| `A restricted method in java.lang.System has been called` | Build with **JDK 17**: set `JAVA_HOME`, then stop old Gradle daemons with `cd android && ./gradlew --stop`. |
| `JAVA_HOME is not set` / `SDK location not found` | Set `JAVA_HOME` and `ANDROID_HOME` ([see above](#environment-variables-for-android-builds-one-time)), then open a new terminal. |
| `npm error Unknown cli flag: --device` | Use `npm run android:dev -- --device <name>` (note the `--`). |
| Stuck right after `env: export …`, no build output | A frozen or offline emulator. Close it (`adb devices` shows it `offline`), run `adb kill-server`, try again. |
| First build seems stuck on `Resolve dependencies` | It's downloading libraries. Wait. If a VPN/proxy blocks Maven, check that https://repo.maven.apache.org opens. |
| Device menu doesn't appear in Git Bash | Git Bash can't show interactive pickers: pass `--device <name>`, or use PowerShell. |

### Running

| Problem | Fix |
|---|---|
| **Blank map** (grey or dark, no streets) | Wrong or missing Maps key (look for the `[revon] … doesn't look like a Google API key` warning), or **Maps SDK for Android** not enabled. Fix `.env.local`, then `prebuild` + rebuild. |
| **Black map** with OpenStreetMap on web, *Worker failed to load* | `public/maplibre-gl-worker.mjs` is missing (install ran with scripts disabled). Run `node scripts/sync-web-assets.js`. |
| **White screen** on the phone | The dev server isn't running or stopped responding. Restart it with `npm run start:usb:clear`, then fully close and reopen revon. |
| *Failed to connect to 192.168.x.x:8081* | The phone can't reach your PC over the network: use `npm run start:usb`. |
| `adb reverse` prints the adb help text | Old adb 1.0.31 on PATH: see [the Windows note](#environment-variables-for-android-builds-one-time). |
| Search or routes fail with *Google API 400/403* | Places API (New) / Routes API not enabled, or the key is restricted to Android/iOS apps. |
| Sign-in or SMS errors | See the [backend troubleshooting table](../backend/README.md#troubleshooting). |
| *Firebase is not configured* | Missing `app/google-services.json` (rebuild after adding it), or empty `EXPO_PUBLIC_FIREBASE_*` (web). |

### Checks before committing

```bash
npm run check        # typecheck + lint + expo-doctor
```
