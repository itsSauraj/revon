import { StyleSheet, View } from 'react-native';
import { LuNavigation2 } from 'react-icons/lu';

import { Marker } from '@/components/map/map-view';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import type { LatLng } from '@/lib/types';

type Props = {
  coordinate: LatLng;
  /** Degrees clockwise from the top of the screen: the rider's heading minus the map's heading. */
  rotation: number;
};

const SIZE = 44;

/**
 * The rider in the ride view: an accent disc with an arrow along the direction of travel. In
 * heading-up mode the map turns with the rider, so the arrow points at the top of the phone; in
 * north-up mode, or after the rider pans away, it turns to the real heading instead. Rotation is
 * applied per fix without animation; a transition would spin the long way round through north.
 */
export function NavPuck({ coordinate, rotation }: Props) {
  const theme = useTheme();
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} zIndex={900} tracksViewChanges>
      <View style={[styles.puck, { backgroundColor: theme.accent, borderColor: theme.onAccent, transform: [{ rotate: `${rotation}deg` }] }]}>
        <Icon icon={LuNavigation2} size={24} color={theme.onAccent} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  puck: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
