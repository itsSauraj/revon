import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { AuthScreen } from '@/components/auth/auth-screen';
import { FADE_IN } from '@/components/auth/field-motion';
import { OtpInput } from '@/components/auth/otp-input';
import { Button } from '@/components/ui/button';
import { TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { startPhoneVerification } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { haptic } from '@/lib/motion';
import { getPendingPhone, setPendingPhone } from '@/lib/phone-flow';
import { refreshUser, saveProfile } from '@/lib/session';
import { OTP_LENGTH, validateOtp } from '@/lib/validation';

const RESEND_AFTER_S = 60;

export default function VerifyOtp() {
  const theme = useTheme();
  const [pending, setPending] = useState(getPendingPhone);
  const [code, setCode] = useState(pending?.verification.autoCode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Wrong codes so far: each one shakes the boxes once, with the error haptic.
  const [attempt, setAttempt] = useState(0);
  const [cooldown, setCooldown] = useState(RESEND_AFTER_S);
  const submitted = useRef<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const verify = useCallback(
    async (value: string) => {
      if (!pending) return;
      const fail = (message: string) => {
        setError(message);
        setAttempt((a) => a + 1);
        haptic.error();
      };
      const invalid = validateOtp(value);
      if (invalid) {
        fail(invalid);
        return;
      }
      submitted.current = value;
      setBusy(true);
      setError(null);
      try {
        await pending.verification.confirm(value);
        // Phone is now linked to the account: the session moves on as soon as the user is re-read,
        // so the success tick lands on the same frame as the screen change.
        await refreshUser();
        haptic.success();
        await saveProfile({ name: pending.name, sharePhone: pending.sharePhone });
        setPendingPhone(null);
      } catch (e) {
        fail(authErrorMessage(e));
        submitted.current = null;
      } finally {
        setBusy(false);
      }
    },
    [pending],
  );

  // Submit automatically once all digits are in (typed, pasted or read from the SMS).
  useEffect(() => {
    if (code.length === OTP_LENGTH && submitted.current !== code && !busy) verify(code);
  }, [code, busy, verify]);

  const resend = async () => {
    if (!pending) return;
    setError(null);
    try {
      const verification = await startPhoneVerification(pending.e164, true);
      const next = { ...pending, verification };
      setPendingPhone(next);
      setPending(next);
      setCode(verification.autoCode ?? '');
      setCooldown(RESEND_AFTER_S);
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  // Opened without a pending number (e.g. after an app restart): start over.
  if (!pending) return <Redirect href="/auth/phone" />;

  return (
    <AuthScreen
      title="Enter the code"
      subtitle={`We sent a ${OTP_LENGTH}-digit code by SMS to ${pending.pretty}.`}
      onBack={() => router.back()}
      footer={
        <>
          <Button label="Verify" variant="accent" loading={busy} disabled={busy || code.length < OTP_LENGTH} onPress={() => verify(code)} />
          {/* The countdown changes every second: a plain label, never animated. */}
          <Button
            label={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            disabled={cooldown > 0 || busy}
            onPress={resend}
          />
        </>
      }>
      <OtpInput value={code} onChange={setCode} error={Boolean(error)} shakeKey={attempt} autoFocus />
      {error && (
        <Animated.Text entering={FADE_IN} style={[TextStyles.small, { color: theme.danger }]}>
          {error}
        </Animated.Text>
      )}
      <Button label="Change number" variant="ghost" size="sm" style={styles.link} onPress={() => router.back()} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
