import type { ConfigContext, ExpoConfig } from 'expo/config';

// One key works for the POC; split per platform (and restrict each) before release.
const mapsKey = process.env.GOOGLE_MAPS_API_KEY ?? '';
const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_KEY || mapsKey;
const iosMapsKey = process.env.GOOGLE_MAPS_IOS_KEY || mapsKey;
// Places (New) + Routes REST calls from the client.
const webServicesKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY || mapsKey;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'revon',
  // Must match the linked EAS project (extra.eas.projectId).
  slug: 'Revon',
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
    infoPlist: {
      LSApplicationQueriesSchemes: ['comgooglemaps', 'tel'],
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
  },
  web: {
    output: 'static',
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
    ['expo-notifications', { color: '#208AEF' }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '71b4afba-7a32-4b45-a260-10f9f6545fa0',
    },
    googleApiKey: webServicesKey,
  },
  owner: 'velobits-dev',
});
