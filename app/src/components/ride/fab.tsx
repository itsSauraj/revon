import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'surface' | 'primary';
  style?: ViewStyle;
};

/** Round floating map button with a large hit area (usable with gloves). */
export function Fab({ label, onPress, accessibilityLabel, variant = 'surface', style }: Props) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: primary ? theme.primary : theme.surface, opacity: pressed ? 0.8 : 1 },
        style,
      ]}>
      <Text style={[styles.label, { color: primary ? theme.onPrimary : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  label: { fontSize: 22, fontWeight: '700' },
});
