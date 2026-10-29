/**
 * Google Maps backend for Android and iOS (react-native-maps with the Google provider). Implements
 * the map contract in types.ts; screens import from map-view.tsx and never see this file.
 *
 * The map follows the app theme (dark map style in dark mode), and marker labels use a themed
 * callout instead of the default white bubble.
 */
import { useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RNMapView, {
  Callout,
  type MapStyleElement,
  Marker as RNMarker,
  Polyline as RNPolyline,
  PROVIDER_GOOGLE,
} from 'react-native-maps';

import { Size, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useMapLayers } from '@/lib/map-layers';

import type { MapViewProps, MarkerProps, PolylineProps } from './types';

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

const NATIVE_TYPE = { default: 'standard', satellite: 'hybrid', terrain: 'terrain' } as const;

export function MapView({ ref, children, onPanDrag, onRegionChangeComplete, ...props }: MapViewProps) {
  const dark = useColorScheme() === 'dark';
  const layers = useMapLayers();
  const inner = useRef<RNMapView | null>(null);
  // Once per gesture: the SDK reports every camera step, and `onPanDrag` alone misses pinches and twists.
  const gesture = useRef(false);

  // The contract promises a complete camera; the SDK leaves fields it doesn't know undefined.
  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (region, duration) => inner.current?.animateToRegion(region, duration),
      animateCamera: (camera, opts) => inner.current?.animateCamera(camera, opts),
      fitToCoordinates: (coords, opts) => inner.current?.fitToCoordinates(coords, opts),
      getCamera: async () => {
        const c = await inner.current?.getCamera();
        return {
          center: c?.center ?? { latitude: 0, longitude: 0 },
          heading: c?.heading ?? 0,
          pitch: c?.pitch ?? 0,
          zoom: c?.zoom ?? 15,
        };
      },
    }),
    [],
  );

  // 3D buildings only show when the map is tilted, so tilt when they're switched on.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    inner.current?.animateCamera({ pitch: layers.buildings ? 45 : 0 }, { duration: 500 });
  }, [layers.buildings]);

  return (
    <RNMapView
      ref={inner}
      provider={PROVIDER_GOOGLE}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      mapType={NATIVE_TYPE[layers.type]}
      showsTraffic={layers.traffic}
      showsBuildings={layers.buildings}
      // The dark style only applies to the default map; satellite and terrain keep their imagery.
      customMapStyle={dark && layers.type === 'default' ? DARK_STYLE : []}
      userInterfaceStyle={dark ? 'dark' : 'light'}
      {...props}
      onRegionChange={(_region, details) => {
        if (!details?.isGesture || gesture.current) return;
        gesture.current = true;
        onPanDrag?.();
      }}
      onRegionChangeComplete={() => {
        gesture.current = false;
        onRegionChangeComplete?.();
      }}>
      {children}
    </RNMapView>
  );
}

/** Marker whose title/description show in a small themed label instead of the default bubble. */
export function Marker({ title, description, onCalloutPress, children, ...props }: MarkerProps) {
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

export function Polyline(props: PolylineProps) {
  return <RNPolyline {...props} />;
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
