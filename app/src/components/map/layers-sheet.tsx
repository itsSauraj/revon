import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { IconType } from 'react-icons';
import { LuBike, LuBuilding2, LuMap, LuMountain, LuSatellite, LuTrafficCone, LuX } from 'react-icons/lu';

import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type MapLayers, type MapType, setMapLayers, useMapLayers } from '@/lib/map-layers';

const TYPES: { type: MapType; label: string; icon: IconType }[] = [
  { type: 'default', label: 'Default', icon: LuMap },
  { type: 'satellite', label: 'Satellite', icon: LuSatellite },
  { type: 'terrain', label: 'Terrain', icon: LuMountain },
];

const DETAILS: { key: keyof Omit<MapLayers, 'type'>; label: string; icon: IconType; webOnly?: boolean }[] = [
  { key: 'traffic', label: 'Traffic', icon: LuTrafficCone },
  { key: 'buildings', label: '3D buildings', icon: LuBuilding2 },
  { key: 'bicycling', label: 'Bicycling', icon: LuBike, webOnly: true },
];

/** Map type and map details picker, like the Layers sheet in Google Maps. */
export function LayersSheet({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const layers = useMapLayers();

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Map type</Text>
          <IconButton icon={LuX} variant="ghost" size={Size.controlSm} accessibilityLabel="Close" onPress={onClose} />
        </View>
        <View style={styles.row}>
          {TYPES.map((t) => (
            <Tile
              key={t.type}
              label={t.label}
              icon={t.icon}
              selected={layers.type === t.type}
              onPress={() => setMapLayers({ type: t.type })}
            />
          ))}
        </View>

        <Text style={[styles.title, styles.section, { color: theme.text }]}>Map details</Text>
        <View style={styles.row}>
          {DETAILS.map((d) => {
            const unavailable = d.webOnly && Platform.OS !== 'web';
            return (
              <Tile
                key={d.key}
                label={d.label}
                icon={d.icon}
                selected={!unavailable && layers[d.key]}
                disabled={unavailable}
                caption={unavailable ? 'Web only' : undefined}
                onPress={() => setMapLayers({ [d.key]: !layers[d.key] })}
              />
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

type TileProps = {
  label: string;
  icon: IconType;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  caption?: string;
};

function Tile({ label, icon, selected, onPress, disabled, caption }: TileProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}>
      <View
        style={[
          styles.tileIcon,
          {
            backgroundColor: selected ? theme.inverse : theme.backgroundElement,
            borderColor: selected ? theme.inverse : theme.border,
          },
        ]}>
        <Icon icon={icon} size={20} color={selected ? theme.onInverse : theme.text} />
      </View>
      <Text style={[styles.tileLabel, { color: theme.text, fontWeight: selected ? '700' : '500' }]} numberOfLines={1}>
        {label}
      </Text>
      {caption && <Text style={[styles.caption, { color: theme.textSecondary }]}>{caption}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    padding: 16,
    paddingBottom: 28,
    borderTopLeftRadius: Size.radiusLg,
    borderTopRightRadius: Size.radiusLg,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: Type.body, fontWeight: '700' },
  section: { marginTop: 6 },
  row: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, alignItems: 'center', gap: 6 },
  tileIcon: {
    width: '100%',
    height: 56,
    borderRadius: Size.radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: Type.small - 1 },
  caption: { fontSize: Type.tiny - 1, marginTop: -4 },
});
