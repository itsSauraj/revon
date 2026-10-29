/**
 * Shared constants for the OpenStreetMap backends (MapLibre Native on Android/iOS, MapLibre GL JS
 * on web): base styles, raster overlays for the layers sheet, and 3D buildings.
 *
 * Everything here is free to use without a key. Usage policies (checked 2026-10-29):
 * - OpenFreeMap: no limits, no registration; attribution required.
 * - Esri World Imagery, OpenTopoMap, Waymarked Trails: free for moderate app use with attribution;
 *   swap in a paid tile provider before a large release.
 */
export type OsmStyle = {
  url: string;
  /**
   * Layer the overlays are inserted beneath: the first label layer above every road, building and
   * area layer, so imagery covers the base map while street and place names stay readable. (The
   * first symbol layer of each style is too low: both styles interleave roads and labels.)
   */
  labelsBeforeId: string;
  /** Whether the style already extrudes buildings at high zoom (then only the tilt is needed). */
  has3dBuildings: boolean;
};

/** OpenFreeMap styles (OpenMapTiles schema, source id `openmaptiles`). */
export const OSM_STYLES: Record<'light' | 'dark', OsmStyle> = {
  light: { url: 'https://tiles.openfreemap.org/styles/liberty', labelsBeforeId: 'waterway_line_label', has3dBuildings: true },
  dark: { url: 'https://tiles.openfreemap.org/styles/dark', labelsBeforeId: 'highway_name_other', has3dBuildings: false },
};

export const OSM_ATTRIBUTION = '© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors';

export type RasterOverlay = {
  /** Source and layer id prefix. */
  id: string;
  tiles: string[];
  tileSize: number;
  maxzoom: number;
  attribution: string;
  opacity: number;
  /** Opaque overlays replace the base map; translucent ones sit on it. */
  opaque: boolean;
};

/** Raster overlays behind the layers sheet's Satellite, Terrain and Bicycling options. */
export const RASTER_OVERLAYS = {
  satellite: {
    id: 'revon-satellite',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    opacity: 1,
    opaque: true,
  },
  terrain: {
    id: 'revon-terrain',
    tiles: [
      'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
    ],
    tileSize: 256,
    maxzoom: 17,
    attribution: 'Map data © OpenStreetMap contributors, SRTM | Map style © OpenTopoMap (CC-BY-SA)',
    opacity: 1,
    opaque: true,
  },
  bicycling: {
    id: 'revon-bicycling',
    tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 18,
    attribution: 'Cycling routes © waymarkedtrails.org',
    opacity: 0.85,
    opaque: false,
  },
} satisfies Record<string, RasterOverlay>;

/** 3D buildings drawn from the vector source when the style has none of its own. */
export const BUILDINGS_3D = {
  layerId: 'revon-buildings-3d',
  source: 'openmaptiles',
  sourceLayer: 'building',
  minzoom: 14,
  /** Tilt applied when 3D buildings are switched on (same as the Google backend). */
  pitch: 45,
  paint: (dark: boolean) => ({
    'fill-extrusion-color': dark ? '#2A2A2A' : '#D9D4CE',
    'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
    'fill-extrusion-opacity': 0.8,
  }),
};

/** The blue "you are here" dot, shared so both backends look the same as the Google ones. */
export const USER_DOT = { size: 18, color: '#1A73E8', ring: 'rgba(26,115,232,0.2)', border: '#FFFFFF' };
