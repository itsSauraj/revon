/**
 * OpenStreetMap backend for web (MapLibre GL JS on OpenFreeMap vector tiles). Implements the map
 * contract in types.ts; screens import from map-view.tsx and never see this file.
 *
 * MapLibre is imperative, so MapView owns one `Map` instance and publishes it through MapContext
 * once it has loaded; markers, polylines and the layer overlays are effects on that instance. A
 * theme change swaps the whole style, which drops every source and layer we added, so children
 * re-add theirs whenever `styleVersion` bumps on the map's `style.load` event. Markers are DOM
 * elements and survive a style swap on their own.
 */
import 'maplibre-gl/dist/maplibre-gl.css';

import {
  type FillExtrusionLayerSpecification,
  GeoJSONSource,
  LngLatBounds,
  MapLibreMap,
  Marker as GlMarker,
  setWorkerUrl,
} from 'maplibre-gl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { type MapLayers, useMapLayers } from '@/lib/map-layers';
import type { LatLng } from '@/lib/types';

import { BUILDINGS_3D, OSM_STYLES, type OsmStyle, RASTER_OVERLAYS, type RasterOverlay, USER_DOT } from './osm-styles';
import { type EdgePadding, type MapViewProps, type MarkerProps, type PolylineProps, zoomForDelta } from './types';

// maplibre-gl 6 locates its web worker relative to import.meta.url, which Metro does not provide, so
// the worker is served from public/ instead (copied there on npm install by scripts/sync-web-assets.js).
setWorkerUrl('/maplibre-gl-worker.mjs');

type StyleKey = keyof typeof OSM_STYLES;

type MapContextValue = {
  /** The loaded map, or null until its `load` event. */
  map: MapLibreMap | null;
  /** Bumped after every `style.load`, i.e. whenever sources and layers we added must be re-added. */
  styleVersion: number;
  /** The style the map currently has (not the one the theme asks for while a swap is in flight). */
  style: OsmStyle;
  dark: boolean;
  /** False between `setStyle()` and `style.load`, when `addLayer` would throw. */
  isStyleReady: () => boolean;
};

const MapContext = createContext<MapContextValue>({
  map: null,
  styleVersion: 0,
  style: OSM_STYLES.light,
  dark: false,
  isStyleReady: () => false,
});

/** Which marker's label is open; only one at a time, and tapping the map closes it. */
const OpenLabel = createContext<{ openId: string | null; setOpenId: (id: string | null) => void }>({
  openId: null,
  setOpenId: () => {},
});

const toLngLat = (p: LatLng): [number, number] => [p.longitude, p.latitude];
const styleKey = (dark: boolean): StyleKey => (dark ? 'dark' : 'light');
const NO_PADDING: EdgePadding = { top: 0, right: 0, bottom: 0, left: 0 };
/** Breathing room around fitted coordinates when the caller gives no edgePadding (Google uses 40). */
const DEFAULT_FIT_PADDING = 40;
const FIT_DURATION = 600;
const EMPTY_GEOMETRY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** MapLibre bearings are -180..180; the contract (and the compass) want 0..360 clockwise. */
const normalizeHeading = (bearing: number) => ((bearing % 360) + 360) % 360;

/** maplibre reports padding with optional sides; a missing side is 0. */
function samePadding(a: EdgePadding, b: { top?: number; right?: number; bottom?: number; left?: number }) {
  return a.top === (b.top ?? 0) && a.right === (b.right ?? 0) && a.bottom === (b.bottom ?? 0) && a.left === (b.left ?? 0);
}

function applyPadding(map: MapLibreMap, pad: EdgePadding) {
  // The attribution button sits in the bottom-right control container; lift it above the UI.
  const controls = map.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-bottom-right');
  if (controls) {
    controls.style.bottom = `${pad.bottom}px`;
    controls.style.right = `${pad.right}px`;
  }
  if (samePadding(pad, map.getPadding())) return;
  // setPadding jumps the camera, which cancels any animation in flight (the first centring on the
  // rider, a route fit). While the map is moving, apply it once it has settled.
  if (map.isMoving()) {
    map.once('moveend', () => {
      if (!samePadding(pad, map.getPadding())) map.setPadding(pad);
    });
    return;
  }
  map.setPadding(pad);
}

