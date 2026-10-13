import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileForm } from '@/components/profile-form';
import { useTheme } from '@/hooks/use-theme';
import { saveProfile, useSession } from '@/lib/session';

export default function Onboarding() {
  const theme = useTheme();
  const { profile } = useSession();
  const { next } = useLocalSearchParams<{ next?: string }>();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.text }]}>revon</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Ride together. See your whole group on one map, get alerts when someone stops, takes a
            different road or needs help.
          </Text>
          <ProfileForm
            initial={profile}
            submitLabel="Let's ride"
            onSubmit={async (p) => {
              await saveProfile(p);
              // `next` carries a pending invite link through onboarding.
              router.replace((next as never) ?? '/');
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, gap: 8 },
  title: { fontSize: 40, fontWeight: '900', marginTop: 24 },
  subtitle: { fontSize: 16, lineHeight: 22, marginBottom: 12 },
});
