import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LuMap } from 'react-icons/lu';

import { Button } from '@/components/ui/button';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { db, get, ref } from '@/lib/db';
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

  // The root layout only shows this screen once the profile is complete.
  if (!profile) return null;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {error ? (
        <>
          <Text style={[styles.title, { color: theme.text }]}>Couldn&apos;t join {code}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{error}</Text>
          <Button label="Back to map" icon={LuMap} variant="inverse" onPress={() => router.replace('/')} style={styles.button} />
        </>
      ) : (
        <>
          <ActivityIndicator color={theme.text} />
          <Text style={[styles.body, { color: theme.textSecondary }]}>Joining ride {code}…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
  title: { fontSize: Type.title, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: Type.small + 1, textAlign: 'center' },
  button: { marginTop: 6 },
});