/**
 * MapLibre adds the fit padding on top of the map padding set by `setPadding`. Screens pass
 * `edgePadding` as the full inset (it already includes the panel height, as on the Google web
 * backend), so only the part above the map padding is passed on.
 */
function fitPadding(edge: EdgePadding | undefined, mapPad: EdgePadding): number | EdgePadding {
  if (!edge) return DEFAULT_FIT_PADDING;
  return {
    top: Math.max(0, edge.top - mapPad.top),
    right: Math.max(0, edge.right - mapPad.right),
    bottom: Math.max(0, edge.bottom - mapPad.bottom),
    left: Math.max(0, edge.left - mapPad.left),
  };
}

/** First of `ids` that exists in the current style, for inserting a layer beneath it. */
function firstLayer(map: MapLibreMap, ids: string[]) {
  return ids.find((id) => map.getLayer(id));
}

function addRaster(map: MapLibreMap, overlay: RasterOverlay, beforeId?: string) {
  if (!map.getSource(overlay.id)) {
    map.addSource(overlay.id, {
      type: 'raster',
      tiles: overlay.tiles,
      tileSize: overlay.tileSize,
      maxzoom: overlay.maxzoom,
      attribution: overlay.attribution,
    });
  }
  if (!map.getLayer(overlay.id)) {
    map.addLayer({ id: overlay.id, type: 'raster', source: overlay.id, paint: { 'raster-opacity': overlay.opacity } }, beforeId);
  }
}

