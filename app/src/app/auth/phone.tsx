import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { LuPhone, LuUser } from 'react-icons/lu';

import { AuthScreen } from '@/components/auth/auth-screen';
import { CountryPicker } from '@/components/auth/country-picker';
import { TextField } from '@/components/auth/text-field';
import { Button } from '@/components/ui/button';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { startPhoneVerification } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import type { Country } from '@/lib/countries';
import { setPendingPhone } from '@/lib/phone-flow';
import { signOut, useSession } from '@/lib/session';
import { defaultCountry, formatAsYouType, normalizeName, validateMobile, validateName } from '@/lib/validation';

/** Name + mobile number (validated for the chosen country), then an SMS code. */
export default function PhoneStep() {
  const theme = useTheme();
  const { user, profile } = useSession();
  const emailAccount = user?.providers.includes('password');

  const [name, setName] = useState(profile?.name ?? user?.displayName ?? '');
  const [country, setCountry] = useState<Country>(defaultCountry);
  const [number, setNumber] = useState('');
  const [sharePhone, setSharePhone] = useState(profile?.sharePhone ?? true);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = validateName(name);
  const mobile = validateMobile(number, country.code);
  const show = (f: string, e: string | null) => (touched[f] || submitted ? e : null);

  const send = async () => {
    setSubmitted(true);
    setError(null);
    if (nameError || !mobile.e164) return;
    setBusy(true);
    try {
      const verification = await startPhoneVerification(mobile.e164);
      setPendingPhone({
        name: normalizeName(name),
        sharePhone,
        e164: mobile.e164,
        pretty: `+${country.dial} ${formatAsYouType(number, country.code)}`,
        verification,
      });
      router.push('/auth/otp');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Your rider profile"
      subtitle="Your group sees your name. We verify your mobile number with a one-time SMS code."
      step={emailAccount ? 'Step 2 of 2' : 'Step 1 of 1'}
      footer={<Button label="Send code" variant="accent" loading={busy} disabled={busy} onPress={send} />}>
      <TextField
        label="Name shown to your group"
        icon={LuUser}
        value={name}
        onChangeText={setName}
        onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        autoCapitalize="words"
        autoComplete="name"
        maxLength={40}
        error={show('name', nameError)}
      />
      <TextField
        label="Mobile number"
        icon={LuPhone}
        left={
          <CountryPicker
            value={country}
            onChange={(c) => {
              setCountry(c);
              setNumber('');
            }}
          />
        }
        value={number}
        onChangeText={(t) => setNumber(formatAsYouType(t, country.code))}
        onBlur={() => setTouched((t) => ({ ...t, number: true }))}
        keyboardType="phone-pad"
        autoComplete="tel-national"
        textContentType="telephoneNumber"
        maxLength={20}
        placeholder={country.code === 'IN' ? '98765 43210' : undefined}
        error={show('number', mobile.error)}
      />
      <View style={styles.switchRow}>
        <Text style={[styles.switchText, { color: theme.text }]}>Let riders in my group call me</Text>
        <Switch
          value={sharePhone}
          onValueChange={setSharePhone}
          trackColor={{ true: theme.inverse, false: theme.border }}
          thumbColor={theme.surface}
          ios_backgroundColor={theme.border}
        />
      </View>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Your number is only shown to riders in a ride you join, and only if this is on. Standard SMS rates may apply.
      </Text>
      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      <Pressable accessibilityRole="button" onPress={() => signOut()}>
        <Text style={[styles.link, { color: theme.textSecondary }]}>Sign out</Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchText: { flex: 1, fontSize: Type.small + 1 },
  hint: { fontSize: Type.tiny + 1, lineHeight: 17 },
  error: { fontSize: Type.small },
  link: { fontSize: Type.small, fontWeight: '700', textDecorationLine: 'underline' },
});
