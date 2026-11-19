import gisRaw from '../data/lalkhanGisData.json';

export interface GisMeta {
  originLat: number;
  originLon: number;
  boundsMetric: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  nsExtentM: number;
  ewExtentM: number;
  mappedAreaSqM: number;
  totalRoadLengthM: number;
  roadCount: number;
  buildingCount: number;
  intersectionCount: number;
  elevationMinM: number;
  elevationMaxM: number;
  attribution: string;
}

export interface GisRoad {
  id: string;
  hw: string;
  name: string;
  oneway: boolean;
  bridge: boolean;
  layer: number;
  pts: [number, number][];
}

export interface GisBuilding {
  id: string;
  name: string;
  type: string;
  levels: number;
  cx: number;
  cz: number;
  area: number;
  poly: [number, number][];
}

export interface GisPoi {
  id: string;
  lat: number;
  lon: number;
  x: number;
  z: number;
  name: string;
  kind: string;
}

export interface GisDataset {
  meta: GisMeta;
  elevation: {
    rows: number;
    cols: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    minE: number;
    maxE: number;
    values: number[];
  };
  roads: GisRoad[];
  buildings: GisBuilding[];
  pois: GisPoi[];
}

export const GIS_DATA = gisRaw as GisDataset;

export const LAT0 = GIS_DATA.meta.originLat; // 22.35042 N
export const LON0 = GIS_DATA.meta.originLon; // 91.81678 E
const R_LAT = 110734.5; // meters/deg latitude at 22.35N (WGS84 / UTM 46N)
const R_LON = 102892.0; // meters/deg longitude at 22.35N

/** Project WGS84 lat/lon to local 1:1 metric coordinates (+X East, +Z South / -Z North) */
export function latLonToMetric(lat: number, lon: number): [number, number] {
  return [
    Math.round((lon - LON0) * R_LON * 10) / 10,
    Math.round(-(lat - LAT0) * R_LAT * 10) / 10,
  ];
}

/** Convert local 1:1 metric coordinates back to WGS84 lat/lon */
export function metricToLatLon(x: number, z: number): { lat: number; lon: number } {
  return {
    lat: LAT0 - z / R_LAT,
    lon: LON0 + x / R_LON,
  };
}

/** Convert local metric coordinates to approximate UTM Zone 46N Easting/Northing */
export function metricToUtm46N(x: number, z: number): { easting: number; northing: number; zone: string } {
  // Lalkhan Bazar origin (22.35042 N, 91.81678 E) in UTM Zone 46N is approx E=378095, N=2472295
  return {
    easting: Math.round(378095 + x),
    northing: Math.round(2472295 - z),
    zone: '46Q',
  };
}

export interface SurveyReport {
  mappedAreaSqM: number;
  mappedAreaSqKm: number;
  ward14OfficialSqKm: number;
  nsExtentM: number;
  ewExtentM: number;
  totalRoadLengthM: number;
  totalRoadLengthKm: number;
  mappedBuildings: number;
  mappedIntersections: number;
  elevationMinM: number;
  elevationMaxM: number;
  uncertainNotes: string[];
}

export function getSurveyReport(): SurveyReport {
  const m = GIS_DATA.meta;
  return {
    mappedAreaSqM: m.mappedAreaSqM,
    mappedAreaSqKm: Math.round((m.mappedAreaSqM / 1_000_000) * 100) / 100,
    ward14OfficialSqKm: 1.24,
    nsExtentM: m.nsExtentM,
    ewExtentM: m.ewExtentM,
    totalRoadLengthM: m.totalRoadLengthM,
    totalRoadLengthKm: Math.round((m.totalRoadLengthM / 1000) * 100) / 100,
    mappedBuildings: m.buildingCount,
    mappedIntersections: m.intersectionCount,
    elevationMinM: m.elevationMinM,
    elevationMaxM: m.elevationMaxM,
    uncertainNotes: [
      'Exact Ward 14 administrative boundary line vs informal Motijharna/Chanmari edges is estimated from CCC Ward 14 references and OSM corridors.',
      'Building floor counts where OSM building:levels is absent are estimated from footprint area and zone density.',
      'Interior layouts of commercial centers and hillside homes are playable architectural reconstructions.',
    ],
  };
}

