import { StyleSheet, View } from 'react-native';
import { LuCheck, LuCircle } from 'react-icons/lu';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PASSWORD_RULES } from '@/lib/validation';

import { TOGGLE_COLOR_TRANSITION, TOGGLE_OPACITY_TRANSITION } from './field-motion';

const ICON = 13;

/**
 * Live list of password rules; each turns solid once met. Rules flip on every keystroke, so the
 * change is a short colour transition and a circle→check crossfade (both icons stay mounted), no bounce.
 */
export function PasswordChecklist({ password }: { password: string }) {
  const theme = useTheme();
  return (
    <View style={styles.list}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <View key={rule.id} style={styles.row}>
            <View style={styles.iconStack}>
              <Animated.View style={[styles.iconLayer, TOGGLE_OPACITY_TRANSITION, { opacity: ok ? 0 : 1 }]}>
                <Icon icon={LuCircle} size={ICON} color={theme.muted} />
              </Animated.View>
              <Animated.View style={[styles.iconLayer, TOGGLE_OPACITY_TRANSITION, { opacity: ok ? 1 : 0 }]}>
                <Icon icon={LuCheck} size={ICON} color={theme.text} />
              </Animated.View>
            </View>
            <Animated.Text style={[TextStyles.tiny, TOGGLE_COLOR_TRANSITION, { color: ok ? theme.text : theme.textSecondary }]}>
              {rule.label}
            </Animated.Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '45%' },
  iconStack: { width: ICON, height: ICON },
  iconLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
