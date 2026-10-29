import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LuVolume2 } from 'react-icons/lu';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SheetModal } from '@/components/ui/sheet';
import { Size, TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { externalNavName } from '@/lib/directions';
import { formatDistance } from '@/lib/geo';
import type { RouteStep } from '@/lib/types';

import { maneuverIcon } from './maneuver';

type Props = {
  steps: RouteStep[];
  visible: boolean;
  onDismiss: () => void;
  /** Optional hand-off to an installed maps app for riders who want spoken guidance. */
  onOpenExternal?: () => void;
};

/** The full list of directions for the current route. Keep mounted; flip `visible`. */
export function StepsSheet({ steps, visible, onDismiss, onOpenExternal }: Props) {
  const theme = useTheme();
  const { height: windowH } = useWindowDimensions();

  // The list scrolls, so only the grabber and title row drag the sheet.
  return (
    <SheetModal visible={visible} onDismiss={onDismiss} title="Directions" dragArea="handle">
      <FlatList
        data={steps}
        keyExtractor={(_, i) => String(i)}
        style={{ maxHeight: Math.round(windowH * 0.5) }}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: theme.backgroundElement }]}>
              <Icon icon={maneuverIcon(item.maneuver)} size={Size.iconSm} />
            </View>
            <View style={styles.flex}>
              <Text style={[TextStyles.label, { color: theme.text }]}>{item.instruction}</Text>
              {item.distanceM > 0 && (
                <Text style={[TextStyles.tiny, styles.dist, { color: theme.textSecondary }]}>{formatDistance(item.distanceM)}</Text>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={[TextStyles.small, { color: theme.textSecondary }]}>No directions for this route.</Text>}
      />
      {onOpenExternal && (
        <View style={styles.footer}>
          <Button label={`Spoken guidance in ${externalNavName()}`} icon={LuVolume2} size="sm" onPress={onOpenExternal} />
        </View>
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8, alignItems: 'flex-start' },
  iconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dist: { marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth },
  footer: { paddingHorizontal: 16, paddingTop: 10 },
});
