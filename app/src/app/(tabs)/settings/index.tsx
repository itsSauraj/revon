import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { ProfileForm } from '@/components/profile-form';
import { useTheme } from '@/hooks/use-theme';
import { isFirebaseConfigured } from '@/lib/firebase';
import { saveProfile, useSession } from '@/lib/session';

export default function SettingsScreen() {
  const theme = useTheme();
  const { profile, uid, error } = useSession();
  const [saved, setSaved] = useState(false);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Settings' }} />
      <Text style={[styles.section, { color: theme.text }]}>Rider profile</Text>
      <ProfileForm
        initial={profile}
        submitLabel={saved ? 'Saved ✓' : 'Save'}
        onSubmit={async (p) => {
          await saveProfile(p);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
      />
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Changes apply to rides you start or join from now on.
      </Text>

      <Text style={[styles.section, { color: theme.text }]}>About</Text>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        revon {Constants.expoConfig?.version}
        {'\n'}Backend: {isFirebaseConfigured ? (uid ? 'connected' : 'signing in…') : 'not configured'}
        {error ? `\n${error}` : ''}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 8, paddingBottom: 120 },
  section: { fontSize: 20, fontWeight: '800', marginTop: 16 },
  hint: { fontSize: 13, lineHeight: 19 },
});
