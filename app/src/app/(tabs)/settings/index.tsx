import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { IconType } from 'react-icons';
import { FcGoogle } from 'react-icons/fc';
import { LuGlobe, LuLogOut, LuMail, LuMap, LuPhone, LuShieldCheck } from 'react-icons/lu';

import { ProfileForm } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/dialog';
import { isFirebaseConfigured } from '@/lib/firebase';
import { stopTracking } from '@/lib/location-task';
import { hasGoogleKey, MAP_SOURCES, setMapSource, unavailableNote, useMapSource } from '@/lib/map-source';
import { saveProfile, signOut, useSession } from '@/lib/session';

export default function SettingsScreen() {
  const theme = useTheme();
  const { profile, user, error } = useSession();
  const [saved, setSaved] = useState(false);
  const google = user?.providers.includes('google.com');
  const source = useMapSource();

  const logOut = async () => {
    const ok = await confirmAction({
      title: 'Sign out of revon?',
      message: 'Location sharing for any active ride stops on this phone.',
      confirmText: 'Sign out',
      destructive: true,
    });
    if (!ok) return;
    await stopTracking({ keepContext: false }).catch(() => {});
    await signOut();
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Settings' }} />

      <Text style={[styles.section, { color: theme.text }]}>Account</Text>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <Row icon={google ? FcGoogle : LuMail} label={google ? 'Google account' : 'Email'} value={user?.email ?? '–'} />
        <Row
          icon={LuPhone}
          label="Mobile"
          value={user?.phoneNumber ?? 'Not verified'}
          badge={user?.phoneNumber ? 'Verified' : undefined}
        />
      </View>

      <Text style={[styles.section, { color: theme.text }]}>Rider profile</Text>
      <ProfileForm
        initial={profile}
        submitLabel={saved ? 'Saved' : 'Save'}
        onSubmit={async (p) => {
          await saveProfile(p);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
      />
      <Text style={[styles.hint, { color: theme.textSecondary }]}>Changes apply to rides you start or join from now on.</Text>

      <Text style={[styles.section, { color: theme.text }]}>Map</Text>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        {MAP_SOURCES.map((s, i) => {
          const selected = source === s.id;
          const disabled = s.id === 'google' && !hasGoogleKey;
          const note = unavailableNote(s.id);
          return (
            <PressableScale
              key={s.id}
              accessibilityRole="radio"
              accessibilityLabel={s.name}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              haptic="selection"
              onPress={() => setMapSource(s.id)}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <Icon icon={s.id === 'google' ? LuMap : LuGlobe} size={Size.iconSm} color={theme.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowValue, { color: theme.text }]}>{s.name}</Text>
                <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                  {disabled ? 'No Google API key in this build.' : s.summary}
                </Text>
                {!disabled && note && <Text style={[styles.rowLabel, styles.note, { color: theme.text }]}>{note}</Text>}
              </View>
              <View style={[styles.radio, { borderColor: selected ? theme.text : theme.border }]}>
                {selected && <View style={[styles.radioDot, { backgroundColor: theme.text }]} />}
              </View>
            </PressableScale>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Applies to the map, place search and routing on this phone. Rides work the same either way, and
        riders in one group can use different sources.
      </Text>

      <Button label="Sign out" icon={LuLogOut} onPress={logOut} style={styles.signOut} />

      <Text style={[styles.section, { color: theme.text }]}>About</Text>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        revon {Constants.expoConfig?.version}
        {'\n'}Backend: {isFirebaseConfigured ? 'connected' : 'not configured'}
        {error ? `\n${error}` : ''}
      </Text>
    </ScrollView>
  );
}

function Row({ icon, label, value, badge }: { icon: IconType; label: string; value: string; badge?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Icon icon={icon} size={Size.iconSm} color={theme.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: theme.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {badge && (
        <View style={[styles.badge, { borderColor: theme.border }]}>
          <Icon icon={LuShieldCheck} size={12} color={theme.text} />
          <Text style={[styles.badgeText, { color: theme.text }]}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: 80 },
  section: { fontSize: Type.title, fontWeight: '700', marginTop: 12 },
  hint: { fontSize: Type.tiny + 1, lineHeight: 17 },
  card: { borderRadius: Size.radius, paddingHorizontal: 12, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowLabel: { fontSize: Type.tiny + 1 },
  rowValue: { fontSize: Type.small + 1, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, height: 22 },
  badgeText: { fontSize: Type.tiny, fontWeight: '700' },
  note: { marginTop: 2, fontWeight: '600' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  signOut: { marginTop: 8 },
});
