/// <reference types="google.maps" />
/**
 * Google Maps backend for web (Google Maps JavaScript API). Implements the map contract in
 * types.ts; screens import from map-view.tsx and never see this file.
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
  type Ref,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { type MapLayers, useMapLayers } from '@/lib/map-layers';

import { type EdgePadding, type MapRef, type MapViewProps, type MarkerProps, type PolylineProps, zoomForDelta } from './types';

const API_KEY: string = Constants.expoConfig?.extra?.googleApiKey ?? '';
// Advanced markers need a map id; Google's demo id is fine for development.
const MAP_ID = 'DEMO_MAP_ID';

/** Which marker's label is open; only one at a time, and tapping the map closes it. */
const OpenLabel = createContext<{ openId: string | null; setOpenId: (id: string | null) => void }>({
  openId: null,
  setOpenId: () => {},
});

type LatLng = { latitude: number; longitude: number };
const toLiteral = (p: LatLng): google.maps.LatLngLiteral => ({ lat: p.latitude, lng: p.longitude });

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

/** Scroll-wheel zoom and two-finger gestures: the drag event alone would let a pinch fight the follow camera. */
function GestureController({ onGesture }: { onGesture?: () => void }) {
  const map = useMap();
  const latest = useRef(onGesture);
  useEffect(() => {
    latest.current = onGesture;
  });
  useEffect(() => {
    if (!map) return;
    const div = map.getDiv();
    const onWheel = () => latest.current?.();
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) latest.current?.();
    };
    div.addEventListener('wheel', onWheel, { passive: true });
    div.addEventListener('touchstart', onTouch, { passive: true });
    return () => {
      div.removeEventListener('wheel', onWheel);
      div.removeEventListener('touchstart', onTouch);
    };
  }, [map]);
  return null;
}

function CameraController({ handle, padding }: { handle?: Ref<MapRef>; padding?: EdgePadding }) {
  const map = useMap();
  // The screen may ask for the camera before the Google map instance exists (e.g. centring on the
  // rider as soon as a fix arrives). Keep the latest request and apply it once the map is ready.
  const pending = useRef<((m: google.maps.Map) => void) | null>(null);
  useEffect(() => {
    if (!map || !pending.current) return;
    const fn = pending.current;
    pending.current = null;
    fn(map);
  }, [map]);
  const run = (fn: (m: google.maps.Map) => void) => {
    if (map) fn(map);
    else pending.current = fn;
  };

  useImperativeHandle(
    handle,
    () => ({
      animateToRegion(region) {
        run((m) => {
          m.panTo(toLiteral(region));
          m.setZoom(zoomForDelta(region.latitudeDelta));
        });
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
        run((m) => {
          // Heading and tilt need vector rendering; raster maps ignore them.
          m.moveCamera({
            ...(camera.center ? { center: toLiteral(camera.center) } : {}),
            ...(camera.heading != null ? { heading: camera.heading } : {}),
            ...(camera.pitch != null ? { tilt: camera.pitch } : {}),
            ...(camera.zoom != null ? { zoom: camera.zoom } : {}),
          });
        });
      },
      fitToCoordinates(coordinates = [], options) {
        if (!coordinates.length) return;
        run((m) => {
          if (coordinates.length === 1) {
            m.panTo(toLiteral(coordinates[0]));
            m.setZoom(15);
            return;
          }
          const bounds = new google.maps.LatLngBounds();
          coordinates.forEach((c) => bounds.extend(toLiteral(c)));
          m.fitBounds(bounds, options?.edgePadding ?? padding ?? 40);
        });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, padding],
  );
  return null;
}

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

  // The camera controller only exists once the Maps API has loaded, but screens ask for the camera
  // as soon as a GPS fix arrives. Hold the controller here and queue calls made before it exists.
  const controller = useRef<MapRef | null>(null);
  const queued = useRef<((c: MapRef) => void)[]>([]);
  const setController = (c: MapRef | null) => {
    controller.current = c;
    if (!c) return;
    const calls = queued.current;
    queued.current = [];
    calls.forEach((fn) => fn(c));
  };
  const forward = (fn: (c: MapRef) => void) => {
    if (controller.current) fn(controller.current);
    else queued.current.push(fn);
  };
  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (region, duration) => forward((c) => c.animateToRegion(region, duration)),
      animateCamera: (camera, opts) => forward((c) => c.animateCamera(camera, opts)),
      fitToCoordinates: (coords, opts) => forward((c) => c.fitToCoordinates(coords, opts)),
      getCamera: () =>
        controller.current
          ? controller.current.getCamera()
          : Promise.resolve({ center: { latitude: 0, longitude: 0 }, heading: 0, pitch: 0, zoom: 0 }),
    }),
    [],
  );

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
          defaultZoom={initialRegion ? zoomForDelta(initialRegion.latitudeDelta) : 2}
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
          <CameraController handle={setController} padding={mapPadding} />
          <LayersController layers={layers} />
          <GestureController onGesture={onPanDrag} />
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