/** Approximate Ward 14 / Lalkhan Bazar locality polygon in metric coordinates (uncertain boundary marked for verification) */
export const LALKHAN_LOCALITY_BOUNDARY: [number, number][] = [
  [-480, -560],
  [360, -580],
  [540, -140],
  [440, 260],
  [320, 480],
  [-40, 620],
  [-560, 460],
  [-620, -120],
];

export interface ExpansionChunk {
  id: string;
  name: string;
  bengaliName: string;
  lat: number;
  lon: number;
  bearingNote: string;
  distanceKm: number;
  status: 'context-visible' | 'planned-chunk';
}

export const FUTURE_EXPANSION_CHUNKS: ExpansionChunk[] = [
  { id: 'wasa_mor', name: 'WASA Mor', bengaliName: 'ওয়াসা মোড়', lat: 22.3513, lon: 91.8221, bearingNote: 'NE Edge (Partially in Context)', distanceKm: 0.56, status: 'context-visible' },
  { id: 'gec_circle', name: 'GEC Circle', bengaliName: 'জিইসি মোড়', lat: 22.3591, lon: 91.8214, bearingNote: 'North via CDA Ave / Flyover', distanceKm: 1.07, status: 'planned-chunk' },
  { id: 'two_no_gate', name: '2 No Gate', bengaliName: '২ নং গেট', lat: 22.3665, lon: 91.8240, bearingNote: 'North along Akhtaruzzaman Flyover', distanceKm: 1.93, status: 'planned-chunk' },
  { id: 'muradpur', name: 'Muradpur', bengaliName: 'মুরাদপুর', lat: 22.3688, lon: 91.8336, bearingNote: 'NE Flyover Terminus', distanceKm: 2.67, status: 'planned-chunk' },
  { id: 'nasirabad', name: 'Nasirabad', bengaliName: 'নাসিরাবাদ', lat: 22.3645, lon: 91.8142, bearingNote: 'NW beyond Khulshi Ridge', distanceKm: 1.58, status: 'planned-chunk' },
  { id: 'kazir_dewri', name: 'Kazir Dewri', bengaliName: 'কাজীর দেউড়ি', lat: 22.3455, lon: 91.8258, bearingNote: 'SE via SS Khaled Rd / Radisson', distanceKm: 1.08, status: 'planned-chunk' },
  { id: 'chawkbazar', name: 'Chawkbazar', bengaliName: 'চকবাজার', lat: 22.3548, lon: 91.8367, bearingNote: 'East beyond Mehedibag', distanceKm: 2.10, status: 'planned-chunk' },
  { id: 'agrabad', name: 'Agrabad', bengaliName: 'আগ্রাবাদ', lat: 22.3266, lon: 91.8124, bearingNote: 'SW via Tigerpass & Expressway', distanceKm: 2.67, status: 'planned-chunk' },
  { id: 'new_market', name: 'New Market', bengaliName: 'নিউ মার্কেট', lat: 22.3347, lon: 91.8342, bearingNote: 'Connected SE via Neval & SS Khaled Ave', distanceKm: 0.72, status: 'context-visible' },
  { id: 'bahaddarhat', name: 'Bahaddarhat', bengaliName: 'বহদ্দারহাট', lat: 22.3698, lon: 91.8442, bearingNote: 'NE Flyover Corridor', distanceKm: 3.55, status: 'planned-chunk' },
  { id: 'oxygen', name: 'Oxygen', bengaliName: 'অক্সিজেন', lat: 22.3886, lon: 91.8229, bearingNote: 'Far North Highway', distanceKm: 4.28, status: 'planned-chunk' },
  { id: 'patenga', name: 'Patenga', bengaliName: 'পতেঙ্গা', lat: 22.2442, lon: 91.7945, bearingNote: 'South via Elevated Expressway', distanceKm: 11.98, status: 'planned-chunk' },
];

