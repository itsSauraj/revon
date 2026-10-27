import { useTheme } from '@/hooks/use-theme';
import type { LatLng } from '@/lib/types';

import { Polyline } from './map-view';

type Props = { coordinates: LatLng[]; width?: number };

/** Route drawn in the accent color over a slightly wider dark outline, so it reads on any map type. */
export function RouteLine({ coordinates, width = 5 }: Props) {
  const theme = useTheme();
  if (coordinates.length < 2) return null;
  return (
    <>
      <Polyline coordinates={coordinates} strokeColor={theme.routeOutline} strokeWidth={width + 3} zIndex={1} />
      <Polyline coordinates={coordinates} strokeColor={theme.route} strokeWidth={width} zIndex={2} />
    </>
  );
}
