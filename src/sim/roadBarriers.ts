import { GIS_DATA } from '../gis/projection';
import { FLYOVER_SEGMENTS, getTerrainHeight } from './terrain';

export type BarrierKind =
  | 'concrete_divider'
  | 'low_metal_barrier'
  | 'flyover_wall'
  | 'flyover_divider';

export interface SegmentBarrierCollider {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  baseY1: number;
  baseY2: number;
  height: number;
  halfWidth: number;
  jumpable: boolean;
  onFlyoverOnly: boolean;
  kind: BarrierKind;
}

export interface UTurnOpening {
  id: string;
  name: string;
  bengaliName: string;
  x: number;
  z: number;
  radius: number;
  yaw: number;
}

export interface ZebraCrossingSpec {
  id: string;
  x: number;
  z: number;
  yaw: number;
  width: number;
  length: number;
}

export const U_TURN_OPENINGS: UTurnOpening[] = [
  {
    id: 'uturn_tigerpass_mid',
    name: 'CDA Avenue South U-Turn',
    bengaliName: 'ইউ-টার্ন · টাইগারপাস মোড়',
    x: 146,
    z: 482,
    radius: 14.0,
    yaw: 0.56,
  },
  {
    id: 'uturn_lalkhan_bazar',
    name: 'Lalkhan Bazar U-Turn Bay',
    bengaliName: 'ইউ-টার্ন · লালখান বাজার',
    x: 344,
    z: 243,
    radius: 13.5,
    yaw: 0.78,
  },
  {
    id: 'uturn_wasa_approach',
    name: 'WASA Approach U-Turn',
    bengaliName: 'ইউ-টার্ন · ওয়াসা সড়ক',
    x: 534,
    z: -305,
    radius: 13.5,
    yaw: 0.04,
  },
  {
    id: 'uturn_new_market_entry',
    name: 'Saifuddin Khaled · New Market U-Turn',
    bengaliName: 'ইউ-টার্ন · নিউ মার্কেট',
    x: 724,
    z: 386,
    radius: 12.0,
    yaw: 1.42,
  },
];

export const ZEBRA_CROSSINGS: ZebraCrossingSpec[] = [
  { id: 'zb_ispahani_south', x: 256, z: 344, yaw: 0.65, width: 11.5, length: 3.4 },
  { id: 'zb_ispahani_north', x: 294, z: 291, yaw: 0.78, width: 11.5, length: 3.4 },
  { id: 'zb_lalkhan_jx', x: 428, z: 162, yaw: 0.72, width: 11.5, length: 3.4 },
  { id: 'zb_wasa_sq', x: 539, z: -135, yaw: 0.08, width: 11.5, length: 3.4 },
  { id: 'zb_new_market_gate', x: 842, z: 540, yaw: Math.PI * 0.5, width: 9.2, length: 3.8 },
];

const INTERSECTION_EXCLUSIONS: { x: number; z: number; r: number }[] = [
  { x: 268.7, z: 324.1, r: 22.0 }, // Ispahani Circle
  { x: 415.5, z: 167.3, r: 19.0 }, // Lalkhan Bazar Junction
  { x: 540.0, z: -145.0, r: 21.0 }, // WASA Square
  { x: 648.0, z: 400.0, r: 14.0 }, // Saifuddin Khaled / CRB junction
];

function isCutoutPoint(x: number, z: number): boolean {
  for (const ex of INTERSECTION_EXCLUSIONS) {
    if (Math.hypot(x - ex.x, z - ex.z) < ex.r) return true;
  }
  for (const ut of U_TURN_OPENINGS) {
    if (Math.hypot(x - ut.x, z - ut.z) < ut.radius) return true;
  }
  return false;
}

export function isInsideUTurnOpening(x: number, z: number): UTurnOpening | null {
  for (const ut of U_TURN_OPENINGS) {
    if (Math.hypot(x - ut.x, z - ut.z) <= ut.radius) return ut;
  }
  return null;
}

