import { StyleSheet, Text, View } from 'react-native';
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
import { MAP_SOURCES, unavailableNote, useMapCapabilities, useMapSource } from '@/lib/map-source';

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

/** Tiles per row; rows with fewer options keep the same tile size. */
const COLUMNS = 3;

type Props = { visible: boolean; onDismiss: () => void };

/**
 * Map type and map details picker, like the Layers sheet in Google Maps. Only what the current map
 * source can draw is offered (see MAP_CAPABILITIES), and a note says what it can't, so nothing on the
 * sheet is a dead end. Keep mounted; flip `visible`.
 */
export function LayersSheet({ visible, onDismiss }: Props) {
  const theme = useTheme();
  const layers = useMapLayers();
  const caps = useMapCapabilities();
  const source = useMapSource();

  const types = TYPES.filter((t) => t.type === 'default' || caps[t.type]);
  const details = DETAILS.filter((d) => caps[d.key]);
  // A type saved under the other source may not exist here; the map then shows the default.
  const activeType = layers.type !== 'default' && !caps[layers.type] ? 'default' : layers.type;
  const note = unavailableNote(source);
  const sourceName = MAP_SOURCES.find((s) => s.id === source)?.name;

  // Nothing scrolls inside, so the whole sheet is the drag area.
  return (
    <SheetModal visible={visible} onDismiss={onDismiss} title="Map type" dragArea="sheet">
      <View style={styles.content}>
        <View style={styles.row}>
          {types.map((t) => (
            <Tile
              key={t.type}
              label={t.label}
              icon={t.icon}
              selected={activeType === t.type}
              onPress={() => setMapLayers({ type: t.type })}
            />
          ))}
          <Fillers count={COLUMNS - types.length} />
        </View>

        {details.length > 0 && (
          <>
            <Text style={[TextStyles.title, styles.section, { color: theme.text }]}>Map details</Text>
            <View style={styles.row}>
              {details.map((d) => (
                <Tile
                  key={d.key}
                  label={d.label}
                  icon={d.icon}
                  selected={layers[d.key]}
                  onPress={() => setMapLayers({ [d.key]: !layers[d.key] })}
                />
              ))}
              <Fillers count={COLUMNS - details.length} />
            </View>
          </>
        )}

        <Text style={[TextStyles.tiny, styles.source, { color: theme.textSecondary }]}>
          Map data: {sourceName}.{note ? ` ${note}` : ''} Change the map source in Settings.
        </Text>
      </View>
    </SheetModal>
  );
}

/** Empty slots that keep a short row's tiles the same width as a full one. */
function Fillers({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.tile} />
      ))}
    </>
  );
}

type TileProps = {
  label: string;
  icon: IconType;
  selected: boolean;
  onPress: () => void;
};

/** Selected tiles invert (monochrome), with the colours crossing over in a CSS transition. */
function Tile({ label, icon, selected, onPress }: TileProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  return (
    <PressableScale accessibilityLabel={label} accessibilityState={{ selected }} haptic="selection" onPress={onPress} style={styles.tile}>
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
});
