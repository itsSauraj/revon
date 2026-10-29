/**
 * OpenStreetMap backend for Android and iOS (MapLibre Native through @maplibre/maplibre-react-native).
 * Implements the map contract in types.ts; screens import from map-view.tsx and never see this file.
 *
 * The base style comes from OpenFreeMap (osm-styles.ts) and follows the app theme. The layers sheet's
 * satellite, terrain and bicycling options are raster overlays slotted beneath the style's labels, and
 * 3D buildings are extruded from the vector source when the style has none of its own. The rider's
 * position comes from expo-location rather than MapLibre's UserLocation so the app runs one location
 * engine, and it is drawn as circle layers (not a marker view) so rider markers always stack above it.
 */
import {
  type Anchor,
  Camera,
  type CameraRef,
  type CameraStop,
  type FillExtrusionLayerSpecification,
  GeoJSONSource,
  Layer,
  type LngLat,
  Map as MLMap,
  type MapRef as MLMapRef,
  Marker as MLMarker,
  type PixelPoint,
  RasterSource,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { createContext, type RefObject, useContext, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { Size, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useMapLayers } from '@/lib/map-layers';
import type { LatLng } from '@/lib/types';

import { BUILDINGS_3D, OSM_STYLES, RASTER_OVERLAYS, type RasterOverlay, USER_DOT } from './osm-styles';
import { type MapViewProps, type MarkerProps, type PolylineProps, zoomForDelta } from './types';

const toLngLat = (p: LatLng): LngLat => [p.longitude, p.latitude];

/** Whole-world view used when a screen gives no initialRegion (same as the web backends). */
const WORLD = { center: [0, 20] as LngLat, zoom: 2 };
/** Margin for fitToCoordinates when the caller passes no edgePadding, so edge markers aren't clipped. */
const FIT_MARGIN = { top: 24, right: 24, bottom: 24, left: 24 };
/** Gap between a marker's content and its label. */
const LABEL_GAP = 6;

const USER_SOURCE_ID = 'revon-user';
const USER_RING_LAYER_ID = 'revon-user-ring';
const USER_DOT_LAYER_ID = 'revon-user-dot';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Shared between MapView and its Marker/Polyline children: which marker's label is open (one at a
 * time; tapping the map closes it), and the layer route lines are inserted beneath so the rider's dot
 * stays on top of them (MapLibre stacks layers in mount order and routes usually mount after the dot).
 */
const MapContext = createContext<{ openId: string | null; setOpenId: (id: string | null) => void; linesBelow?: string }>({
  openId: null,
  setOpenId: () => {},
});

/**
 * Every camera request is a MapLibre stop. Screens ask for the camera as soon as a GPS fix arrives,
 * often before the style has loaded, so stops are queued until then. On replay all but the last jump:
 * a native stop builds on the camera's *current* position, so animating queued stops back to back
 * would discard every one but the last.
 */
type CameraControl = { camera: CameraRef | null; ready: boolean; pending: CameraStop[] };

function move(control: RefObject<CameraControl>, stop: CameraStop) {
  const c = control.current;
  if (!c.ready) {
    c.pending.push(stop);
    return;
  }
  // setStop throws synchronously while the native camera isn't mounted and rejects on native errors;
  // neither should take a screen down.
  try {
    c.camera?.setStop(stop).catch(() => {});
  } catch {
    // camera not mounted yet
  }
}

function markReady(control: RefObject<CameraControl>) {
  const c = control.current;
  if (c.ready) return;
  c.ready = true;
  const stops = c.pending;
  c.pending = [];
  stops.forEach((stop, i) => move(control, i < stops.length - 1 ? { ...stop, duration: 0, easing: undefined } : stop));
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
  const dark = useColorScheme() === 'dark';
  const layers = useMapLayers();
  const osmStyle = OSM_STYLES[dark ? 'dark' : 'light'];
  const map = useRef<MLMapRef | null>(null);
  const control = useRef<CameraControl>({ camera: null, ready: false, pending: [] });
  const [me, setMe] = useState<LatLng | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion(region, duration = 500) {
      move(control, { center: toLngLat(region), zoom: zoomForDelta(region.latitudeDelta), duration, easing: 'ease' });
    },
    animateCamera(camera, opts) {
      // Only the given fields are sent; the native stop keeps the current value for the rest.
      const stop = {
        ...(camera.zoom != null ? { zoom: camera.zoom } : {}),
        ...(camera.heading != null ? { bearing: camera.heading } : {}),
        ...(camera.pitch != null ? { pitch: camera.pitch } : {}),
        duration: opts?.duration ?? 300,
        easing: 'ease' as const,
      };
      move(control, camera.center ? { ...stop, center: toLngLat(camera.center) } : stop);
    },
    async getCamera() {
      const v = await map.current?.getViewState().catch(() => null);
      return v
        ? { center: { latitude: v.center[1], longitude: v.center[0] }, heading: v.bearing, pitch: v.pitch, zoom: v.zoom }
        : { center: { latitude: 0, longitude: 0 }, heading: 0, pitch: 0, zoom: 15 };
    },
    fitToCoordinates(coordinates = [], options) {
      if (!coordinates.length) return;
      const duration = options?.animated ? 600 : 0;
      const easing = duration ? 'ease' : undefined;
      if (coordinates.length === 1) {
        move(control, { center: toLngLat(coordinates[0]), zoom: 15, duration, easing });
        return;
      }
      let west = Infinity;
      let south = Infinity;
      let east = -Infinity;
      let north = -Infinity;
      for (const c of coordinates) {
        west = Math.min(west, c.longitude);
        south = Math.min(south, c.latitude);
        east = Math.max(east, c.longitude);
        north = Math.max(north, c.latitude);
      }
      // Stop padding is added to contentInset natively (as react-native-maps adds edgePadding to
      // mapPadding), so only the caller's extra padding goes here.
      move(control, { bounds: [west, south, east, north], padding: options?.edgePadding ?? FIT_MARGIN, duration, easing });
    },
  }));

  // 3D buildings only read when the map is tilted, so tilt when they're switched on and flatten when off.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    move(control, { pitch: layers.buildings ? BUILDINGS_3D.pitch : 0, duration: 500, easing: 'ease' });
  }, [layers.buildings]);

  // Keep the latest callback without re-subscribing to location on every render.
  const onUserLocationRef = useRef(onUserLocationChange);
  useEffect(() => {
    onUserLocationRef.current = onUserLocationChange;
  });

  useEffect(() => {
    if (!showsUserLocation) return;
    let sub: Location.LocationSubscription | null = null;
    let starting = false;
    let cancelled = false;
    const start = async () => {
      if (sub || starting) return;
      starting = true;
      try {
        const { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted || cancelled) return;
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 3 },
          (loc) => {
            const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setMe(c);
            onUserLocationRef.current?.({
              nativeEvent: { coordinate: { ...c, heading: loc.coords.heading ?? -1, speed: loc.coords.speed ?? -1 } },
            });
          },
        );
        if (cancelled) s.remove();
        else sub = s;
      } catch {
        // location services unavailable; try again when the app next becomes active
      } finally {
        starting = false;
      }
    };
    start();
    // On first launch the map mounts before the rider answers the permission dialog, which sends the app
    // through background/inactive; check again when it comes back so the dot appears without a remount.
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') start();
    });
    return () => {
      cancelled = true;
      appState.remove();
      sub?.remove();
    };
  }, [showsUserLocation]);

  // Once per gesture: MapLibre reports every camera change, so remember that this one is a drag.
  const dragging = useRef(false);

  const overlay = layers.type === 'satellite' ? RASTER_OVERLAYS.satellite : layers.type === 'terrain' ? RASTER_OVERLAYS.terrain : null;
  const bottomInset = (mapPadding?.bottom ?? 0) + 8;

  return (
    <MLMap
      ref={map}
      style={style}
      mapStyle={osmStyle.url}
      contentInset={mapPadding}
      compass={false}
      scaleBar={false}
      // Logo and attribution are a condition of the free tiles; keep them above the screen's bottom UI.
      logo
      logoPosition={{ bottom: bottomInset, left: 8 }}
      attribution
      attributionPosition={{ bottom: bottomInset, right: 8 }}
      onPress={() => setOpenId(null)}
      onLongPress={(e) => {
        const [longitude, latitude] = e.nativeEvent.lngLat;
        onLongPress?.({ nativeEvent: { coordinate: { latitude, longitude } } });
      }}
      onRegionWillChange={(e) => {
        if (!e.nativeEvent.userInteraction || dragging.current) return;
        dragging.current = true;
        onPanDrag?.();
      }}
      onRegionDidChange={() => {
        dragging.current = false;
        onRegionChangeComplete?.();
      }}
      onDidFinishLoadingStyle={() => markReady(control)}
      // Offline the style can't load, but the camera still works; don't leave the rider uncentred.
      onDidFailLoadingMap={() => markReady(control)}>
      <Camera
        ref={(c) => {
          control.current.camera = c;
        }}
        initialViewState={
          initialRegion ? { center: toLngLat(initialRegion), zoom: zoomForDelta(initialRegion.latitudeDelta) } : WORLD
        }
      />
      {/* Overlays sit beneath the style's labels so place names stay readable on imagery. */}
      {overlay && <Overlay overlay={overlay} beforeId={osmStyle.labelsBeforeId} />}
      {layers.bicycling && <Overlay overlay={RASTER_OVERLAYS.bicycling} beforeId={osmStyle.labelsBeforeId} />}
      {layers.buildings && !osmStyle.has3dBuildings && (
        <Layer
          id={BUILDINGS_3D.layerId}
          type="fill-extrusion"
          source={BUILDINGS_3D.source}
          source-layer={BUILDINGS_3D.sourceLayer}
          minzoom={BUILDINGS_3D.minzoom}
          beforeId={osmStyle.labelsBeforeId}
          paint={BUILDINGS_3D.paint(dark) as FillExtrusionLayerSpecification['paint']}
        />
      )}
      {/* The dot is mounted before the children so route lines can reference its ring layer in beforeId. */}
      {showsUserLocation && (
        <GeoJSONSource
          id={USER_SOURCE_ID}
          data={me ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: toLngLat(me) } } : EMPTY}>
          <Layer
            id={USER_RING_LAYER_ID}
            type="circle"
            source={USER_SOURCE_ID}
            paint={{
              'circle-radius': USER_DOT.size / 2 + 9,
              'circle-color': USER_DOT.ring,
              'circle-pitch-alignment': 'viewport',
              'circle-pitch-scale': 'viewport',
            }}
          />
          <Layer
            id={USER_DOT_LAYER_ID}
            type="circle"
            source={USER_SOURCE_ID}
            paint={{
              'circle-radius': USER_DOT.size / 2,
              'circle-color': USER_DOT.color,
              'circle-stroke-width': 3,
              'circle-stroke-color': USER_DOT.border,
              'circle-pitch-alignment': 'viewport',
              'circle-pitch-scale': 'viewport',
            }}
          />
        </GeoJSONSource>
      )}
      <MapContext.Provider value={{ openId, setOpenId, linesBelow: showsUserLocation ? USER_RING_LAYER_ID : undefined }}>
        {children}
      </MapContext.Provider>
    </MLMap>
  );
}

