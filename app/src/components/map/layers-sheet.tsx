import { Platform, StyleSheet, Text, View } from 'react-native';
import type { IconType } from 'react-icons';
import { LuBike, LuBuilding2, LuMap, LuMountain, LuSatellite, LuTrafficCone } from 'react-icons/lu';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SheetModal } from '@/components/ui/sheet';
import { transition } from '@/components/ui/transition';
import { Size, TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type MapLayers, type MapType, setMapLayers, useMapLayers } from '@/lib/map-layers';
import { MAP_SOURCES, useMapCapabilities, useMapSource } from '@/lib/map-source';

const TYPES: { type: MapType; label: string; icon: IconType }[] = [
  { type: 'default', label: 'Default', icon: LuMap },
  { type: 'satellite', label: 'Satellite', icon: LuSatellite },
  { type: 'terrain', label: 'Terrain', icon: LuMountain },
];

const DETAILS: { key: keyof Omit<MapLayers, 'type'>; label: string; icon: IconType }[] = [
  { key: 'traffic', label: 'Traffic', icon: LuTrafficCone },
  { key: 'buildings', label: '3D buildings', icon: LuBuilding2 },
  { key: 'bicycling', label: 'Bicycling', icon: LuBike },
];

/** Why a tile is greyed out with the current map source (see MAP_CAPABILITIES). */
const UNAVAILABLE: Record<string, string> = {
  traffic: 'Google Maps only',
  bicycling: Platform.OS === 'web' ? 'Not available' : 'Web only',
};

type Props = { visible: boolean; onDismiss: () => void };

/** Map type and map details picker, like the Layers sheet in Google Maps. Keep mounted; flip `visible`. */
export function LayersSheet({ visible, onDismiss }: Props) {
  const theme = useTheme();
  const layers = useMapLayers();
  const caps = useMapCapabilities();
  const source = useMapSource();

  // Nothing scrolls inside, so the whole sheet is the drag area.
  return (
    <SheetModal visible={visible} onDismiss={onDismiss} title="Map type" dragArea="sheet">
      <View style={styles.content}>
        <View style={styles.row}>
          {TYPES.map((t) => (
            <Tile
              key={t.type}
              label={t.label}
              icon={t.icon}
              selected={layers.type === t.type}
              disabled={t.type !== 'default' && !caps[t.type]}
              caption={t.type !== 'default' && !caps[t.type] ? 'Not available' : undefined}
              onPress={() => setMapLayers({ type: t.type })}
            />
          ))}
        </View>

        <Text style={[TextStyles.title, styles.section, { color: theme.text }]}>Map details</Text>
        <View style={styles.row}>
          {DETAILS.map((d) => {
            const unavailable = !caps[d.key];
            return (
              <Tile
                key={d.key}
                label={d.label}
                icon={d.icon}
                selected={!unavailable && layers[d.key]}
                disabled={unavailable}
                caption={unavailable ? (UNAVAILABLE[d.key] ?? 'Not available') : undefined}
                onPress={() => setMapLayers({ [d.key]: !layers[d.key] })}
              />
            );
          })}
        </View>

        <Text style={[TextStyles.tiny, styles.source, { color: theme.textSecondary }]}>
          Map data: {MAP_SOURCES.find((s) => s.id === source)?.name}. Change the map source in Settings.
        </Text>
      </View>
    </SheetModal>
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

/** Selected tiles invert (monochrome), with the colours crossing over in a CSS transition. */
function Tile({ label, icon, selected, onPress, disabled, caption }: TileProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      haptic="selection"
      onPress={onPress}
      style={styles.tile}>
      <Animated.View
        style={[
          styles.tileIcon,
          transition(['backgroundColor', 'borderColor'], 'toggle', reduced),
          {
            backgroundColor: selected ? theme.inverse : theme.backgroundElement,
            borderColor: selected ? theme.inverse : theme.border,
          },
        ]}>
        <Icon icon={icon} size={20} color={selected ? theme.onInverse : theme.text} />
      </Animated.View>
      <Text style={[TextStyles.label, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      {caption && <Text style={[TextStyles.tiny, styles.caption, { color: theme.textSecondary }]}>{caption}</Text>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 6, gap: 10 },
  section: { marginTop: 6 },
  source: { marginTop: 2 },
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
  caption: { marginTop: -4 },
});
