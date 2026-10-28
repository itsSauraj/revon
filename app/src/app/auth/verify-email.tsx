import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { LuMailCheck } from 'react-icons/lu';
import Animated from 'react-native-reanimated';

import { AuthScreen } from '@/components/auth/auth-screen';
import { FADE_IN } from '@/components/auth/field-motion';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Size, TextStyles } from '@/constants/theme';
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
          {/* The countdown is a plain label: it changes every second, so it must not animate. */}
          <Button
            label={cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
            disabled={cooldown > 0}
            onPress={resend}
          />
        </>
      }>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <Icon icon={LuMailCheck} size={22} />
        <Text style={[TextStyles.body, styles.cardText, { color: theme.text }]}>
          The link expires after a while. If you can&apos;t find the email, check spam or resend it.
        </Text>
      </View>
      {Platform.OS !== 'web' && (
        <Button label="Open mail app" variant="ghost" size="sm" style={styles.link} onPress={() => Linking.openURL('mailto:')} />
      )}
      {message && (
        // Keyed on the text so a new message fades in rather than swapping under the eye.
        <Animated.Text key={message} entering={FADE_IN} style={[TextStyles.small, { color: theme.textSecondary }]}>
          {message}
        </Animated.Text>
      )}
      <Button label="Use a different account" variant="ghost" size="sm" style={styles.link} onPress={() => signOut()} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: Size.radius, alignItems: 'flex-start' },
  cardText: { flex: 1 },
  link: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
