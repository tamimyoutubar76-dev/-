import fs from 'node:fs';
import path from 'node:path';

// Real-world origin: Lalkhan Bazar, Chattogram (OSM center)
const LAT0 = 22.35042;
const LON0 = 91.81678;
// WGS84 metric conversion at 22.35042 deg N (UTM Zone 46N equivalent local tangent)
const R_LAT = 110734.5;
const R_LON = 102892.0;

function toMetric(lat, lon) {
  return [
    Math.round((lon - LON0) * R_LON * 10) / 10,
    Math.round(-(lat - LAT0) * R_LAT * 10) / 10, // -Z is North, +Z is South
  ];
}

const files = [
  '/tmp/lalkhan_gis/sw.osm',
  '/tmp/lalkhan_gis/se.osm',
  '/tmp/lalkhan_gis/nw.osm',
  '/tmp/lalkhan_gis/ne.osm',
];

const nodes = new Map();
const ways = new Map();

for (const f of files) {
  const xml = fs.readFileSync(f, 'utf8');
  let m;
  const nodeRe = /<node\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g;
  while ((m = nodeRe.exec(xml)) !== null) {
    const id = /id="(\d+)"/.exec(m[1])?.[1];
    const lat = parseFloat(/lat="([^"]+)"/.exec(m[1])?.[1]);
    const lon = parseFloat(/lon="([^"]+)"/.exec(m[1])?.[1]);
    if (!id || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const tags = {};
    const tagRe = /<tag\s+k="([^"]+)"\s+v="([^"]+)"\s*\/>/g;
    let tm;
    while ((tm = tagRe.exec(m[2] || '')) !== null) {
      tags[tm[1]] = tm[2]
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    }
    nodes.set(id, { id, lat, lon, tags });
  }
  const wayRe = /<way\s+([^>]*?)>([\s\S]*?)<\/way>/g;
  while ((m = wayRe.exec(xml)) !== null) {
    const id = /id="(\d+)"/.exec(m[1])?.[1];
    if (!id || ways.has(id)) continue;
    const nds = [];
    const tags = {};
    let nm;
    let tm;
    const ndRe = /<nd\s+ref="(\d+)"\s*\/>/g;
    while ((nm = ndRe.exec(m[2])) !== null) nds.push(nm[1]);
    const tagRe = /<tag\s+k="([^"]+)"\s+v="([^"]+)"\s*\/>/g;
    while ((tm = tagRe.exec(m[2])) !== null) {
      tags[tm[1]] = tm[2]
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    }
    ways.set(id, { id, nds, tags });
  }
}

// Playable extent: 1540m E-W (-750..790) x 1440m N-S (-680..760)
const MIN_X = -750;
const MAX_X = 790;
const MIN_Z = -680;
const MAX_Z = 760;

function inPlayable([x, z]) {
  return x >= MIN_X && x <= MAX_X && z >= MIN_Z && z <= MAX_Z;
}

// Clip a polyline segment cleanly to the bounding box
function clipSegment(p1, p2) {
  let [x0, z0] = p1;
  let [x1, z1] = p2;
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const checks = [
    [-dx, x0 - MIN_X],
    [dx, MAX_X - x0],
    [-dz, z0 - MIN_Z],
    [dz, MAX_Z - z0],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [
    [Math.round((x0 + t0 * dx) * 10) / 10, Math.round((z0 + t0 * dz) * 10) / 10],
    [Math.round((x0 + t1 * dx) * 10) / 10, Math.round((z0 + t1 * dz) * 10) / 10],
  ];
}

function clipPolyline(pts) {
  const chains = [];
  let current = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = clipSegment(pts[i], pts[i + 1]);
    if (seg) {
      if (current.length === 0) {
        current.push(seg[0], seg[1]);
      } else {
        const last = current[current.length - 1];
        if (Math.hypot(last[0] - seg[0][0], last[1] - seg[0][1]) < 0.3) {
          current.push(seg[1]);
        } else {
          chains.push(current);
          current = [seg[0], seg[1]];
        }
      }
    } else if (current.length > 0) {
      chains.push(current);
      current = [];
    }
  }
  if (current.length > 0) chains.push(current);
  return chains;
}

const roads = [];
const buildings = [];
const pois = [];
const nodeDeg = new Map();

