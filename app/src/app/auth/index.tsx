import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { FcGoogle } from 'react-icons/fc';
import { LuLock, LuMail, LuUser } from 'react-icons/lu';
import Animated, { LayoutAnimationConfig, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AuthScreen } from '@/components/auth/auth-screen';
import { FADE_IN, FADE_OUT, FORM_LAYOUT, TOGGLE_COLOR_TRANSITION } from '@/components/auth/field-motion';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { TextField } from '@/components/auth/text-field';
import { Button } from '@/components/ui/button';
import { Size, TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AuthCancelled, registerWithEmail, signInWithEmail, signInWithGoogle } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { haptic, Spring } from '@/lib/motion';
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
const MODES: { key: Mode; label: string }[] = [
  { key: 'signin', label: 'Sign in' },
  { key: 'register', label: 'Create account' },
];
const SEGMENT_PAD = 3;

export default function AuthHome() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  // Failed submits so far: each one shakes the fields that are in error (once) and ticks the haptic.
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Segmented control: one childless pill measured once, then moved with a spring (a finger chose it).
  const [segmentWidth, setSegmentWidth] = useState(0);
  const pillX = useSharedValue(0);
  useEffect(() => {
    pillX.set(withSpring(mode === 'register' ? segmentWidth : 0, Spring.settle));
  }, [mode, segmentWidth, pillX]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.get() }] }));
  const onSegmentLayout = (e: LayoutChangeEvent) =>
    setSegmentWidth((e.nativeEvent.layout.width - SEGMENT_PAD * 2) / MODES.length);

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
    if (m === mode) return;
    haptic.selection();
    setMode(m);
    setSubmitted(false);
    setTouched({});
    setFormError(null);
  };

  const fail = (message?: string) => {
    if (message) setFormError(message);
    setAttempt((a) => a + 1);
    haptic.error();
  };

  const google = async () => {
    setFormError(null);
    setBusy('google');
    try {
      await signInWithGoogle();
      // The session moves on to the next step by itself.
    } catch (e) {
      if (!(e instanceof AuthCancelled)) fail(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setSubmitted(true);
    setFormError(null);
    if (!valid) {
      fail();
      return;
    }
    setBusy('email');
    try {
      if (register) await registerWithEmail(normalizeName(name), normalizeEmail(email), password);
      else await signInWithEmail(normalizeEmail(email), password);
    } catch (e) {
      fail(authErrorMessage(e));
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
        <Text style={[TextStyles.tiny, { color: theme.textSecondary }]}>or with email</Text>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>

      <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]} onLayout={onSegmentLayout}>
        {segmentWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.pill, { width: segmentWidth, backgroundColor: theme.surface }, pillStyle]}
          />
        )}
        {MODES.map(({ key, label }) => {
          const on = mode === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => switchMode(key)}
              style={styles.segmentBtn}>
              <Animated.Text style={[TextStyles.label, TOGGLE_COLOR_TRANSITION, { color: on ? theme.text : theme.textSecondary }]}>
                {label}
              </Animated.Text>
            </Pressable>
          );
        })}
      </View>

      {/* The screen's own entrance covers the first render; from then on, switching mode fades the
          register-only fields in and out while their siblings slide to make room. */}
      <LayoutAnimationConfig skipEntering skipExiting>
        {register && (
          <Animated.View entering={FADE_IN} exiting={FADE_OUT} layout={FORM_LAYOUT}>
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
              shakeKey={attempt}
            />
          </Animated.View>
        )}
        <Animated.View layout={FORM_LAYOUT}>
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
            shakeKey={attempt}
          />
        </Animated.View>
        <Animated.View layout={FORM_LAYOUT}>
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
            shakeKey={attempt}
          />
        </Animated.View>
        {register && (
          <Animated.View entering={FADE_IN} exiting={FADE_OUT} layout={FORM_LAYOUT}>
            <PasswordChecklist password={password} />
          </Animated.View>
        )}
        {register && (
          <Animated.View entering={FADE_IN} exiting={FADE_OUT} layout={FORM_LAYOUT}>
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
              shakeKey={attempt}
            />
          </Animated.View>
        )}

        {!register && (
          <Animated.View entering={FADE_IN} exiting={FADE_OUT} layout={FORM_LAYOUT} style={styles.forgot}>
            <Button label="Forgot password?" variant="ghost" size="sm" onPress={() => router.push('/auth/forgot')} />
          </Animated.View>
        )}

        {formError && (
          <Animated.View entering={FADE_IN} layout={FORM_LAYOUT} style={[styles.formError, { borderColor: theme.danger }]}>
            <Text style={[TextStyles.small, { color: theme.danger }]}>{formError}</Text>
          </Animated.View>
        )}

        {register && (
          <Animated.Text
            entering={FADE_IN}
            exiting={FADE_OUT}
            layout={FORM_LAYOUT}
            style={[TextStyles.tiny, { color: theme.textSecondary }]}>
            We&apos;ll email you a link to verify your address, then ask for your mobile number.
          </Animated.Text>
        )}
      </LayoutAnimationConfig>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  segment: { flexDirection: 'row', borderRadius: Size.radius, padding: SEGMENT_PAD },
  // Childless and absolutely positioned: the one element whose width may be set outside the flow.
  pill: {
    position: 'absolute',
    top: SEGMENT_PAD,
    bottom: SEGMENT_PAD,
    left: SEGMENT_PAD,
    borderRadius: Size.radius - SEGMENT_PAD,
  },
  segmentBtn: { flex: 1, height: Size.controlSm - 2, alignItems: 'center', justifyContent: 'center' },
  forgot: { alignSelf: 'flex-end' },
  formError: { borderWidth: 1, borderRadius: Size.radius, padding: 10 },
});
