import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { LuArrowLeft } from 'react-icons/lu';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { Size, TextStyles, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EASE_OUT, Timing } from '@/lib/motion';

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

// Mount-only entrance: brand, title, subtitle, form arrive in reading order, 40ms apart, each a fade
// with a 12pt rise. Builders are instances, so each element gets its own (delay mutates in place).
const STAGGER_MS = 40;
const enter = (order: number) =>
  FadeInDown.duration(Timing.enter.duration)
    .easing(EASE_OUT)
    .delay(order * STAGGER_MS)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })
    .reduceMotion(ReduceMotion.System);
const BRAND_IN = enter(0);
const TITLE_IN = enter(1);
const SUBTITLE_IN = enter(2);
const FORM_IN = enter(3);
const STEP_IN = FadeIn.duration(Timing.enter.duration).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

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
          {step && (
            // Keyed on the text so a new step crossfades in instead of flipping.
            <Animated.Text key={step} entering={STEP_IN} style={[TextStyles.label, { color: theme.textSecondary }]}>
              {step}
            </Animated.Text>
          )}
        </View>
        <Animated.Text entering={BRAND_IN} style={[styles.brand, { color: theme.text }]}>
          revon
        </Animated.Text>
        <Animated.Text entering={TITLE_IN} style={[TextStyles.display, styles.title, { color: theme.text }]}>
          {title}
        </Animated.Text>
        {subtitle ? (
          <Animated.Text entering={SUBTITLE_IN} style={[TextStyles.body, styles.subtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Animated.Text>
        ) : null}
        <Animated.View entering={FORM_IN} style={styles.form}>
          {children}
        </Animated.View>
      </ScrollView>
      {footer && <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: -8 },
  brand: { fontSize: Type.small, fontWeight: '900', letterSpacing: 1, marginTop: 12, opacity: 0.5 },
  title: { marginTop: 4 },
  subtitle: { marginTop: 6 },
  form: { gap: 14, marginTop: 22 },
  footer: { paddingHorizontal: 20, paddingTop: 10, gap: 10 },
});
