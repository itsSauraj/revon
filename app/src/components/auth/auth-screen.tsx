import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LuArrowLeft } from 'react-icons/lu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  subtitle?: string;
  /** Step indicator, e.g. "Step 2 of 3". */
  step?: string;
  onBack?: () => void;
  children: ReactNode;
  /** Pinned under the form (primary action). */
  footer?: ReactNode;
};

/** Shared layout for the sign-in and verification screens. */
export function AuthScreen({ title, subtitle, step, onBack, children, footer }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          {onBack ? (
            <IconButton icon={LuArrowLeft} variant="ghost" size={Size.controlSm} accessibilityLabel="Back" onPress={onBack} />
          ) : (
            <View style={{ height: Size.controlSm }} />
          )}
          {step && <Text style={[styles.step, { color: theme.textSecondary }]}>{step}</Text>}
        </View>
        <Text style={[styles.brand, { color: theme.text }]}>revon</Text>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
        <View style={styles.form}>{children}</View>
      </ScrollView>
      {footer && <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: -8 },
  step: { fontSize: Type.tiny + 1, fontWeight: '600' },
  brand: { fontSize: Type.small, fontWeight: '900', letterSpacing: 1, marginTop: 12, opacity: 0.5 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
  subtitle: { fontSize: Type.small + 1, lineHeight: 20, marginTop: 6 },
  form: { gap: 14, marginTop: 22 },
  footer: { paddingHorizontal: 20, paddingTop: 10, gap: 10 },
});
