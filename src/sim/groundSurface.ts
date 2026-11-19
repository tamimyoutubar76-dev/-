import { GIS_DATA, GisRoad } from '../gis/projection';
import { getRoadWidth } from './roadGraph';
import { sampleElevationASL } from './terrain';
import { NEW_MARKET_CONNECTOR_ROADS } from './newMarketAndShops';

export type GroundSurface = 'concrete' | 'grass' | 'gravel';

export interface FootstepAudioProfile {
  surface: GroundSurface;
  label: string;
  impactFreqHz: number;
  filterFreqHz: number;
  filterQ: number;
  noiseGain: number;
  thudGain: number;
  durationSec: number;
  grainCount: number;
}

export const FOOTSTEP_PROFILES: Record<GroundSurface, FootstepAudioProfile> = {
  concrete: {
    surface: 'concrete',
    label: 'Concrete',
    impactFreqHz: 128,
    filterFreqHz: 1150,
    filterQ: 1.4,
    noiseGain: 0.042,
    thudGain: 0.048,
    durationSec: 0.055,
    grainCount: 1,
  },
  grass: {
    surface: 'grass',
    label: 'Grass',
    impactFreqHz: 72,
    filterFreqHz: 620,
    filterQ: 0.75,
    noiseGain: 0.036,
    thudGain: 0.02,
    durationSec: 0.115,
    grainCount: 1,
  },
  gravel: {
    surface: 'gravel',
    label: 'Gravel',
    impactFreqHz: 175,
    filterFreqHz: 2650,
    filterQ: 1.9,
    noiseGain: 0.052,
    thudGain: 0.028,
    durationSec: 0.095,
    grainCount: 3,
  },
};

export function getFootstepAudioProfile(surface: GroundSurface): FootstepAudioProfile {
  return FOOTSTEP_PROFILES[surface];
}

interface IndexedRoadSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  lenSq: number;
  hw: string;
  pavedHalfW: number;
  shoulderHalfW: number;
  isGravelPath: boolean;
}

const GRID_CELL_M = 40;

function gridKey(cx: number, cz: number): number {
  return ((cx + 512) << 12) | (cz + 512);
}

function buildRoadSurfaceGrid(roads: GisRoad[]): Map<number, IndexedRoadSegment[]> {
  const cells = new Map<number, IndexedRoadSegment[]>();

  for (const r of roads) {
    if (r.bridge || r.pts.length < 2) continue;
    const hw = r.hw;
    const halfW = getRoadWidth(hw) * 0.5;
    const isGravelPath = hw === 'footway' || hw === 'path';

    // Match exact visual sidewalk/road ribbon widths in roadAndFlyoverSystem.ts
    const sidewalkExtra =
      hw === 'trunk' || hw === 'trunk_link' || hw === 'primary'
        ? 2.0
        : hw === 'secondary' || hw === 'secondary_link' || hw === 'tertiary'
          ? 1.3
          : isGravelPath
            ? 0.5
            : 0.4;

    const pavedHalfW = halfW + sidewalkExtra;
    const shoulderHalfW = pavedHalfW + (isGravelPath ? 0.6 : 2.1);

    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, z1] = r.pts[i];
      const [x2, z2] = r.pts[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const lenSq = dx * dx + dz * dz;
      if (lenSq < 0.01) continue;

      const seg: IndexedRoadSegment = {
        x1,
        z1,
        x2,
        z2,
        lenSq,
        hw,
        pavedHalfW,
        shoulderHalfW,
        isGravelPath,
      };

      const minCx = Math.floor((Math.min(x1, x2) - shoulderHalfW - 2) / GRID_CELL_M);
      const maxCx = Math.floor((Math.max(x1, x2) + shoulderHalfW + 2) / GRID_CELL_M);
      const minCz = Math.floor((Math.min(z1, z2) - shoulderHalfW - 2) / GRID_CELL_M);
      const maxCz = Math.floor((Math.max(z1, z2) + shoulderHalfW + 2) / GRID_CELL_M);

      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          const k = gridKey(cx, cz);
          let arr = cells.get(k);
          if (!arr) {
            arr = [];
            cells.set(k, arr);
          }
          arr.push(seg);
        }
      }
    }
  }

  return cells;
}

const ROAD_SURFACE_GRID = buildRoadSurfaceGrid([...GIS_DATA.roads, ...NEW_MARKET_CONNECTOR_ROADS]);

export interface SurfaceDetectionInput {
  x: number;
  z: number;
  onFlyover?: boolean;
  insideLandmark?: boolean;
}

/**
 * Detects the ground material (`concrete`, `grass`, or `gravel`) under (x, z)
 * matching Lalkhan Bazar's 3D road/sidewalk/hill/footpath geometry and SRTM terrain zones.
 */
export function detectGroundSurface(input: SurfaceDetectionInput): GroundSurface {
  if (input.onFlyover || input.insideLandmark) {
    return 'concrete';
  }

  const { x, z } = input;
  // Paved Chattogram New Market Plaza Courtyard
  if (x >= 838 && x <= 955 && z >= 445 && z <= 635) {
    return 'concrete';
  }
  const cx = Math.floor(x / GRID_CELL_M);
  const cz = Math.floor(z / GRID_CELL_M);

  let onConcrete = false;
  let onGravel = false;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const segs = ROAD_SURFACE_GRID.get(gridKey(cx + dx, cz + dz));
      if (!segs) continue;
      for (const s of segs) {
        const vx = s.x2 - s.x1;
        const vz = s.z2 - s.z1;
        const t = Math.max(0, Math.min(1, ((x - s.x1) * vx + (z - s.z1) * vz) / s.lenSq));
        const px = s.x1 + t * vx;
        const pz = s.z1 + t * vz;
        const dist = Math.hypot(x - px, z - pz);

        if (dist <= s.pavedHalfW) {
          if (s.isGravelPath) {
            onGravel = true;
          } else {
            onConcrete = true;
          }
        } else if (dist <= s.shoulderHalfW) {
          onGravel = true;
        }
      }
    }
  }

  if (onConcrete) return 'concrete';
  if (onGravel) return 'gravel';

  // Match terrainSystem.ts surface material zoning:
  // Low eastern valley bare soil/gravel vs lush Batali/Motijharna hill slopes & green pockets
  const asl = sampleElevationASL(x, z);
  if (asl < 23 && x > 180) {
    return 'gravel';
  }
  return 'grass';
}