for (const w of ways.values()) {
  const rawNodes = w.nds.map((id) => nodes.get(id)).filter(Boolean);
  if (rawNodes.length < 2) continue;
  const pts = rawNodes.map((n) => toMetric(n.lat, n.lon));

  if (w.tags.highway) {
    const hw = w.tags.highway;
    // Skip footway bridges that are noise unless valid, keep all mapped roads/paths/steps
    const chains = clipPolyline(pts);
    for (let ci = 0; ci < chains.length; ci++) {
      const ch = chains[ci];
      if (ch.length < 2) continue;
      let len = 0;
      for (let i = 1; i < ch.length; i++) {
        len += Math.hypot(ch[i][0] - ch[i - 1][0], ch[i][1] - ch[i - 1][1]);
      }
      if (len < 1.5) continue;
      const isBridge =
        (hw === 'trunk' || hw === 'trunk_link') &&
        Boolean(w.tags.bridge || (w.tags.layer && parseInt(w.tags.layer, 10) > 0));
      roads.push({
        id: ci === 0 ? w.id : `${w.id}_${ci}`,
        hw,
        name: w.tags.name || '',
        oneway: w.tags.oneway === 'yes',
        bridge: isBridge,
        layer: parseInt(w.tags.layer || '0', 10) || 0,
        pts: ch,
      });
    }
    for (let i = 0; i < rawNodes.length; i++) {
      const pt = toMetric(rawNodes[i].lat, rawNodes[i].lon);
      if (inPlayable(pt)) {
        const nid = rawNodes[i].id;
        nodeDeg.set(nid, (nodeDeg.get(nid) || 0) + (i > 0 && i < rawNodes.length - 1 ? 2 : 1));
      }
    }
  } else if (w.tags.building) {
    let sx = 0;
    let sz = 0;
    for (const [x, z] of pts) {
      sx += x;
      sz += z;
    }
    const cx = Math.round((sx / pts.length) * 10) / 10;
    const cz = Math.round((sz / pts.length) * 10) / 10;
    if (!inPlayable([cx, cz])) continue;
    const poly =
      pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]
        ? pts.slice(0, -1)
        : pts;
    if (poly.length < 3) continue;

    // Compute footprint area via shoelace
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i];
      const [x2, z2] = poly[(i + 1) % poly.length];
      area += x1 * z2 - x2 * z1;
    }
    area = Math.abs(area) * 0.5;
    if (area < 4) continue;

    const bType = w.tags.amenity || w.tags.shop || w.tags.building || 'yes';
    const levels = parseInt(w.tags['building:levels'] || '0', 10) || 0;
    buildings.push({
      id: w.id,
      name: w.tags.name || '',
      type: bType,
      levels,
      cx,
      cz,
      area: Math.round(area),
      poly,
    });
  }
}

for (const n of nodes.values()) {
  const [x, z] = toMetric(n.lat, n.lon);
  if (!inPlayable([x, z])) continue;
  if (n.tags.amenity || n.tags.shop || n.tags.highway === 'bus_stop' || n.tags.place || n.tags.natural === 'peak') {
    pois.push({
      id: n.id,
      lat: n.lat,
      lon: n.lon,
      x,
      z,
      name: n.tags.name || '',
      kind: n.tags.highway === 'bus_stop' ? 'bus_stop' : (n.tags.amenity || n.tags.shop || n.tags.place || n.tags.natural || 'poi'),
    });
  }
}

let intersections = 0;
for (const d of nodeDeg.values()) {
  if (d >= 3) intersections++;
}

const elevRaw = JSON.parse(fs.readFileSync('/tmp/lalkhan_gis/elevation_grid.json', 'utf8'));

// Convert elevation grid to metric origin-referenced bounds
const [eMinX, eMaxZ] = toMetric(elevRaw.minLat, elevRaw.minLon); // SW corner (minLon, minLat -> minX, maxZ)
const [eMaxX, eMinZ] = toMetric(elevRaw.maxLat, elevRaw.maxLon); // NE corner

const totalRoadLen = Math.round(
  roads.reduce((sum, r) => {
    let l = 0;
    for (let i = 1; i < r.pts.length; i++) {
      l += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
    }
    return sum + l;
  }, 0)
);

const output = {
  meta: {
    originLat: LAT0,
    originLon: LON0,
    boundsMetric: { minX: MIN_X, maxX: MAX_X, minZ: MIN_Z, maxZ: MAX_Z },
    nsExtentM: MAX_Z - MIN_Z,
    ewExtentM: MAX_X - MIN_X,
    mappedAreaSqM: (MAX_X - MIN_X) * (MAX_Z - MIN_Z),
    totalRoadLengthM: totalRoadLen,
    roadCount: roads.length,
    buildingCount: buildings.length,
    intersectionCount: intersections,
    elevationMinM: elevRaw.minE,
    elevationMaxM: elevRaw.maxE,
    attribution: 'OpenStreetMap contributors (ODbL) & NASA SRTM 30m DEM',
  },
  elevation: {
    rows: elevRaw.rows,
    cols: elevRaw.cols,
    minX: eMinX,
    maxX: eMaxX,
    minZ: eMinZ,
    maxZ: eMaxZ,
    minE: elevRaw.minE,
    maxE: elevRaw.maxE,
    values: elevRaw.elevations,
  },
  roads,
  buildings,
  pois,
};

fs.mkdirSync(path.resolve('src/data'), { recursive: true });
fs.writeFileSync(path.resolve('src/data/lalkhanGisData.json'), JSON.stringify(output));
console.log('Generated src/data/lalkhanGisData.json:', JSON.stringify(output.meta, null, 2));
