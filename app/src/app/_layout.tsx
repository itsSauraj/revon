// Defines the background location task; must load before anything else so the OS can deliver
// updates when the app is started in the background.
import '@/lib/location-task';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { startSession, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();
startSession();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { ready } = useSession();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="ride/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="join/index" options={{ presentation: 'modal', headerShown: true, title: 'Join a ride' }} />
        <Stack.Screen name="join/[code]" />
      </Stack>
    </ThemeProvider>
  );
}
