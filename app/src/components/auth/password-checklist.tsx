import { StyleSheet, Text, View } from 'react-native';
import { LuCheck, LuCircle } from 'react-icons/lu';

import { Icon } from '@/components/ui/icon';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PASSWORD_RULES } from '@/lib/validation';

/** Live list of password rules; each turns solid once met. */
export function PasswordChecklist({ password }: { password: string }) {
  const theme = useTheme();
  return (
    <View style={styles.list}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <View key={rule.id} style={styles.row}>
            <Icon icon={ok ? LuCheck : LuCircle} size={13} color={ok ? theme.text : theme.muted} />
            <Text style={[styles.text, { color: ok ? theme.text : theme.textSecondary }]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '45%' },
  text: { fontSize: Type.tiny + 1 },
});