function closestPointOnPolyline(x: number, z: number, pts: [number, number][]): [number, number] {
  let bestX = pts[0][0];
  let bestZ = pts[0][1];
  let bestD2 = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const l2 = dx * dx + dz * dz;
    const t = l2 > 0.001 ? Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l2)) : 0;
    const px = x1 + t * dx;
    const pz = z1 + t * dz;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestX = px;
      bestZ = pz;
    }
  }
  return [bestX, bestZ];
}

function appendSubdividedBarrierLine(
  out: SegmentBarrierCollider[],
  prefix: string,
  pts: [number, number][],
  opts: {
    height: number;
    halfWidth: number;
    jumpable: boolean;
    kind: BarrierKind;
    stepM?: number;
    respectCutouts?: boolean;
  }
) {
  const stepM = opts.stepM ?? 7.5;
  let segIdx = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dist = Math.hypot(bx - ax, bz - az);
    const nSteps = Math.max(1, Math.ceil(dist / stepM));

    for (let s = 0; s < nSteps; s++) {
      const t0 = s / nSteps;
      const t1 = (s + 1) / nSteps;
      const x1 = ax + (bx - ax) * t0;
      const z1 = az + (bz - az) * t0;
      const x2 = ax + (bx - ax) * t1;
      const z2 = az + (bz - az) * t1;
      const mx = (x1 + x2) * 0.5;
      const mz = (z1 + z2) * 0.5;
      if (opts.respectCutouts && isCutoutPoint(mx, mz)) continue;

      out.push({
        id: `${prefix}_${segIdx++}`,
        x1,
        z1,
        x2,
        z2,
        baseY1: getTerrainHeight(x1, z1),
        baseY2: getTerrainHeight(x2, z2),
        height: opts.height,
        halfWidth: opts.halfWidth,
        jumpable: opts.jumpable,
        onFlyoverOnly: false,
        kind: opts.kind,
      });
    }
  }
}

export interface RoadBarrierDataset {
  allBarriers: SegmentBarrierCollider[];
  groundDividers: SegmentBarrierCollider[];
  flyoverBarriers: SegmentBarrierCollider[];
  flyoverDividers: SegmentBarrierCollider[];
}

