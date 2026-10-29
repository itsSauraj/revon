/**
 * Signs local Android builds with the release keystore when credentials/revon-release.env exists.
 *
 * Google sign-in only works for certificates registered in Firebase. The standard React Native debug
 * key cannot be registered for this package (an older project already owns that pairing), so on
 * machines that hold the release keystore every local build (debug and release) uses it instead,
 * and sign-in works in `npm run android:dev` too. Without the file the template's debug key stays, so
 * other contributors are unaffected; EAS builds use their own credentials.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// revon: release keystore for local builds';

const DEBUG_SIGNING = /debug \{\s*storeFile file\('debug\.keystore'\)\s*storePassword 'android'\s*keyAlias 'androiddebugkey'\s*keyPassword 'android'\s*\}/;

const REPLACEMENT = `debug {
            ${MARKER} (plugins/with-android-signing.js)
            def revonEnv = rootProject.file('../credentials/revon-release.env')
            def revon = new Properties()
            if (revonEnv.exists()) revonEnv.withInputStream { revon.load(it) }
            if (revon['REVON_KEYSTORE']) {
                storeFile rootProject.file('../' + revon['REVON_KEYSTORE'])
                storePassword revon['REVON_STORE_PASSWORD']
                keyAlias revon['REVON_KEY_ALIAS']
                keyPassword revon['REVON_KEY_PASSWORD']
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

/** @param {import('expo/config').ExpoConfig} config */
function withAndroidSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('with-android-signing: android/app/build.gradle must be Groovy.');
    }
    const contents = mod.modResults.contents;
    if (contents.includes(MARKER)) return mod;
    if (!DEBUG_SIGNING.test(contents)) {
      throw new Error('with-android-signing: debug signingConfig not found in android/app/build.gradle.');
    }
    mod.modResults.contents = contents.replace(DEBUG_SIGNING, REPLACEMENT);
    return mod;
  });
}

module.exports = withAndroidSigning;
