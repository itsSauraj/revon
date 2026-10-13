import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { get, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { startTracking } from '@/lib/location-task';
import { joinByCode, normalizeCode } from '@/lib/rides';
import { useSession } from '@/lib/session';
import type { RideMeta } from '@/lib/types';

/** Target of invite links (revon://join/CODE) and of the code entry screen. */
export default function JoinRide() {
  const theme = useTheme();
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = normalizeCode(raw ?? '');
  const { profile, uid } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !uid || !code) return;
    let cancelled = false;
    (async () => {
      try {
        const rideId = await joinByCode(code, uid, profile);
        const meta = (await get(ref(db, `rides/${rideId}/meta`))).val() as RideMeta;
        await startTracking({
          rideId,
          uid,
          polyline: meta.route?.polyline ?? null,
          destination: meta.destination,
        });
        if (!cancelled) router.replace({ pathname: '/ride/[id]', params: { id: rideId } });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, profile, uid]);

  if (!profile) return <Redirect href={{ pathname: '/onboarding', params: { next: `/join/${code}` } }} />;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {error ? (
        <>
          <Text style={[styles.title, { color: theme.text }]}>Couldn&apos;t join {code}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{error}</Text>
          <Pressable onPress={() => router.replace('/')} style={[styles.button, { backgroundColor: theme.primary }]}>
            <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Back to map</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" />
          <Text style={[styles.body, { color: theme.textSecondary }]}>Joining ride {code}…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 16, textAlign: 'center' },
  button: { height: 56, borderRadius: 28, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { fontSize: 17, fontWeight: '800' },
});
