/// <reference types="google.maps" />
/**
 * Web version of the map components, built on the Google Maps JavaScript API. Implements only the
 * subset of the react-native-maps API that the app uses, with the same prop names, so screens don't
 * need platform checks.
 *
 * Requires "Maps JavaScript API" enabled on the key, and the key must allow the site's referrer
 * (e.g. http://localhost:8081/* during development).
 */
import {
  AdvancedMarker,
  APIProvider,
  ColorScheme,
  Map,
  Pin,
  Polyline as GPolyline,
  RenderingType,
  useMap,
} from '@vis.gl/react-google-maps';
import Constants from 'expo-constants';
import {
  createContext,
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { type MapLayers, useMapLayers } from '@/lib/map-layers';

const API_KEY: string = Constants.expoConfig?.extra?.googleApiKey ?? '';
// Advanced markers need a map id; Google's demo id is fine for development.
const MAP_ID = 'DEMO_MAP_ID';

export const PROVIDER_GOOGLE = 'google';

/** Which marker's label is open; only one at a time, and tapping the map closes it. */
const OpenLabel = createContext<{ openId: string | null; setOpenId: (id: string | null) => void }>({
  openId: null,
  setOpenId: () => {},
});

type LatLng = { latitude: number; longitude: number };
type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };
type EdgePadding = { top: number; right: number; bottom: number; left: number };

type Camera = { center: LatLng; heading: number; pitch: number; zoom: number };

export type MapRef = {
  animateToRegion(region: Region, duration?: number): void;
  animateCamera(camera: Partial<Camera>, opts?: { duration?: number }): void;
  getCamera(): Promise<Camera>;
  fitToCoordinates(coordinates?: LatLng[], options?: { edgePadding?: EdgePadding; animated?: boolean }): void;
};

const toLiteral = (p: LatLng): google.maps.LatLngLiteral => ({ lat: p.latitude, lng: p.longitude });
const zoomFor = (latitudeDelta: number) =>
  Math.round(Math.max(2, Math.min(20, Math.log2(360 / Math.max(latitudeDelta, 1e-6)))));

const WEB_TYPE = { default: 'roadmap', satellite: 'hybrid', terrain: 'terrain' } as const;

/** Traffic and bicycling overlays, and tilting for 3D buildings (vector maps draw them when tilted). */
function LayersController({ layers }: { layers: MapLayers }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !layers.traffic) return;
    const layer = new google.maps.TrafficLayer();
    layer.setMap(map);
    return () => layer.setMap(null);
  }, [map, layers.traffic]);

  useEffect(() => {
    if (!map || !layers.bicycling) return;
    const layer = new google.maps.BicyclingLayer();
    layer.setMap(map);
    return () => layer.setMap(null);
  }, [map, layers.bicycling]);

  const mounted = useRef(false);
  useEffect(() => {
    if (!map) return;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    map.moveCamera({ tilt: layers.buildings ? 45 : 0 });
  }, [map, layers.buildings]);

  return null;
}

function CameraController({ handle, padding }: { handle?: Ref<MapRef>; padding?: EdgePadding }) {
  const map = useMap();
  useImperativeHandle(
    handle,
    () => ({
      animateToRegion(region) {
        if (!map) return;
        map.panTo(toLiteral(region));
        map.setZoom(zoomFor(region.latitudeDelta));
      },
      getCamera() {
        const c = map?.getCenter();
        return Promise.resolve({
          center: { latitude: c?.lat() ?? 0, longitude: c?.lng() ?? 0 },
          heading: map?.getHeading() ?? 0,
          pitch: map?.getTilt() ?? 0,
          zoom: map?.getZoom() ?? 0,
        });
      },
      animateCamera(camera) {
        if (!map) return;
        // Heading and tilt need vector rendering; raster maps ignore them.
        map.moveCamera({
          ...(camera.center ? { center: toLiteral(camera.center) } : {}),
          ...(camera.heading != null ? { heading: camera.heading } : {}),
          ...(camera.pitch != null ? { tilt: camera.pitch } : {}),
          ...(camera.zoom != null ? { zoom: camera.zoom } : {}),
        });
      },
      fitToCoordinates(coordinates = [], options) {
        if (!map || !coordinates.length) return;
        if (coordinates.length === 1) {
          map.panTo(toLiteral(coordinates[0]));
          map.setZoom(15);
          return;
        }
        const bounds = new google.maps.LatLngBounds();
        coordinates.forEach((c) => bounds.extend(toLiteral(c)));
        map.fitBounds(bounds, options?.edgePadding ?? padding ?? 40);
      },
    }),
    [map, padding],
  );
  return null;
}

type MapViewProps = {
  ref?: Ref<MapRef>;
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  mapPadding?: EdgePadding;
  onUserLocationChange?: (e: { nativeEvent: { coordinate?: LatLng & { heading: number; speed: number } } }) => void;
  onLongPress?: (e: { nativeEvent: { coordinate: LatLng } }) => void;
  onPanDrag?: () => void;
  /** Fires when the camera settles (pan, zoom, rotate or animation finished). */
  onRegionChangeComplete?: () => void;
  children?: ReactNode;
  // Accepted for parity with react-native-maps; no effect on web.
  provider?: string;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  toolbarEnabled?: boolean;
};

