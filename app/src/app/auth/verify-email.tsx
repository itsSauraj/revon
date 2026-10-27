import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LuMailCheck } from 'react-icons/lu';

import { AuthScreen } from '@/components/auth/auth-screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resendVerificationEmail } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { refreshUser, signOut, useSession } from '@/lib/session';

const RESEND_AFTER_S = 60;

/** Email/password accounts must verify their address before continuing. */
export default function VerifyEmail() {
  const theme = useTheme();
  const { user } = useSession();
  const [cooldown, setCooldown] = useState(RESEND_AFTER_S);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Count down to "Resend", and quietly check for verification every few seconds.
  useEffect(() => {
    const tick = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    const poll = setInterval(() => {
      refreshUser().catch(() => {});
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, []);

  const check = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const u = await refreshUser();
      if (u && !u.emailVerified) setMessage("Not verified yet. Open the link in the email, then tap again.");
    } catch (e) {
      setMessage(authErrorMessage(e));
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    setMessage(null);
    try {
      await resendVerificationEmail();
      setCooldown(RESEND_AFTER_S);
      setMessage('Sent again. Check your inbox and spam folder.');
    } catch (e) {
      setMessage(authErrorMessage(e));
    }
  };

  return (
    <AuthScreen
      title="Verify your email"
      subtitle={`We sent a verification link to ${user?.email ?? 'your email'}. Open it to continue.`}
      step="Step 1 of 2"
      footer={
        <>
          <Button label="I've verified my email" variant="accent" loading={checking} onPress={check} />
          <Button
            label={cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
            disabled={cooldown > 0}
            onPress={resend}
          />
        </>
      }>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <Icon icon={LuMailCheck} size={22} />
        <Text style={[styles.cardText, { color: theme.text }]}>
          The link expires after a while. If you can&apos;t find the email, check spam or resend it.
        </Text>
      </View>
      {Platform.OS !== 'web' && (
        <Pressable accessibilityRole="button" onPress={() => Linking.openURL('mailto:')}>
          <Text style={[styles.link, { color: theme.text }]}>Open mail app</Text>
        </Pressable>
      )}
      {message && <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>}
      <Pressable accessibilityRole="button" onPress={() => signOut()}>
        <Text style={[styles.link, { color: theme.textSecondary }]}>Use a different account</Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: Size.radius, alignItems: 'flex-start' },
  cardText: { flex: 1, fontSize: Type.small + 1, lineHeight: 20 },
  link: { fontSize: Type.small, fontWeight: '700', textDecorationLine: 'underline' },
  message: { fontSize: Type.small },
});
