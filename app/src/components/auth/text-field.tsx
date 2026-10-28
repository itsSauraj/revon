import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps } from 'react-native';
import type { IconType } from 'react-icons';
import { LuEye, LuEyeOff } from 'react-icons/lu';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { noWebOutline, Size, TextStyles, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { FADE_IN, FOCUS_TRANSITION, LABEL_TRANSITION, shakeSequence } from './field-motion';

type Props = TextInputProps & {
  label: string;
  icon?: IconType;
  /** Shown under the field; also turns the border red. */
  error?: string | null;
  /** Adds a show/hide toggle for passwords. */
  password?: boolean;
  /** Custom content before the input (e.g. a country code button). */
  left?: ReactNode;
  /**
   * The screen's failed-submit counter. Each new value shakes the field once, and only if it is
   * showing an error at that moment; typing never shakes. The screen fires the haptic.
   */
  shakeKey?: number;
};

export function TextField({ label, icon, error, password, left, style, onBlur, onFocus, shakeKey = 0, ...input }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const shakeX = useSharedValue(0);
  const shaken = useRef(0);

  const borderColor = error ? theme.danger : focused ? theme.text : theme.border;
  const labelColor = error ? theme.danger : focused ? theme.text : theme.textSecondary;

  useEffect(() => {
    if (!shakeKey || shakeKey === shaken.current) return;
    // Mark the attempt seen even when this field is fine, so an error that shows up later (on blur,
    // while typing) never shakes on its own. Reduced motion: the red border and the text say "no".
    shaken.current = shakeKey;
    if (error && !reduced) shakeX.set(shakeSequence());
  }, [shakeKey, error, reduced, shakeX]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.get() }] }));

  return (
    <Animated.View style={[styles.wrap, shakeStyle]}>
      <Animated.Text style={[TextStyles.label, LABEL_TRANSITION, { color: labelColor }]}>{label}</Animated.Text>
      <Animated.View style={[styles.field, FOCUS_TRANSITION, { borderColor, backgroundColor: theme.backgroundElement }]}>
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
      </Animated.View>
      {error ? (
        <Animated.Text entering={FADE_IN} style={[TextStyles.tiny, { color: theme.danger }]}>
          {error}
        </Animated.Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    height: Size.control + 4,
    borderRadius: Size.radius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, height: '100%', fontSize: Type.body, ...noWebOutline },
});
