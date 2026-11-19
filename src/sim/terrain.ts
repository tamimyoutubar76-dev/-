import { GIS_DATA, GisRoad } from '../gis/projection';

const elev = GIS_DATA.elevation;

// Base valley datum: 12m above sea level corresponds to Y=0 in local scene space,
// or we preserve true ASL minus 10m datum so roads sit comfortably at Y ~ 2..15m
// while hills rise to Y ~ 49m (59m ASL). Let's expose both trueASL and sceneY!
export const SEA_LEVEL_DATUM_M = 10;

/**
 * Sample raw SRTM 30m digital elevation model in meters above sea level (ASL).
 * Bilinearly interpolated over the 25x25 real elevation grid covering Lalkhan Bazar.
 */
export function sampleElevationASL(x: number, z: number): number {
  // Note: elev.minZ is North (negative Z, top row), elev.maxZ is South (positive Z, bottom row)
  // In build_lalkhan_gis.mjs: rows went minLat (maxZ) -> maxLat (minZ)
  const uRaw = (x - elev.minX) / (elev.maxX - elev.minX);
  const vRaw = (elev.maxZ - z) / (elev.maxZ - elev.minZ);

  const u = Math.max(0, Math.min(1, uRaw));
  const v = Math.max(0, Math.min(1, vRaw));

  const cFloat = u * (elev.cols - 1);
  const rFloat = v * (elev.rows - 1);
  const c0 = Math.floor(cFloat);
  const r0 = Math.floor(rFloat);
  const c1 = Math.min(elev.cols - 1, c0 + 1);
  const r1 = Math.min(elev.rows - 1, r0 + 1);
  const tx = cFloat - c0;
  const tz = rFloat - r0;

  const h00 = elev.values[r0 * elev.cols + c0];
  const h10 = elev.values[r0 * elev.cols + c1];
  const h01 = elev.values[r1 * elev.cols + c0];
  const h11 = elev.values[r1 * elev.cols + c1];

  const top = h00 * (1 - tx) + h10 * tx;
  const bot = h01 * (1 - tx) + h11 * tx;
  let base = top * (1 - tz) + bot * tz;

  // Fine local micro-ridge fidelity for Batali Hill & Motijharna steep slopes
  // while keeping CDA Avenue east corridor smooth and level along its valley floor
  const eastValleyMask = Math.max(0, Math.min(1, (220 - x) / 260));
  const micro =
    eastValleyMask *
    (Math.sin(x * 0.025) * Math.cos(z * 0.022) * 1.4 +
      Math.sin((x + z) * 0.045) * 0.6);

  // Smoothly flatten CDA Avenue corridor (x around 240..560, z around -680..760)
  // so major multi-lane urban arteries don't have 30m DEM quantization ripples
  const corridorX = 360 - z * 0.28;
  const distToCda = Math.abs(x - corridorX);
  if (distToCda < 90) {
    const blend = Math.max(0, 1 - distToCda / 90);
    const smoothVal = 18 + Math.max(0, (z + 680) / 1440) * 3;
    base = base * (1 - blend * 0.72) + smoothVal * (blend * 0.72);
  }

  // Smooth urban terrace for Ameen Center & Plaza at Ispahani Moor (center x:270, z:246, yaw:0.76)
  // Prevents hill triangles from poking through Ground Floor tiles and aligns front sidewalk flush with CDA Ave.
  if (x > 235 && x < 305 && z > 215 && z < 285) {
    const dxA = x - 270.0;
    const dzA = z - 246.0;
    const cA = Math.cos(0.76);
    const sA = Math.sin(0.76);
    const lx = dxA * cA - dzA * sA;
    const lz = dxA * sA + dzA * cA;
    const padExX = Math.max(0, Math.abs(lx) - 18.5);
    const padExZ = Math.max(-9.5 - lz, 0, lz - 17.5);
    const edgeD = Math.hypot(padExX, padExZ);
    const aBlend = Math.max(0, Math.min(1, 1 - edgeD / 11));
    if (aBlend > 0) {
      const ameenElevASL = 22.25;
      base = base * (1 - aBlend) + ameenElevASL * aBlend;
      return base + micro * (1 - aBlend);
    }
  }

  // Smooth urban terrace for Chattogram New Market Plaza (x ∈ [785..975], z ∈ [355..665])
  if (x > 750 && x < 1010 && z > 320 && z < 700) {
    const dxBox = Math.max(785 - x, 0, x - 975);
    const dzBox = Math.max(355 - z, 0, z - 665);
    const edgeDist = Math.hypot(dxBox, dzBox);
    const nmBlend = Math.max(0, Math.min(1, 1 - edgeDist / 38));
    const nmElevASL = 20.6;
    base = base * (1 - nmBlend) + nmElevASL * nmBlend;
    return base + micro * (1 - nmBlend);
  }

  return base + micro;
}

