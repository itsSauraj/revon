import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LuVolume2, LuX } from 'react-icons/lu';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance } from '@/lib/geo';
import type { RouteStep } from '@/lib/google';

import { maneuverIcon } from './maneuver';

type Props = {
  steps: RouteStep[];
  onClose: () => void;
  /** Optional hand-off for riders who want spoken guidance. */
  onOpenGoogleMaps?: () => void;
};

/** The full list of directions for the current route. */
export function StepsSheet({ steps, onClose, onOpenGoogleMaps }: Props) {
  const theme = useTheme();
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Directions</Text>
          <IconButton icon={LuX} variant="ghost" size={Size.controlSm} accessibilityLabel="Close" onPress={onClose} />
        </View>
        <FlatList
          data={steps}
          keyExtractor={(_, i) => String(i)}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: theme.backgroundElement }]}>
                <Icon icon={maneuverIcon(item.maneuver)} size={Size.iconSm} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.instruction, { color: theme.text }]}>{item.instruction}</Text>
                {item.distanceM > 0 && (
                  <Text style={[styles.dist, { color: theme.textSecondary }]}>{formatDistance(item.distanceM)}</Text>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.dist, { color: theme.textSecondary }]}>No directions for this route.</Text>
          }
        />
        {onOpenGoogleMaps && (
          <Button label="Spoken guidance in Google Maps" icon={LuVolume2} size="sm" onPress={onOpenGoogleMaps} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    maxHeight: '70%',
    padding: 16,
    paddingBottom: 28,
    borderTopLeftRadius: Size.radiusLg,
    borderTopRightRadius: Size.radiusLg,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: Type.title, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8, alignItems: 'flex-start' },
  iconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  instruction: { fontSize: Type.small + 1, fontWeight: '500' },
  dist: { fontSize: Type.tiny + 1, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth },
});
