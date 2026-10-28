import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import Animated, { LayoutAnimationConfig, useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated';

import { Size, TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { OTP_LENGTH } from '@/lib/validation';

import { FOCUS_TRANSITION, POP_IN, shakeSequence } from './field-motion';

type Props = {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  autoFocus?: boolean;
  /** The screen's failed-verification counter: each new value shakes the row once. */
  shakeKey?: number;
};

/**
 * Six boxes backed by one hidden input, so paste and SMS autofill (Android/iOS one-time-code)
 * fill all digits at once.
 */
export function OtpInput({ value, onChange, error, autoFocus, shakeKey = 0 }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const input = useRef<TextInput>(null);
  const shakeX = useSharedValue(0);
  const shaken = useRef(0);
  const digits = value.split('');

  useEffect(() => {
    if (!shakeKey || shakeKey === shaken.current) return;
    shaken.current = shakeKey;
    if (!reduced) shakeX.set(shakeSequence());
  }, [shakeKey, reduced, shakeX]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.get() }] }));

  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Verification code">
      {/* Digits already present when the screen opens (SMS auto-read) don't pop; typed or pasted ones do. */}
      <LayoutAnimationConfig skipEntering>
        <Animated.View style={[styles.row, rowStyle]}>
          {Array.from({ length: OTP_LENGTH }, (_, i) => {
            const active = i === Math.min(value.length, OTP_LENGTH - 1);
            const digit = digits[i];
            return (
              <Animated.View
                key={i}
                style={[
                  styles.box,
                  FOCUS_TRANSITION,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: error ? theme.danger : active ? theme.text : theme.border,
                  },
                ]}>
                {digit ? (
                  <Animated.Text entering={POP_IN} style={[TextStyles.headline, styles.digit, { color: theme.text }]}>
                    {digit}
                  </Animated.Text>
                ) : null}
              </Animated.View>
            );
          })}
          <TextInput
            ref={input}
            value={value}
            onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={OTP_LENGTH}
            autoFocus={autoFocus}
            caretHidden
            style={styles.hidden}
          />
        </Animated.View>
      </LayoutAnimationConfig>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1,
    height: Size.control + 10,
    borderRadius: Size.radius,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontVariant: ['tabular-nums'] },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