function buildDataset(): RoadBarrierDataset {
  const groundDividers: SegmentBarrierCollider[] = [];
  const flyoverBarriers: SegmentBarrierCollider[] = [];
  const flyoverDividers: SegmentBarrierCollider[] = [];

  // 1. CDA Avenue North Dual-Carriageway Center Median Divider (between OSM 692035963 & 390357872)
  const cdaNorthUp = GIS_DATA.roads.find((r) => r.id === '692035963');
  const cdaNorthDn = GIS_DATA.roads.find((r) => r.id === '390357872');
  if (cdaNorthUp && cdaNorthDn) {
    const medianPts: [number, number][] = cdaNorthUp.pts.map(([x, z]) => {
      const [ox, oz] = closestPointOnPolyline(x, z, cdaNorthDn.pts);
      return [(x + ox) * 0.5, (z + oz) * 0.5];
    });
    appendSubdividedBarrierLine(groundDividers, 'cda_n_div', medianPts, {
      height: 1.28,
      halfWidth: 0.42,
      jumpable: false,
      kind: 'concrete_divider',
      respectCutouts: true,
    });
  }

  // 2. CDA Avenue South Dual-Carriageway Center Median Divider (between OSM 232761328 & 252243712)
  const cdaSouthUp = GIS_DATA.roads.find((r) => r.id === '232761328');
  const cdaSouthDn = GIS_DATA.roads.find((r) => r.id === '252243712');
  if (cdaSouthUp && cdaSouthDn) {
    const medianPts: [number, number][] = cdaSouthUp.pts.map(([x, z]) => {
      const [ox, oz] = closestPointOnPolyline(x, z, cdaSouthDn.pts);
      return [(x + ox) * 0.5, (z + oz) * 0.5];
    });
    appendSubdividedBarrierLine(groundDividers, 'cda_s_div', medianPts, {
      height: 1.28,
      halfWidth: 0.42,
      jumpable: false,
      kind: 'concrete_divider',
      respectCutouts: true,
    });
  }

  // 3. Low Jumpable Pedestrian & Lane Guardrail Barriers (height 0.56m -> walkable block, player Space jump clears 1.04m, vehicles always blocked)
  // Placed along Ispahani Circle approach median, Saifuddin Khaled market strip & New Market approach median
  const lowJumpableLines: [number, number][][] = [
    // Near Ispahani South sidewalk/median strip (reachable immediately from spawn!)
    [
      [268.0, 353.0],
      [252.0, 376.0],
    ],
    // Along Saifuddin Khaled Market corridor east of Ispahani
    [
      [425.0, 344.0],
      [535.0, 368.0],
    ],
    // Along New Market entrance boulevard median (north & south of pedestrian crosswalk)
    [
      [842.0, 468.0],
      [842.0, 524.0],
    ],
    [
      [842.0, 556.0],
      [842.0, 598.0],
    ],
  ];
  lowJumpableLines.forEach((line, idx) => {
    appendSubdividedBarrierLine(groundDividers, `low_bar_${idx}`, line, {
      height: 0.56,
      halfWidth: 0.22,
      jumpable: true,
      kind: 'low_metal_barrier',
      stepM: 6,
      respectCutouts: false,
    });
  });

  // 4. Tall Concrete Road Dividers along Saifuddin Khaled East & Neval-New Market Link (with U-turn opening at x=724)
  appendSubdividedBarrierLine(
    groundDividers,
    'sk_east_div',
    [
      [665, 396],
      [790, 374],
    ],
    {
      height: 1.24,
      halfWidth: 0.34,
      jumpable: false,
      kind: 'concrete_divider',
      respectCutouts: true,
    }
  );

  // 5. Flyover Side Safety Barriers & Center Direction Divider
  for (let i = 0; i < FLYOVER_SEGMENTS.length; i++) {
    const s = FLYOVER_SEGMENTS[i];
    const dx = s.x2 - s.x1;
    const dz = s.z2 - s.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.4) continue;
    const nx = -dz / len;
    const nz = dx / len;
    const sideOff = s.halfWidth - 0.25;

    flyoverBarriers.push({
      id: `fly_wall_L_${i}`,
      x1: s.x1 + nx * sideOff,
      z1: s.z1 + nz * sideOff,
      x2: s.x2 + nx * sideOff,
      z2: s.z2 + nz * sideOff,
      baseY1: s.y1,
      baseY2: s.y2,
      height: 1.25,
      halfWidth: 0.28,
      jumpable: false,
      onFlyoverOnly: true,
      kind: 'flyover_wall',
    });

    flyoverBarriers.push({
      id: `fly_wall_R_${i}`,
      x1: s.x1 - nx * sideOff,
      z1: s.z1 - nz * sideOff,
      x2: s.x2 - nx * sideOff,
      z2: s.z2 - nz * sideOff,
      baseY1: s.y1,
      baseY2: s.y2,
      height: 1.25,
      halfWidth: 0.28,
      jumpable: false,
      onFlyoverOnly: true,
      kind: 'flyover_wall',
    });

    // Center divider separating opposing traffic lanes on main elevated viaducts
    if (!s.isRamp && s.halfWidth >= 4.8) {
      flyoverDividers.push({
        id: `fly_center_${i}`,
        x1: s.x1,
        z1: s.z1,
        x2: s.x2,
        z2: s.z2,
        baseY1: s.y1,
        baseY2: s.y2,
        height: 1.05,
        halfWidth: 0.24,
        jumpable: false,
        onFlyoverOnly: true,
        kind: 'flyover_divider',
      });
    }
  }

  return {
    allBarriers: [...groundDividers, ...flyoverBarriers, ...flyoverDividers],
    groundDividers,
    flyoverBarriers,
    flyoverDividers,
  };
}

export const ROAD_BARRIERS: RoadBarrierDataset = buildDataset();