/** Scene Y coordinate in meters (1 game meter = 1 real-world meter) */
export function getTerrainHeight(x: number, z: number): number {
  return sampleElevationASL(x, z) - SEA_LEVEL_DATUM_M;
}

export function getTerrainNormal(x: number, z: number): [number, number, number] {
  const eps = 1.5;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  const nx = hL - hR;
  const ny = 2 * eps;
  const nz = hD - hU;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

export interface FlyoverSegment {
  id: string;
  name: string;
  x1: number;
  z1: number;
  y1: number;
  x2: number;
  z2: number;
  y2: number;
  halfWidth: number;
  isRamp: boolean;
}

const FLYOVER_DECK_CLEARANCE = 8.6; // meters above ground road surface

function subdividePointsWithStep(pts: [number, number][], maxStepM = 10): [number, number][] {
  if (pts.length < 2) return pts;
  const out: [number, number][] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[i + 1];
    const d = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(1, Math.ceil(d / maxStepM));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]);
    }
  }
  return out;
}

function buildFlyoverSegments(): FlyoverSegment[] {
  const segs: FlyoverSegment[] = [];
  const flyoverWays: GisRoad[] = GIS_DATA.roads.filter((r) => r.bridge);

  for (const w of flyoverWays) {
    const subPts = subdividePointsWithStep(w.pts, 10);
    const n = subPts.length;
    const cumDist: number[] = [0];
    for (let i = 1; i < n; i++) {
      cumDist.push(
        cumDist[i - 1] + Math.hypot(subPts[i][0] - subPts[i - 1][0], subPts[i][1] - subPts[i - 1][1])
      );
    }
    const totalLen = cumDist[n - 1] || 1;

    const heights: number[] = subPts.map(([px, pz], idx) => {
      const gY = getTerrainHeight(px, pz);
      if (w.id === '1353155841') {
        // Touches down at end ([214.8, 371.1])
        const distFromEnd = totalLen - cumDist[idx];
        const rampFactor = Math.min(1, distFromEnd / 145);
        return gY + rampFactor * FLYOVER_DECK_CLEARANCE;
      }
      if (w.id === '1486307111') {
        const t = cumDist[idx] / totalLen;
        return gY + 1.8 + t * 0.8;
      }
      return gY + FLYOVER_DECK_CLEARANCE;
    });

    const halfW = w.hw === 'trunk_link' ? 4.0 : 5.4;
    for (let i = 0; i < n - 1; i++) {
      segs.push({
        id: `${w.id}_${i}`,
        name: w.name || 'Elevated Expressway / Flyover',
        x1: subPts[i][0],
        z1: subPts[i][1],
        y1: heights[i],
        x2: subPts[i + 1][0],
        z2: subPts[i + 1][1],
        y2: heights[i + 1],
        halfWidth: halfW,
        isRamp: w.id === '1353155841' || w.id === '1486307111',
      });
    }
  }

  // Connecting ramp segments from OSM `1486307110`, `1486307108` and `1414354151`
  const rampIds = ['1486307110', '1486307108', '1414354151'];
  for (const rId of rampIds) {
    const rw = GIS_DATA.roads.find((r) => r.id === rId);
    if (!rw || rw.pts.length < 2) continue;
    const subPts = subdividePointsWithStep(rw.pts, 10);
    const n = subPts.length;
    const cum: number[] = [0];
    for (let i = 1; i < n; i++) {
      cum.push(cum[i - 1] + Math.hypot(subPts[i][0] - subPts[i - 1][0], subPts[i][1] - subPts[i - 1][1]));
    }
    const tot = cum[n - 1] || 1;
    const hs = subPts.map(([px, pz], idx) => {
      const gY = getTerrainHeight(px, pz);
      const t = cum[idx] / tot;
      if (rId === '1486307110') {
        return gY + t * 1.8;
      }
      if (rId === '1486307108') {
        return gY + 2.6 + t * (FLYOVER_DECK_CLEARANCE - 2.6);
      }
      return gY + FLYOVER_DECK_CLEARANCE * (1 - t * 0.12);
    });
    for (let i = 0; i < n - 1; i++) {
      segs.push({
        id: `${rw.id}_r_${i}`,
        name: rw.name || 'Flyover Ramp',
        x1: subPts[i][0],
        z1: subPts[i][1],
        y1: hs[i],
        x2: subPts[i + 1][0],
        z2: subPts[i + 1][1],
        y2: hs[i + 1],
        halfWidth: 4.1,
        isRamp: true,
      });
    }
  }

  return segs;
}

