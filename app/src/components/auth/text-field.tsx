import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import type { IconType } from 'react-icons';
import { LuEye, LuEyeOff } from 'react-icons/lu';

import { Icon } from '@/components/ui/icon';
import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & {
  label: string;
  icon?: IconType;
  /** Shown under the field; also turns the border red. */
  error?: string | null;
  /** Adds a show/hide toggle for passwords. */
  password?: boolean;
  /** Custom content before the input (e.g. a country code button). */
  left?: ReactNode;
};

export function TextField({ label, icon, error, password, left, style, onBlur, onFocus, ...input }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? theme.danger : focused ? theme.text : theme.border;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View style={[styles.field, { borderColor, backgroundColor: theme.backgroundElement }]}>
        {left}
        {icon && <Icon icon={icon} size={Size.iconSm} color={theme.textSecondary} />}
        <TextInput
          {...input}
          accessibilityLabel={label}
          secureTextEntry={password ? hidden : input.secureTextEntry}
          placeholderTextColor={theme.muted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: theme.text }, style]}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}>
            <Icon icon={hidden ? LuEye : LuEyeOff} size={Size.iconSm} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: Type.small - 1, fontWeight: '600' },
  field: {
    height: Size.control + 4,
    borderRadius: Size.radius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, height: '100%', fontSize: Type.body },
  error: { fontSize: Type.tiny + 1, fontWeight: '500' },
});
