import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontSize: 17 } }} />;
}
