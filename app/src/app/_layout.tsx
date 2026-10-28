// Defines the background location task; must load before anything else so the OS can deliver
// updates when the app is started in the background.
import '@/lib/location-task';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { startSession, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();
startSession();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const { stage } = useSession();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (stage !== 'loading') SplashScreen.hideAsync();
  }, [stage]);

  // Development builds can hide the native splash early; show a themed loader instead of a blank screen.
  if (stage === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }

  return (
    // Gestures (sheets, swipe-to-dismiss) need this root; without it they silently do nothing.
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {/* Status bar text follows the theme (the map behind it follows the theme too). */}
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        {/* Each onboarding step only exposes its own screens; the app is reachable once set up.
            Screen transitions stay the platform default; reduced motion gets a cross-fade instead. */}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
            animation: reducedMotion ? 'fade' : 'default',
          }}>
          <Stack.Protected guard={stage === 'welcome'}>
            <Stack.Screen name="welcome" />
          </Stack.Protected>
          <Stack.Protected guard={stage === 'auth'}>
            <Stack.Screen name="auth/index" />
            <Stack.Screen name="auth/forgot" />
          </Stack.Protected>
          <Stack.Protected guard={stage === 'verifyEmail'}>
            <Stack.Screen name="auth/verify-email" />
          </Stack.Protected>
          <Stack.Protected guard={stage === 'phone'}>
            <Stack.Screen name="auth/phone" />
            <Stack.Screen name="auth/otp" />
          </Stack.Protected>
          <Stack.Protected guard={stage === 'ready'}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="ride/[id]" options={{ gestureEnabled: false }} />
            <Stack.Screen
              name="join/index"
              options={{ presentation: 'modal', headerShown: true, title: 'Join a ride' }}
            />
            <Stack.Screen name="join/[code]" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