function Overlay({ overlay, beforeId }: { overlay: RasterOverlay; beforeId: string }) {
  return (
    <RasterSource
      id={overlay.id}
      tiles={overlay.tiles}
      tileSize={overlay.tileSize}
      maxzoom={overlay.maxzoom}
      attribution={overlay.attribution}>
      <Layer
        id={`${overlay.id}-layer`}
        type="raster"
        source={overlay.id}
        beforeId={beforeId}
        paint={{ 'raster-opacity': overlay.opacity }}
      />
    </RasterSource>
  );
}

/** MapLibre only has named anchors; exact edges and the centre map to one without measuring the view. */
function namedAnchor(x: number, y: number): Anchor | null {
  const h = x === 0 ? 'left' : x === 0.5 ? '' : x === 1 ? 'right' : null;
  const v = y === 0 ? 'top' : y === 0.5 ? '' : y === 1 ? 'bottom' : null;
  if (h === null || v === null) return null;
  if (!h && !v) return 'center';
  return (h && v ? `${v}-${h}` : v || h) as Anchor;
}

/**
 * Marker whose title/description show in a small themed label above it when tapped.
 *
 * zIndex is accepted but not honoured: MapLibre stacks marker views in mount order. tracksViewChanges is
 * ignored because MapLibre markers are live native views, not rasterised.
 */
