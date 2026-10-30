/// <reference types="node" />
import fs from 'fs';
import path from 'path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

// One key works for the POC; split per platform (and restrict each) before release.
const mapsKey = process.env.GOOGLE_MAPS_API_KEY ?? '';
const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_KEY || mapsKey;
const iosMapsKey = process.env.GOOGLE_MAPS_IOS_KEY || mapsKey;
// Places (New) + Routes REST calls from the client.
const webServicesKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY || mapsKey;

// Google API keys look like "AIza…". A wrong value (e.g. the package name) builds fine but shows a
// blank map, so warn loudly at config time.
for (const [name, value] of Object.entries({ GOOGLE_MAPS_ANDROID_KEY: androidMapsKey, GOOGLE_MAPS_IOS_KEY: iosMapsKey })) {
  if (value && !/^AIza[0-9A-Za-z_-]{35}$/.test(value)) {
    console.warn(`
[revon] ${name} doesn't look like a Google API key (expected "AIza…"). The map will be blank.
`);
  }
}

// ---- Android toolchain ----
// React Native Firebase v27 (Firebase BoM 35) is compiled with Kotlin 2.4, which needs a Kotlin >= 2.3
// compiler; React Native 0.86 brings 2.1.20. 2.3.20 is the newest Kotlin Expo SDK 57's compiler plugin
// supports. See plugins/with-android-kotlin.js.
const KOTLIN_VERSION = '2.3.20';

// ---- Firebase (React Native Firebase on Android/iOS) ----
// Download these from Firebase console > Project settings > Your apps. They're gitignored; for EAS
// builds, upload them as EAS file environment variables with these names.
const androidServicesFile = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
const iosServicesFile = process.env.GOOGLE_SERVICES_PLIST || './GoogleService-Info.plist';
const hasAndroidFirebase = fs.existsSync(path.resolve(__dirname, androidServicesFile));
const hasIosFirebase = fs.existsSync(path.resolve(__dirname, iosServicesFile));
if (!hasAndroidFirebase) {
  console.warn(`
[revon] ${androidServicesFile} not found: sign-in won't work on Android. See backend/README.md.
`);
}

/** Google Sign-In needs the project's *web* OAuth client ID (client_type 3 in google-services.json). */
function readWebClientId(): string | undefined {
  if (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!hasAndroidFirebase) return undefined;
  try {
    const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, androidServicesFile), 'utf8'));
    const clients: { client_id: string; client_type: number }[] = json.client?.[0]?.oauth_client ?? [];
    return clients.find((c) => c.client_type === 3)?.client_id;
  } catch {
    return undefined;
  }
}
const googleWebClientId = readWebClientId();
if (hasAndroidFirebase && !googleWebClientId) {
  console.warn(`
[revon] No web OAuth client in google-services.json: enable Google sign-in in Firebase and re-download it.
`);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'revon',
  // Must match the EAS project's slug on expo.dev (linked via extra.eas.projectId).
  slug: 'revon',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/revon.icon/ios/AppIcon~ios-marketing.png',
  // Lowercase: Android matches URL schemes case-sensitively.
  scheme: 'revon',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/revon.icon/ios/AppIcon~ios-marketing.png',
    bundleIdentifier: 'com.velobits.Revon',
    supportsTablet: false,
    ...(hasIosFirebase ? { googleServicesFile: iosServicesFile } : {}),
    infoPlist: {
      LSApplicationQueriesSchemes: ['comgooglemaps', 'tel'],
      // Let animations run at 120 fps on ProMotion displays.
      CADisableMinimumFrameDurationOnPhone: true,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: './assets/revon.icon/android/res/mipmap-xxxhdpi/ic_launcher_foreground.png',
      backgroundImage: './assets/revon.icon/android/res/mipmap-xxxhdpi/ic_launcher_background.png',
      monochromeImage: './assets/revon.icon/android/res/mipmap-xxxhdpi/ic_launcher_monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    package: 'com.velobits.Revon',
    ...(hasAndroidFirebase ? { googleServicesFile: androidServicesFile } : {}),
  },
  web: {
    // Single-page app: the app relies on browser-only APIs (geolocation, storage), so no static rendering.
    output: 'single',
    favicon: './assets/revon.icon/web/icon-192.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#000000',
        image: './assets/revon.icon/android/play_store_512.png',
        imageWidth: 140,
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: androidMapsKey,
        iosGoogleMapsApiKey: iosMapsKey,
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'revon shares your live location with your ride group while a group ride is active, including when Google Maps is open.',
        locationWhenInUsePermission: 'revon shows your position and your ride group on the map.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    // OpenStreetMap map source (MapLibre Native). Uses MapLibre's own location engine, so the map
    // also works on phones without Google Play services.
    '@maplibre/maplibre-react-native',
    ['expo-notifications', { color: '#0A0A0A' }],
    // Native Firebase (auth incl. phone OTP, Realtime Database) and Google Sign-In. Only added when
    // the Firebase config file exists, since their config plugins require it.
    ...(hasAndroidFirebase || hasIosFirebase
      ? (['@react-native-firebase/app', '@react-native-firebase/auth', '@react-native-google-signin/google-signin'] as const)
      : []),
    // React Native Firebase needs frameworks on iOS and Kotlin >= 2.3 on Android.
    ['expo-build-properties', { ios: { useFrameworks: 'dynamic' }, android: { kotlinVersion: KOTLIN_VERSION } }],
    ['./plugins/with-android-kotlin', { kotlinVersion: KOTLIN_VERSION }],
    // Local builds sign with the release keystore when credentials/revon-release.env exists, so Google
    // sign-in works in dev builds too (the debug key can't be registered for this package).
    './plugins/with-android-signing',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      // @velobits-dev/revon — https://expo.dev/accounts/velobits-dev/projects/revon
      projectId: 'af5c1470-a8b7-43ac-b295-12de65b99f01',
    },
    googleApiKey: webServicesKey,
    googleWebClientId,
  },
  owner: 'velobits-dev',
});
