import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { IconType } from 'react-icons';

import { Marker } from '@/components/map/map-view';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import type { LatLng } from '@/lib/types';

type Props = {
  coordinate: LatLng;
  icon: IconType;
  title?: string;
  description?: string;
  onCalloutPress?: () => void;
};

/** Destination / regroup / target pin: a small disc with an icon and a pointer, in theme colors. */
export function PlaceMarker({ coordinate, icon, title, description, onCalloutPress }: Props) {
  const theme = useTheme();
  // Rasterise briefly after mount and after a theme change (see MemberMarker).
  const [settled, setSettled] = useState<string | null>(null);
  const tracking = settled !== theme.rider;
  useEffect(() => {
    const t = setTimeout(() => setSettled(theme.rider), 600);
    return () => clearTimeout(t);
  }, [theme.rider]);

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 1 }}
      title={title}
      description={description}
      onCalloutPress={onCalloutPress}
      tracksViewChanges={tracking}
      zIndex={50}>
      <View style={styles.wrap}>
        <View style={[styles.disc, { backgroundColor: theme.rider, borderColor: theme.markerBorder }]}>
          <Icon icon={icon} size={14} color={theme.riderInk} />
        </View>
        <View style={[styles.pointer, { backgroundColor: theme.rider }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: 32, height: 38 },
  disc: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointer: { width: 2, height: 8 },
});
