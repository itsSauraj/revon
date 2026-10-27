import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LuMail, LuMailCheck } from 'react-icons/lu';

import { AuthScreen } from '@/components/auth/auth-screen';
import { TextField } from '@/components/auth/text-field';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sendPasswordReset } from '@/lib/auth';
import { authErrorCode, authErrorMessage } from '@/lib/auth-errors';
import { normalizeEmail, validateEmail } from '@/lib/validation';

export default function ForgotPassword() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailError = validateEmail(email);

  const send = async () => {
    setTouched(true);
    setError(null);
    if (emailError) return;
    setBusy(true);
    try {
      await sendPasswordReset(normalizeEmail(email));
      setSent(true);
    } catch (e) {
      // Don't reveal whether an account exists for this email.
      if (authErrorCode(e) === 'auth/user-not-found') setSent(true);
      else setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send you a reset link."
      onBack={() => router.back()}
      footer={
        sent ? (
          <Button label="Back to sign in" variant="inverse" onPress={() => router.back()} />
        ) : (
          <Button label="Send reset link" variant="accent" loading={busy} disabled={busy} onPress={send} />
        )
      }>
      {sent ? (
        <View style={[styles.sent, { backgroundColor: theme.backgroundElement }]}>
          <Icon icon={LuMailCheck} size={22} />
          <Text style={[styles.sentText, { color: theme.text }]}>
            If an account exists for {normalizeEmail(email)}, a reset link is on its way. Check your inbox and spam folder.
          </Text>
        </View>
      ) : (
        <TextField
          label="Email"
          icon={LuMail}
          value={email}
          onChangeText={setEmail}
          onBlur={() => setTouched(true)}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          maxLength={254}
          error={touched ? emailError : null}
        />
      )}
      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  sent: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: Size.radius, alignItems: 'flex-start' },
  sentText: { flex: 1, fontSize: Type.small + 1, lineHeight: 20 },
  error: { fontSize: Type.small },
});
