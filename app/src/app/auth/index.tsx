import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FcGoogle } from 'react-icons/fc';
import { LuLock, LuMail, LuUser } from 'react-icons/lu';

import { AuthScreen } from '@/components/auth/auth-screen';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { TextField } from '@/components/auth/text-field';
import { Button } from '@/components/ui/button';
import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AuthCancelled, registerWithEmail, signInWithEmail, signInWithGoogle } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import {
  normalizeEmail,
  normalizeName,
  validateConfirmPassword,
  validateEmail,
  validateName,
  validateNewPassword,
  validateSignInPassword,
} from '@/lib/validation';

type Mode = 'signin' | 'register';

export default function AuthHome() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const register = mode === 'register';
  const errors = {
    name: register ? validateName(name) : null,
    email: validateEmail(email),
    password: register ? validateNewPassword(password) : validateSignInPassword(password),
    confirm: register ? validateConfirmPassword(password, confirm) : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  // Show a field's error once it's been left, or after a submit attempt.
  const show = (field: keyof typeof errors) => (touched[field] || submitted ? errors[field] : null);
  const touch = (field: string) => () => setTouched((t) => ({ ...t, [field]: true }));

  const switchMode = (m: Mode) => {
    setMode(m);
    setSubmitted(false);
    setTouched({});
    setFormError(null);
  };

  const google = async () => {
    setFormError(null);
    setBusy('google');
    try {
      await signInWithGoogle();
      // The session moves on to the next step by itself.
    } catch (e) {
      if (!(e instanceof AuthCancelled)) setFormError(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setSubmitted(true);
    setFormError(null);
    if (!valid) return;
    setBusy('email');
    try {
      if (register) await registerWithEmail(normalizeName(name), normalizeEmail(email), password);
      else await signInWithEmail(normalizeEmail(email), password);
    } catch (e) {
      setFormError(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthScreen
      title={register ? 'Create your account' : 'Welcome back'}
      subtitle={register ? 'Join your group rides with a revon account.' : 'Sign in to ride with your group.'}
      footer={
        <Button
          label={register ? 'Create account' : 'Sign in'}
          variant="accent"
          loading={busy === 'email'}
          disabled={busy !== null || (submitted && !valid)}
          onPress={submit}
        />
      }>
      <Button
        label="Continue with Google"
        icon={FcGoogle}
        loading={busy === 'google'}
        disabled={busy !== null}
        onPress={google}
      />

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
        <Text style={[styles.or, { color: theme.textSecondary }]}>or with email</Text>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>

      <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
        {(['signin', 'register'] as Mode[]).map((m) => {
          const on = mode === m;
          return (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => switchMode(m)}
              style={[styles.segmentBtn, on && { backgroundColor: theme.surface }]}>
              <Text style={[styles.segmentText, { color: on ? theme.text : theme.textSecondary }]}>
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {register && (
        <TextField
          label="Full name"
          icon={LuUser}
          value={name}
          onChangeText={setName}
          onBlur={touch('name')}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={40}
          error={show('name')}
        />
      )}
      <TextField
        label="Email"
        icon={LuMail}
        value={email}
        onChangeText={setEmail}
        onBlur={touch('email')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        maxLength={254}
        error={show('email')}
      />
      <TextField
        label="Password"
        icon={LuLock}
        password
        value={password}
        onChangeText={setPassword}
        onBlur={touch('password')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={register ? 'new-password' : 'current-password'}
        textContentType={register ? 'newPassword' : 'password'}
        maxLength={64}
        error={register ? (submitted ? errors.password : null) : show('password')}
      />
      {register && <PasswordChecklist password={password} />}
      {register && (
        <TextField
          label="Confirm password"
          icon={LuLock}
          password
          value={confirm}
          onChangeText={setConfirm}
          onBlur={touch('confirm')}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={64}
          error={show('confirm')}
        />
      )}

      {!register && (
        <Pressable accessibilityRole="link" onPress={() => router.push('/auth/forgot')} style={styles.forgot}>
          <Text style={[styles.link, { color: theme.text }]}>Forgot password?</Text>
        </Pressable>
      )}

      {formError && (
        <View style={[styles.formError, { borderColor: theme.danger }]}>
          <Text style={[styles.formErrorText, { color: theme.danger }]}>{formError}</Text>
        </View>
      )}

      {register && (
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          We&apos;ll email you a link to verify your address, then ask for your mobile number.
        </Text>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { fontSize: Type.tiny + 1 },
  segment: { flexDirection: 'row', borderRadius: Size.radius, padding: 3 },
  segmentBtn: { flex: 1, height: Size.controlSm - 2, borderRadius: Size.radius - 3, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: Type.small, fontWeight: '700' },
  forgot: { alignSelf: 'flex-end' },
  link: { fontSize: Type.small, fontWeight: '700', textDecorationLine: 'underline' },
  formError: { borderWidth: 1, borderRadius: Size.radius, padding: 10 },
  formErrorText: { fontSize: Type.small, fontWeight: '500' },
  note: { fontSize: Type.tiny + 1, lineHeight: 17 },
});