export function Marker({ coordinate, title, description, pinColor, anchor, onPress, onCalloutPress, children }: MarkerProps) {
  const theme = useTheme();
  const id = useId();
  const { openId, setOpenId } = useContext(MapContext);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const hasInfo = Boolean(title || description);
  const open = hasInfo && openId === id;
  const ax = anchor?.x ?? 0.5;
  const ay = anchor?.y ?? 0.5;
  const lngLat = toLngLat(coordinate);

  // Fractional anchors become a pixel offset from the top-left corner once the content is measured;
  // until then the marker sits on its centre for a frame.
  const named = namedAnchor(ax, ay);
  const placement = named
    ? { anchor: named }
    : size
      ? { anchor: 'top-left' as const, offset: [-size.width * ax, -size.height * ay] as PixelPoint }
      : { anchor: 'center' as const };

  return (
    <>
      <MLMarker
        lngLat={lngLat}
        {...placement}
        onPress={() => {
          onPress?.();
          if (hasInfo) setOpenId(open ? null : id);
        }}>
        <View
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }));
          }}>
          {children ?? <View style={[styles.pin, { backgroundColor: pinColor ?? theme.text, borderColor: theme.markerBorder }]} />}
        </View>
      </MLMarker>
      {/* The label is its own marker so opening it never moves or resizes the content view. */}
      {open && size && (
        <MLMarker
          lngLat={lngLat}
          anchor="bottom"
          offset={[(0.5 - ax) * size.width, -ay * size.height - LABEL_GAP]}
          onPress={() => {
            if (!onCalloutPress) return;
            onCalloutPress();
            setOpenId(null);
          }}>
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
        </MLMarker>
      )}
    </>
  );
}

/**
 * A GeoJSON line. zIndex is not honoured: layers stack in mount order (MapView mounts the raster overlays
 * before its children, so routes draw above imagery) and beneath the rider's dot when it is shown.
 */
export function Polyline({ coordinates, strokeColor = '#000000', strokeWidth = 1 }: PolylineProps) {
  const id = useId();
  const { linesBelow } = useContext(MapContext);
  if (coordinates.length < 2) return null;
  const data: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coordinates.map(toLngLat) },
  };
  return (
    <GeoJSONSource id={`${id}-source`} data={data}>
      <Layer
        id={`${id}-line`}
        type="line"
        source={`${id}-source`}
        beforeId={linesBelow}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': strokeColor, 'line-width': strokeWidth }}
      />
    </GeoJSONSource>
  );
}

const styles = StyleSheet.create({
  pin: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  label: {
    maxWidth: 220,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Size.radius - 2,
    borderWidth: 1,
  },
  title: { fontSize: Type.small, fontWeight: '600' },
  description: { fontSize: Type.tiny },
});
