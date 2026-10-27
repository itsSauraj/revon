import type { ViewStyle } from 'react-native';
import { LuNavigation2 } from 'react-icons/lu';

import { Button } from '@/components/ui/button';

/** Shown in the ride view after the rider drags the map; snaps back to following them. */
export function RecenterButton({ onPress, style }: { onPress: () => void; style?: ViewStyle }) {
  return (
    <Button
      label="Re-center"
      icon={LuNavigation2}
      variant="map"
      size="sm"
      onPress={onPress}
      style={{
        alignSelf: 'flex-start',
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        ...style,
      }}
    />
  );
}