/** Safe after a style swap too, when the old style (and our layers with it) is already gone. */
function removeLayerAndSource(map: MapLibreMap, layerId: string, sourceId: string) {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
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
  const container = useRef<HTMLDivElement>(null);

  // `instance` exists from construction (the theme effect needs it); `loaded` and the `map` state
  // are set on the `load` event, so camera calls and children only ever touch a usable map.
  const instance = useRef<MapLibreMap | null>(null);
  const loaded = useRef<MapLibreMap | null>(null);
  const queued = useRef<((m: MapLibreMap) => void)[]>([]);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  // The style most recently asked for, and whether the map's current style is done loading.
  const requestedKey = useRef<StyleKey>(styleKey(dark));
  const styleReady = useRef(false);
  const [styleState, setStyleState] = useState({ version: 0, key: styleKey(dark) });
  const isStyleReady = useCallback(() => styleReady.current, []);

  // Only the first value matters, and screens often pass a fresh object every render.
  const initial = useRef(initialRegion);
  const padding = useRef<EdgePadding>(mapPadding ?? NO_PADDING);

  const [openId, setOpenId] = useState<string | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);

  // Latest callbacks for listeners that are registered once, at construction.
  const handlers = useRef({ onUserLocationChange, onLongPress, onPanDrag, onRegionChangeComplete });
  useEffect(() => {
    handlers.current = { onUserLocationChange, onLongPress, onPanDrag, onRegionChangeComplete };
  });

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const region = initial.current;
    const map = new MapLibreMap({
      container: el,
      style: OSM_STYLES[requestedKey.current].url,
      center: region ? toLngLat(region) : [0, 20],
      zoom: region ? zoomForDelta(region.latitudeDelta) : 2,
      // Required by the tile providers' terms; compact keeps it to a small (i) button.
      attributionControl: { compact: true },
      pitchWithRotate: true,
      maxPitch: 60,
    });
    instance.current = map;
    let disposed = false;

    map.on('style.load', () => {
      styleReady.current = true;
      setStyleState((s) => ({ version: s.version + 1, key: requestedKey.current }));
    });
    map.once('load', () => {
      if (disposed) return;
      // Padding first so queued fits and centres already respect the UI insets.
      applyPadding(map, padding.current);
      loaded.current = map;
      const calls = queued.current;
      queued.current = [];
      calls.forEach((fn) => fn(map));
      setMap(map);
    });

    map.on('dragstart', () => handlers.current.onPanDrag?.());
    // Zoom and rotate also start from our own easeTo calls; only user gestures carry a DOM event.
    map.on('zoomstart', (e) => {
      if (e.originalEvent) handlers.current.onPanDrag?.();
    });
    map.on('rotatestart', (e) => {
      if (e.originalEvent) handlers.current.onPanDrag?.();
    });
    map.on('moveend', () => handlers.current.onRegionChangeComplete?.());
    // Right-click on desktop; MapLibre synthesises it after a 500 ms long press on touch screens.
    map.on('contextmenu', (e) => {
      handlers.current.onLongPress?.({ nativeEvent: { coordinate: { latitude: e.lngLat.lat, longitude: e.lngLat.lng } } });
    });
    map.on('click', (e) => {
      // Marker elements live inside the canvas container, so their clicks reach here as well;
      // the marker handles those itself.
      const target = e.originalEvent.target;
      if (target instanceof Element && target.closest('.maplibregl-marker')) return;
      setOpenId(null);
    });

    return () => {
      disposed = true;
      instance.current = null;
      loaded.current = null;
      map.remove();
    };
  }, []);

  // Follows the app theme: dark map in dark mode, light map in light mode.
  useEffect(() => {
    const key = styleKey(dark);
    const map = instance.current;
    if (!map || requestedKey.current === key) return;
    requestedKey.current = key;
    styleReady.current = false;
    // A diffed swap would silently strip our sources and layers without firing `style.load`;
    // a full reload fires it, and children re-add theirs from the styleVersion bump.
    map.setStyle(OSM_STYLES[key].url, { diff: false });
  }, [dark]);

  const padTop = mapPadding?.top ?? 0;
  const padRight = mapPadding?.right ?? 0;
  const padBottom = mapPadding?.bottom ?? 0;
  const padLeft = mapPadding?.left ?? 0;
  useEffect(() => {
    const pad = { top: padTop, right: padRight, bottom: padBottom, left: padLeft };
    padding.current = pad;
    if (map) applyPadding(map, pad);
  }, [map, padTop, padRight, padBottom, padLeft]);

  useImperativeHandle(
    ref,
    () => {
      // Screens ask for the camera as soon as a GPS fix arrives, often before the map has loaded.
      const run = (fn: (m: MapLibreMap) => void) => {
        const m = loaded.current;
        if (m) fn(m);
        else queued.current.push(fn);
      };
      return {
        animateToRegion(region, duration = 500) {
          run((m) => m.easeTo({ center: toLngLat(region), zoom: zoomForDelta(region.latitudeDelta), duration }));
        },
        animateCamera(camera, opts) {
          run((m) =>
            m.easeTo({
              ...(camera.center ? { center: toLngLat(camera.center) } : {}),
              ...(camera.heading != null ? { bearing: camera.heading } : {}),
              ...(camera.pitch != null ? { pitch: camera.pitch } : {}),
              ...(camera.zoom != null ? { zoom: camera.zoom } : {}),
              duration: opts?.duration ?? 300,
            }),
          );
        },
        getCamera() {
          const m = loaded.current;
          if (!m) return Promise.resolve({ center: { latitude: 0, longitude: 0 }, heading: 0, pitch: 0, zoom: 0 });
          const c = m.getCenter();
          return Promise.resolve({
            center: { latitude: c.lat, longitude: c.lng },
            heading: normalizeHeading(m.getBearing()),
            pitch: m.getPitch(),
            zoom: m.getZoom(),
          });
        },
        fitToCoordinates(coordinates = [], options) {
          if (!coordinates.length) return;
          run((m) => {
            const duration = options?.animated === false ? 0 : FIT_DURATION;
            if (coordinates.length === 1) {
              m.easeTo({ center: toLngLat(coordinates[0]), zoom: 15, duration });
              return;
            }
            const first = toLngLat(coordinates[0]);
            const bounds = coordinates.reduce((b, c) => b.extend(toLngLat(c)), new LngLatBounds(first, first));
            // linear: a plain pan/zoom like the other backends, rather than MapLibre's flyTo arc.
            m.fitBounds(bounds, { padding: fitPadding(options?.edgePadding, padding.current), duration, linear: true });
          });
        },
      };
    },
    [],
  );

  useEffect(() => {
    if (!showsUserLocation || !('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMe(c);
        handlers.current.onUserLocationChange?.({
          nativeEvent: { coordinate: { ...c, heading: pos.coords.heading ?? -1, speed: pos.coords.speed ?? -1 } },
        });
      },
      () => {},
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [showsUserLocation]);

  const context: MapContextValue = {
    map,
    styleVersion: styleState.version,
    style: OSM_STYLES[styleState.key],
    dark: styleState.key === 'dark',
    isStyleReady,
  };

  return (
    <View style={style}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
      <MapContext.Provider value={context}>
        {/* Overlays mount before children so routes draw above them. */}
        <LayersController layers={layers} />
        {showsUserLocation && me && <UserDot coordinate={me} />}
        <OpenLabel.Provider value={{ openId, setOpenId }}>{children}</OpenLabel.Provider>
      </MapContext.Provider>
    </View>
  );
}

/** Raster overlays and 3D buildings from the layers sheet; traffic has no free source and is ignored. */
function LayersController({ layers }: { layers: MapLayers }) {
  const { map, styleVersion, style, dark, isStyleReady } = useContext(MapContext);
  const labelsId = style.labelsBeforeId;
  const bicyclingId = RASTER_OVERLAYS.bicycling.id;
  const buildingsId = BUILDINGS_3D.layerId;

  // Satellite / terrain replace the base map. They go beneath the bicycling overlay, our
  // extrusions and the first label layer, whichever already exists, so each stays visible.
  const type = layers.type;
  useEffect(() => {
    if (!map || type === 'default' || !isStyleReady()) return;
    const overlay = RASTER_OVERLAYS[type];
    addRaster(map, overlay, firstLayer(map, [bicyclingId, buildingsId, labelsId]));
    return () => removeLayerAndSource(map, overlay.id, overlay.id);
  }, [map, styleVersion, type, bicyclingId, buildingsId, labelsId, isStyleReady]);

  useEffect(() => {
    if (!map || !layers.bicycling || !isStyleReady()) return;
    addRaster(map, RASTER_OVERLAYS.bicycling, firstLayer(map, [buildingsId, labelsId]));
    return () => removeLayerAndSource(map, bicyclingId, bicyclingId);
  }, [map, styleVersion, layers.bicycling, bicyclingId, buildingsId, labelsId, isStyleReady]);

  // Tilt when 3D buildings switch on (same as the Google backends), but not on first mount.
  const mounted = useRef(false);
  useEffect(() => {
    if (!map) return;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    map.easeTo({ pitch: layers.buildings ? BUILDINGS_3D.pitch : 0 });
  }, [map, layers.buildings]);

  // Extrude buildings from the vector source when the style doesn't draw its own.
  const has3d = style.has3dBuildings;
  useEffect(() => {
    if (!map || !layers.buildings || has3d || !isStyleReady() || !map.getSource(BUILDINGS_3D.source)) return;
    map.addLayer(
      {
        id: buildingsId,
        type: 'fill-extrusion',
        source: BUILDINGS_3D.source,
        'source-layer': BUILDINGS_3D.sourceLayer,
        minzoom: BUILDINGS_3D.minzoom,
        paint: BUILDINGS_3D.paint(dark) as FillExtrusionLayerSpecification['paint'],
      },
      firstLayer(map, [labelsId]),
    );
    return () => {
      if (map.getLayer(buildingsId)) map.removeLayer(buildingsId);
    };
  }, [map, styleVersion, layers.buildings, has3d, dark, buildingsId, labelsId, isStyleReady]);

  return null;
}

/** The blue "you are here" dot: a MapLibre marker that lets clicks through to the map. */
function UserDot({ coordinate }: { coordinate: LatLng }) {
  const { map } = useContext(MapContext);
  const marker = useRef<GlMarker | null>(null);

  useEffect(() => {
    if (!map) return;
    if (marker.current) {
      marker.current.setLngLat(toLngLat(coordinate));
      return;
    }
    const el = document.createElement('div');
    Object.assign(el.style, {
      width: `${USER_DOT.size}px`,
      height: `${USER_DOT.size}px`,
      borderRadius: '50%',
      background: USER_DOT.color,
      border: `3px solid ${USER_DOT.border}`,
      boxShadow: `0 0 0 6px ${USER_DOT.ring}`,
      pointerEvents: 'none',
      zIndex: '50',
    });
    marker.current = new GlMarker({ element: el, anchor: 'center' }).setLngLat(toLngLat(coordinate)).addTo(map);
  }, [map, coordinate]);

  useEffect(
    () => () => {
      marker.current?.remove();
      marker.current = null;
    },
    [],
  );

  return null;
}

const DEFAULT_PIN = '#EA4335';

export function Marker({ coordinate, title, description, pinColor, anchor, zIndex, onPress, onCalloutPress, children }: MarkerProps) {
  const theme = useTheme();
  const id = useId();
  const { map } = useContext(MapContext);
  const { openId, setOpenId } = useContext(OpenLabel);
  const hasInfo = Boolean(title || description);
  const open = hasInfo && openId === id;
  const anchorX = anchor?.x ?? 0.5;
  const anchorY = anchor?.y ?? 0.5;

  // One DOM element per marker instance: MapLibre positions it, React renders the content into it.
  const [element] = useState(() => document.createElement('div'));
  const marker = useRef<GlMarker | null>(null);
  const label = useRef<HTMLDivElement>(null);

  // Latest press behaviour for the native click listener, which is attached once.
  const press = useRef<() => void>(() => {});
  useEffect(() => {
    press.current = () => {
      onPress?.();
      if (hasInfo) setOpenId(open ? null : id);
    };
  });

  const lat = coordinate.latitude;
  const lng = coordinate.longitude;
  useEffect(() => {
    if (!map) return;
    if (marker.current) {
      marker.current.setLngLat([lng, lat]);
      return;
    }
    marker.current = new GlMarker({ element, anchor: 'top-left' }).setLngLat([lng, lat]).addTo(map);
  }, [map, element, lat, lng]);

  useEffect(
    () => () => {
      marker.current?.remove();
      marker.current = null;
    },
    [],
  );

  // With a top-left anchor the offset moves the requested fraction of the element onto the
  // coordinate. The size is only known once rendered, and changes with the children.
  useEffect(() => {
    if (!map) return;
    const apply = () => marker.current?.setOffset([-element.offsetWidth * anchorX, -element.offsetHeight * anchorY]);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => observer.disconnect();
  }, [map, element, anchorX, anchorY]);

  // Stacking is between sibling marker elements, so it has to go on the element MapLibre positions
  // (reached through the marker: React state must not be mutated directly).
  useEffect(() => {
    if (!map) return;
    const el = marker.current?.getElement();
    if (!el) return;
    el.style.zIndex = open ? '2000' : zIndex != null ? String(zIndex) : '';
    el.style.cursor = onPress || hasInfo ? 'pointer' : '';
  }, [map, open, zIndex, onPress, hasInfo]);

  useEffect(() => {
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onClick = (e: MouseEvent) => {
      // The label handles its own clicks, and a pan that ends on the marker is not a press.
      if (e.target instanceof Node && label.current?.contains(e.target)) return;
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      press.current();
    };
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('click', onClick);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('click', onClick);
    };
  }, [element]);

  return createPortal(
    // The label is positioned above the content so opening it doesn't move the anchor.
    <div style={{ position: 'relative' }}>
      {open && (
        <div
          ref={label}
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
      {children ?? (
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            boxSizing: 'border-box',
            background: pinColor ?? DEFAULT_PIN,
            border: '2px solid #fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
          }}
        />
      )}
    </div>,
    element,
  );
}

