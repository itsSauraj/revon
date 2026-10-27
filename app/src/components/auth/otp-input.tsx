import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { OTP_LENGTH } from '@/lib/validation';

type Props = { value: string; onChange: (v: string) => void; error?: boolean; autoFocus?: boolean };

/**
 * Six boxes backed by one hidden input, so paste and SMS autofill (Android/iOS one-time-code)
 * fill all digits at once.
 */
export function OtpInput({ value, onChange, error, autoFocus }: Props) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);
  const digits = value.split('');

  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Verification code" style={styles.row}>
      {Array.from({ length: OTP_LENGTH }, (_, i) => {
        const active = i === Math.min(value.length, OTP_LENGTH - 1);
        return (
          <View
            key={i}
            style={[
              styles.box,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: error ? theme.danger : active ? theme.text : theme.border,
              },
            ]}>
            <Text style={[styles.digit, { color: theme.text }]}>{digits[i] ?? ''}</Text>
          </View>
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
  digit: { fontSize: 22, fontWeight: '700' },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
