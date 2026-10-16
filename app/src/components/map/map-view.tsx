/**
 * Map components used by the app. On Android and iOS these wrap react-native-maps (Google provider);
 * on web, map-view.web.tsx provides the same subset on top of the Google Maps JavaScript API.
 *
 * The map follows the app theme (dark map style in dark mode), and marker labels use a themed
 * callout instead of the default white bubble.
 */
import { type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RNMapView, {
  Callout,
  type MapMarkerProps,
  type MapStyleElement,
  type MapViewProps,
  Marker as RNMarker,
} from 'react-native-maps';

import { Size, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

/** Imperative map handle (animateToRegion, animateCamera, fitToCoordinates). */
export type MapRef = RNMapView;

// Monochrome dark style for Google Maps.
const DARK_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#151515' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A8A8A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#151515' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1C1C1C' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1A1E1A' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2C2C2C' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1F1F1F' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#3A3A3A' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9A9A9A' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#202020' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B0B0B' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4A4A4A' }] },
];

export function MapView({ ref, ...props }: MapViewProps & { ref?: Ref<RNMapView> }) {
  const dark = useColorScheme() === 'dark';
  return <RNMapView ref={ref} customMapStyle={dark ? DARK_STYLE : []} userInterfaceStyle={dark ? 'dark' : 'light'} {...props} />;
}

/** Marker whose title/description show in a small themed label instead of the default bubble. */
export function Marker({ title, description, onCalloutPress, children, ...props }: MapMarkerProps) {
  const theme = useTheme();
  return (
    <RNMarker {...props}>
      {children}
      {title ? (
        <Callout tooltip onPress={onCalloutPress}>
          <View style={[styles.label, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {title}
            </Text>
            {description ? (
              <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={1}>
                {description}
              </Text>
            ) : null}
          </View>
        </Callout>
      ) : null}
    </RNMarker>
  );
}

const styles = StyleSheet.create({
  label: {
    maxWidth: 220,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Size.radius - 2,
    borderWidth: 1,
    marginBottom: 6,
  },
  title: { fontSize: Type.small, fontWeight: '600' },
  description: { fontSize: Type.tiny },
});