export const FLYOVER_SEGMENTS: FlyoverSegment[] = buildFlyoverSegments();

/**
 * Returns the elevated flyover surface Y if (x, z) lies over a flyover deck or ramp,
 * or null otherwise.
 */
export function sampleFlyoverHeightAt(x: number, z: number): { y: number; name: string; isRamp: boolean } | null {
  let best: { y: number; name: string; isRamp: boolean; dist: number } | null = null;
  for (const s of FLYOVER_SEGMENTS) {
    const dx = s.x2 - s.x1;
    const dz = s.z2 - s.z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.01) continue;
    const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (z - s.z1) * dz) / lenSq));
    const px = s.x1 + t * dx;
    const pz = s.z1 + t * dz;
    const d = Math.hypot(x - px, z - pz);
    if (d <= s.halfWidth + 0.6) {
      const y = s.y1 + t * (s.y2 - s.y1);
      if (!best || d < best.dist) {
        best = { y, name: s.name, isRamp: s.isRamp, dist: d };
      }
    }
  }
  return best ? { y: best.y, name: best.name, isRamp: best.isRamp } : null;
}

/**
 * Resolves the walkable/driveable surface height at (x, z) given the actor's current Y.
 * Allows walking/driving smoothly underneath the flyover on CDA Avenue OR on top of the flyover
 * via ramps without teleporting upward from the ground street.
 */
export function resolveSupportSurfaceHeight(
  x: number,
  z: number,
  currentY: number
): { y: number; onFlyover: boolean; surfaceName: string } {
  let groundY = getTerrainHeight(x, z);

  // Check raised paved sidewalk apron immediately in front of Ameen Center
  if (x > 240 && x < 305 && z > 220 && z < 285) {
    const dxA = x - 270.0;
    const dzA = z - 246.0;
    const cA = Math.cos(0.76);
    const sA = Math.sin(0.76);
    const lx = dxA * cA - dzA * sA;
    const lz = dxA * sA + dzA * cA;
    if (Math.abs(lx) <= 19.0 && lz >= 7.8 && lz <= 16.8) {
      const ameenBaseY = getTerrainHeight(270.0, 246.0);
      groundY = Math.max(groundY, ameenBaseY + 0.14);
      return { y: groundY, onFlyover: false, surfaceName: 'Ameen Center Plaza' };
    }
  }

  const fly = sampleFlyoverHeightAt(x, z);
  if (fly) {
    // Snap to flyover if actor is already near deck elevation OR on the ground-touching ramp mouth
    const clearanceAboveGround = fly.y - groundY;
    if (currentY >= fly.y - 2.2 || clearanceAboveGround < 2.2) {
      return { y: fly.y, onFlyover: clearanceAboveGround > 1.0, surfaceName: fly.name };
    }
  }
  return { y: groundY, onFlyover: false, surfaceName: 'Ground Terrain' };
}
