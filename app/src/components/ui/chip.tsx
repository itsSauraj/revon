import { Pressable, StyleSheet, Text } from 'react-native';
import type { IconType } from 'react-icons';

import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';

type Props = { label: string; selected?: boolean; onPress: () => void; icon?: IconType };

/** Compact toggle. Selected chips invert (monochrome), they don't use the accent. */
export function Chip({ label, selected, onPress, icon }: Props) {
  const theme = useTheme();
  const fg = selected ? theme.onInverse : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.inverse : theme.surface,
          borderColor: selected ? theme.inverse : theme.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      {icon && <Icon icon={icon} size={Size.iconSm} color={fg} />}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: Size.chip,
    borderRadius: Size.chip / 2,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: { fontSize: Type.small, fontWeight: '600' },
});