/** Sub-neighborhood regions inside the playable area for live HUD location awareness */
export interface NeighborhoodZone {
  id: string;
  name: string;
  bengaliName: string;
  cx: number;
  cz: number;
  radius: number;
  insideLalkhanBazar: boolean;
}

export const NEIGHBORHOOD_ZONES: NeighborhoodZone[] = [
  { id: 'ispahani', name: 'Ispahani Circle · Lalkhan Bazar', bengaliName: 'ইস্পাহানী মোড় · লালখান বাজার', cx: 268, cz: 340, radius: 145, insideLalkhanBazar: true },
  { id: 'lalkhan_junction', name: 'Lalkhan Bazar Flyover Junction', bengaliName: 'লালখান বাজার ফ্লাইওভার সংযোগ', cx: 365, cz: 215, radius: 130, insideLalkhanBazar: true },
  { id: 'motijharna', name: 'Motijharna Hillside', bengaliName: 'মতিঝর্ণা পাহাড়', cx: 30, cz: 150, radius: 260, insideLalkhanBazar: true },
  { id: 'tankir_pahar', name: 'Tankir Pahar · Lalkhan Bazar', bengaliName: 'টাংকির পাহাড় · লালখান বাজার', cx: -80, cz: -140, radius: 240, insideLalkhanBazar: true },
  { id: 'chanmari', name: 'Chanmari Road · Lalkhan Bazar', bengaliName: 'চানমারি রোড · লালখান বাজার', cx: 210, cz: 460, radius: 170, insideLalkhanBazar: true },
  { id: 'bagghona', name: 'Bagghona · Shaheed Nagar', bengaliName: 'বাঘঘোনা · শহীদ নগর', cx: 210, cz: -120, radius: 210, insideLalkhanBazar: true },
  { id: 'batali_slope', name: 'Batali Hill Foothills', bengaliName: 'বাটালি হিল পাদদেশ', cx: -390, cz: 260, radius: 310, insideLalkhanBazar: false },
  { id: 'wasa_border', name: 'WASA Mor (Border Context)', bengaliName: 'ওয়াসা মোড় (সীমান্ত)', cx: 545, cz: -135, radius: 170, insideLalkhanBazar: false },
  { id: 'dampara', name: 'Dampara / Police Lines (Border)', bengaliName: 'দামপাড়া / পুলিশ লাইন', cx: 340, cz: -420, radius: 240, insideLalkhanBazar: false },
  { id: 'jamiatul_falah', name: 'Jamiatul Falah & SS Khaled Rd (Border)', bengaliName: 'জমিয়তুল ফালাহ ও এসএস খালেদ রোড', cx: 580, cz: 140, radius: 220, insideLalkhanBazar: false },
  { id: 'tigerpass_approach', name: 'Tigerpass Approach (SW Context)', bengaliName: 'টাইগারপাস সংযোগ সড়ক', cx: -150, cz: 580, radius: 260, insideLalkhanBazar: false },
  { id: 'new_market_plaza', name: 'Chattogram New Market · Biponi Bitan', bengaliName: 'চট্টগ্রাম নিউ মার্কেট · বিপণি বিতান', cx: 888, cz: 540, radius: 135, insideLalkhanBazar: false },
];

export function getZoneAt(x: number, z: number): NeighborhoodZone {
  let best = NEIGHBORHOOD_ZONES[0];
  let bestScore = Infinity;
  for (const zItem of NEIGHBORHOOD_ZONES) {
    const d = Math.hypot(x - zItem.cx, z - zItem.cz) / zItem.radius;
    if (d < bestScore) {
      bestScore = d;
      best = zItem;
    }
  }
  return best;
}
