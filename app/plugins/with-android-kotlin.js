/**
 * Pins the Kotlin Gradle plugin of the Android build.
 *
 * React Native Firebase v27 ships Firebase Android BoM 35, whose firebase-auth is compiled with
 * Kotlin 2.4. A Kotlin compiler reads metadata up to one minor version ahead, so the build needs
 * Kotlin >= 2.3 ("Module was compiled with an incompatible version of Kotlin" otherwise), while
 * React Native 0.86 brings 2.1.20. expo-build-properties' `android.kotlinVersion` only changes
 * `ext.kotlinVersion` (the stdlib and per-module settings): the root build.gradle still resolves the
 * Kotlin Gradle plugin itself from React Native's version catalog. This plugin pins that classpath
 * entry too (Gradle keeps the highest requested version).
 *
 * The version must be one Expo's Kotlin compiler plugin (io.github.lukmccall.pika:pika-compiler) is
 * published for; 2.3.20 is the newest in SDK 57. Drop this plugin and `android.kotlinVersion` once
 * React Native ships Kotlin >= 2.3.
 */
const { withProjectBuildGradle } = require('expo/config-plugins');

const KGP_CLASSPATH = /classpath\(?\s*['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::[^'"]*)?['"]\s*\)?/;

/**
 * @param {import('expo/config').ExpoConfig} config
 * @param {{ kotlinVersion: string }} props
 * @returns {import('expo/config').ExpoConfig}
 */
function withAndroidKotlin(config, { kotlinVersion }) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('with-android-kotlin: android/build.gradle must be Groovy.');
    }
    if (!KGP_CLASSPATH.test(mod.modResults.contents)) {
      throw new Error('with-android-kotlin: Kotlin Gradle plugin classpath not found in android/build.gradle.');
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      KGP_CLASSPATH,
      `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}')`,
    );
    return mod;
  });
}

module.exports = withAndroidKotlin;
