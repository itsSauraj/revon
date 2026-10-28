import { StyleSheet, Text, View } from 'react-native';
import { LuCircleDot, LuMapPin } from 'react-icons/lu';

import { Glass } from '@/components/ui/glass';
import { Icon } from '@/components/ui/icon';
import { Size, TextStyles } from '@/constants/theme';
import { useAddress } from '@/hooks/use-address';
import { useTheme } from '@/hooks/use-theme';
import type { LatLng } from '@/lib/types';

type Props = { from: LatLng | null; toName: string; toAddress?: string };

/** Bottom card of the ride view: where you started and where you're going. Materialises with the NavBar. */
export function TripCard({ from, toName, toAddress }: Props) {
  const theme = useTheme();
  const fromText = useAddress(from, 'Your starting point');

  return (
    <Glass materialize style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconCol}>
          <Icon icon={LuCircleDot} size={Size.iconSm} color={theme.textSecondary} />
          <View style={[styles.connector, { borderColor: theme.muted }]} />
        </View>
        <View style={styles.text}>
          <Text style={[TextStyles.tiny, styles.label, { color: theme.textSecondary }]}>From</Text>
          <Text style={[TextStyles.label, { color: theme.text }]} numberOfLines={1}>
            {fromText}
          </Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.iconCol}>
          <Icon icon={LuMapPin} size={Size.iconSm} color={theme.text} />
        </View>
        <View style={styles.text}>
          <Text style={[TextStyles.tiny, styles.label, { color: theme.textSecondary }]}>To</Text>
          <Text style={[TextStyles.label, { color: theme.text }]} numberOfLines={1}>
            {toName}
            {toAddress && toAddress !== toName ? ` · ${toAddress}` : ''}
          </Text>
        </View>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Size.radiusLg + 4,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  row: { flexDirection: 'row', gap: 12 },
  iconCol: { width: 18, alignItems: 'center', paddingTop: 2 },
  connector: { flex: 1, borderLeftWidth: 1.5, borderStyle: 'dotted', marginTop: 4, minHeight: 10 },
  text: { flex: 1, paddingBottom: 4 },
  label: { fontWeight: '600' },
});