export function MapView({
  ref,
  style,
  initialRegion,
  showsUserLocation,
  mapPadding,
  onUserLocationChange,
  onLongPress,
  onPanDrag,
  onRegionChangeComplete,
  children,
}: MapViewProps) {
  const [me, setMe] = useState<LatLng | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const dark = useColorScheme() === 'dark';
  const layers = useMapLayers();

  // Keep the latest callback without re-subscribing to geolocation on every render.
  const onUserLocationRef = useRef(onUserLocationChange);
  useEffect(() => {
    onUserLocationRef.current = onUserLocationChange;
  });

  useEffect(() => {
    if (!showsUserLocation || !('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMe(c);
        onUserLocationRef.current?.({
          nativeEvent: { coordinate: { ...c, heading: pos.coords.heading ?? -1, speed: pos.coords.speed ?? -1 } },
        });
      },
      () => {},
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [showsUserLocation]);

  return (
    <View style={style}>
      <APIProvider apiKey={API_KEY}>
        <Map
          style={{ width: '100%', height: '100%' }}
          mapId={MAP_ID}
          renderingType={RenderingType.VECTOR}
          mapTypeId={WEB_TYPE[layers.type]}
          onDragstart={() => onPanDrag?.()}
          onIdle={() => onRegionChangeComplete?.()}
          defaultCenter={initialRegion ? toLiteral(initialRegion) : { lat: 20, lng: 0 }}
          defaultZoom={initialRegion ? zoomFor(initialRegion.latitudeDelta) : 2}
          disableDefaultUI
          clickableIcons={false}
          gestureHandling="greedy"
          // Follows the app theme: dark map in dark mode, light map in light mode.
          colorScheme={dark ? ColorScheme.DARK : ColorScheme.LIGHT}
          onClick={() => setOpenId(null)}
          // Right-click on desktop, long-press on touch screens.
          onContextmenu={(e) => {
            const p = e.detail.latLng;
            if (p) onLongPress?.({ nativeEvent: { coordinate: { latitude: p.lat, longitude: p.lng } } });
          }}>
          <CameraController handle={ref} padding={mapPadding} />
          <LayersController layers={layers} />
          {showsUserLocation && me && (
            <AdvancedMarker position={toLiteral(me)} zIndex={50} anchorLeft="-50%" anchorTop="-50%" clickable={false}>
              <div style={userDot} />
            </AdvancedMarker>
          )}
          <OpenLabel.Provider value={{ openId, setOpenId }}>{children}</OpenLabel.Provider>
        </Map>
      </APIProvider>
    </View>
  );
}

const userDot = {
  width: 18,
  height: 18,
  borderRadius: 9,
  background: '#1A73E8',
  border: '3px solid #fff',
  boxShadow: '0 0 0 6px rgba(26,115,232,0.2)',
};

type MarkerProps = {
  coordinate: LatLng;
  title?: string;
  description?: string;
  pinColor?: string;
  anchor?: { x: number; y: number };
  zIndex?: number;
  onPress?: () => void;
  onCalloutPress?: () => void;
  children?: ReactNode;
  // Native-only rendering hint.
  tracksViewChanges?: boolean;
};

export function Marker({ coordinate, title, description, pinColor, anchor, zIndex, onPress, onCalloutPress, children }: MarkerProps) {
  const theme = useTheme();
  const id = useId();
  const { openId, setOpenId } = useContext(OpenLabel);
  const hasInfo = Boolean(title || description);
  const open = hasInfo && openId === id;

  return (
    <AdvancedMarker
      position={toLiteral(coordinate)}
      zIndex={open ? 2000 : zIndex}
      anchorLeft={anchor ? `${-anchor.x * 100}%` : undefined}
      anchorTop={anchor ? `${-anchor.y * 100}%` : undefined}
      onClick={() => {
        onPress?.();
        if (hasInfo) setOpenId(open ? null : id);
      }}>
      {/* The label is positioned above the marker so opening it doesn't move the anchor. */}
      <div style={{ position: 'relative' }}>
        {open && (
          <div
            role={onCalloutPress ? 'button' : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (!onCalloutPress) return;
              onCalloutPress();
              setOpenId(null);
            }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translate(-50%, -6px)',
              whiteSpace: 'nowrap',
              maxWidth: 220,
              padding: '6px 10px',
              borderRadius: 10,
              background: theme.surface,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              fontSize: 13,
              lineHeight: '17px',
              cursor: onCalloutPress ? 'pointer' : 'default',
            }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
            {description ? <div style={{ color: theme.textSecondary, fontSize: 11 }}>{description}</div> : null}
          </div>
        )}
        {children ?? <Pin background={pinColor} borderColor={pinColor} glyphColor="#fff" />}
      </div>
    </AdvancedMarker>
  );
}

type PolylineProps = { coordinates: LatLng[]; strokeColor?: string; strokeWidth?: number; zIndex?: number };

export function Polyline({ coordinates, strokeColor, strokeWidth, zIndex }: PolylineProps) {
  return (
    <GPolyline
      path={coordinates.map(toLiteral)}
      strokeColor={strokeColor}
      strokeWeight={strokeWidth}
      strokeOpacity={1}
      zIndex={zIndex}
    />
  );
}