/** A GeoJSON line layer; stacking follows mount order (MapLibre has no z-index). */
export function Polyline({ coordinates, strokeColor = '#000000', strokeWidth = 3 }: PolylineProps) {
  const { map, styleVersion, isStyleReady } = useContext(MapContext);
  const reactId = useId();
  // useId values contain punctuation; keep layer ids plain.
  const id = `revon-line-${reactId.replace(/\W/g, '')}`;

  // Source and layer, created empty and re-created after every style swap; the effects below fill
  // them in on the same commit, and later update them in place.
  useEffect(() => {
    if (!map || !isStyleReady()) return;
    map.addSource(id, { type: 'geojson', data: EMPTY_GEOMETRY });
    map.addLayer({ id, type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    return () => removeLayerAndSource(map, id, id);
  }, [map, styleVersion, id, isStyleReady]);

  useEffect(() => {
    if (!map || !isStyleReady()) return;
    const source = map.getSource<GeoJSONSource>(id);
    if (!source) return;
    source.setData(
      coordinates.length < 2
        ? EMPTY_GEOMETRY
        : { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coordinates.map(toLngLat) } },
    );
  }, [map, styleVersion, id, coordinates, isStyleReady]);

  useEffect(() => {
    if (!map || !isStyleReady() || !map.getLayer(id)) return;
    map.setPaintProperty(id, 'line-color', strokeColor);
    map.setPaintProperty(id, 'line-width', strokeWidth);
  }, [map, styleVersion, id, strokeColor, strokeWidth, isStyleReady]);

  return null;
}
