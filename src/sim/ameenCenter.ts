import { ShopItem } from '../gis/landmarks';

export const AMEEN_CENTER_SPEC = {
  id: 'amin_centre',
  name: 'Ameen Center',
  bengaliName: 'আমিন সেন্টার',
  x: 270.0,
  z: 246.0,
  yaw: 0.76,
  width: 32.0, // local X: -16 .. +16
  depth: 16.0, // local Z: -8 .. +8 (+Z faces SE toward CDA Avenue)
  floors: 3, // Floor 0 (Ground Retail), Floor 1 (Mezzanine), Floor 2 (Private Home Apartment), Floor 3 (Rooftop)
  floorHeight: 4.2,
  slabOffsetY: 0.14,
  doorHalfWidth: 2.5,
  stairBounds: {
    // Wide continuous escalator/stair ramp along left-rear arcade: Z = +3.2 (bottom) -> Z = -5.6 (top landing)
    minX: -10.0,
    maxX: -6.4,
    zBottom: 3.2,
    zTop: -5.6,
  },
  elevatorPos: {
    lx: 12.6,
    lz: -5.4,
    radius: 2.0,
  },
} as const;

// Spawn point directly in front of Ameen Center's main entrance on the wide front sidewalk apron,
// facing NW (-2.38 rad) straight toward the blue AMEEN CENTER portal & open glass double doors.
export const AMEEN_FRONT_SPAWN = {
  x: 281.8,
  z: 258.5,
  yaw: -2.38,
};

export interface AmeenGroundShop {
  id: string;
  brand: string;
  bengaliName: string;
  wing: 'left' | 'right';
  bannerColor: string;
  textColor: string;
  lxCenter: number;
  width: number;
  counterLz: number;
  items: ShopItem[];
}

export const AMEEN_GROUND_SHOPS: AmeenGroundShop[] = [
  {
    id: 'ameen_shop_bata',
    brand: 'Bata',
    bengaliName: 'বাটা জুতা শো-রুম',
    wing: 'left',
    bannerColor: '#d92323',
    textColor: '#ffffff',
    lxCenter: -14.1,
    width: 3.3,
    counterLz: 2.4,
    items: [
      { id: 'bata_loafers', name: 'Bata Comfit Loafers', bengaliName: 'বাটা লোফার্স', priceBdt: 480, energyGain: 15, kind: 'item' },
      { id: 'bata_sandal', name: 'Bata Leather Sandals', bengaliName: 'বাটা চামড়ার স্যান্ডেল', priceBdt: 320, energyGain: 12, kind: 'item' },
    ],
  },
  {
    id: 'ameen_shop_oppo',
    brand: 'oppo',
    bengaliName: 'অপো মোবাইল স্টোর',
    wing: 'left',
    bannerColor: '#15803d',
    textColor: '#ffffff',
    lxCenter: -10.8,
    width: 3.3,
    counterLz: 2.4,
    items: [
      { id: 'oppo_reno_case', name: 'OPPO Fast Charger & Case', bengaliName: 'অপো ফাস্ট চার্জার', priceBdt: 350, energyGain: 14, kind: 'item' },
    ],
  },
  {
    id: 'ameen_shop_samsung',
    brand: 'SAMSUNG',
    bengaliName: 'স্যামসাং এক্সপেরিয়েন্স জোন',
    wing: 'left',
    bannerColor: '#133899',
    textColor: '#ffffff',
    lxCenter: -7.5,
    width: 3.3,
    counterLz: 2.4,
    items: [
      { id: 'samsung_buds', name: 'Galaxy Wireless Earbuds', bengaliName: 'গ্যালাক্সি বাডস', priceBdt: 650, energyGain: 18, kind: 'item' },
    ],
  },
  {
    id: 'ameen_shop_vivo',
    brand: 'vivo',
    bengaliName: 'ভিভো স্মার্টফোন সেন্টার',
    wing: 'right',
    bannerColor: '#1d63e6',
    textColor: '#ffffff',
    lxCenter: 7.5,
    width: 3.3,
    counterLz: 2.4,
    items: [
      { id: 'vivo_cable', name: 'Vivo FlashCharge Kit', bengaliName: 'ভিভো চার্জার', priceBdt: 290, energyGain: 12, kind: 'item' },
    ],
  },
  {
    id: 'ameen_shop_realme',
    brand: 'realme',
    bengaliName: 'রিয়েলমি স্টোর',
    wing: 'right',
    bannerColor: '#facc15',
    textColor: '#111827',
    lxCenter: 10.8,
    width: 3.3,
    counterLz: 2.4,
    items: [
      { id: 'realme_band', name: 'Realme Fitness Band', bengaliName: 'রিয়েলমি স্মার্ট ব্যান্ড', priceBdt: 520, energyGain: 16, kind: 'item' },
    ],
  },
  {
    id: 'ameen_shop_itel',
    brand: 'itel',
    bengaliName: 'আইটেল মোবাইল ও সার্ভিস',
    wing: 'right',
    bannerColor: '#dc2626',
    textColor: '#ffffff',
    lxCenter: 14.1,
    width: 3.3,
    counterLz: 2.4,
    items: [
      { id: 'itel_power', name: 'itel Compact PowerBank', bengaliName: 'পাওয়ার ব্যাংক', priceBdt: 240, energyGain: 15, kind: 'item' },
    ],
  },
];

export type ApartmentSpotKind =
  | 'bed'
  | 'sofa_tv'
  | 'kitchen'
  | 'bathroom'
  | 'wardrobe'
  | 'computer'
  | 'storage'
  | 'companion_bed';

export interface ApartmentSpot {
  id: ApartmentSpotKind;
  name: string;
  bengaliName: string;
  actionLabel: string;
  lx: number;
  lz: number;
  radius: number;
}

export const AMEEN_APARTMENT_SPOTS: ApartmentSpot[] = [
  {
    id: 'bed',
    name: 'Master Bed',
    bengaliName: 'বিছানা · ঘুম',
    actionLabel: 'SLEEP [E]',
    lx: 1.6,
    lz: -4.2,
    radius: 3.1,
  },
  {
    id: 'wardrobe',
    name: 'Bedroom Wardrobe',
    bengaliName: 'আলমারি / পোশাক',
    actionLabel: 'Open Wardrobe [E]',
    lx: -3.2,
    lz: -3.6,
    radius: 2.2,
  },
  {
    id: 'storage',
    name: 'Personal Storage Locker',
    bengaliName: 'পার্সোনাল স্টোরেজ',
    actionLabel: 'Personal Storage [E]',
    lx: -3.2,
    lz: -6.0,
    radius: 2.2,
  },
  {
    id: 'computer',
    name: 'Computer Desk',
    bengaliName: 'কম্পিউটার ডেস্ক',
    actionLabel: 'Use Computer [E]',
    lx: 5.6,
    lz: -2.8,
    radius: 2.4,
  },
  {
    id: 'sofa_tv',
    name: 'Living Room Sofa & TV',
    bengaliName: 'সোফা ও টেলিভিশন',
    actionLabel: 'Watch / Toggle TV [E]',
    lx: 1.2,
    lz: 3.4,
    radius: 3.0,
  },
  {
    id: 'kitchen',
    name: 'Apartment Kitchen',
    bengaliName: 'রান্নাঘর ও চা',
    actionLabel: 'Make Cha & Snack [E]',
    lx: 10.6,
    lz: 4.0,
    radius: 3.0,
  },
  {
    id: 'bathroom',
    name: 'Bathroom',
    bengaliName: 'বাথরুম',
    actionLabel: 'Freshen Up (+25% Energy) [E]',
    lx: 11.4,
    lz: -3.4,
    radius: 2.8,
  },
  {
    id: 'companion_bed',
    name: "Tariq's Bed & Lounge",
    bengaliName: 'তারিকের বিছানা ও ডেস্ক',
    actionLabel: 'Rest Area',
    lx: -12.6,
    lz: -4.4,
    radius: 2.4,
  },
];

// Master bed coordinates for walk-to-bed & lie-down animation (Floor 2)
export const AMEEN_BED_COORDS = {
  standSideLocal: { lx: 0.1, lz: -4.2 },
  mattressCenterLocal: { lx: 1.75, lz: -5.35, bedSurfaceHeightRelFloor: 0.62, yawLocal: 0 },
  companionBedLocal: { lx: -12.6, lz: -5.35, standLx: -11.2, standLz: -4.4 },
  companionLoungeLocal: { lx: -11.4, lz: 2.6 },
};

export interface InteriorWallBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  label?: string;
}

// Floor 2 Apartment solid walls & major furniture colliders in building-local coords (width -16..+16, depth -8..+8)
// Every room has at least a 2.0m open doorway so the player walks freely between every room!
export const FLOOR2_APARTMENT_COLLIDERS: InteriorWallBox[] = [
  // Wall dividing Living Room (Z > 0.6) from Master Bedroom (Z < 0.4), leaving open doorway at X in [-0.8 .. +1.5]
  { minX: -4.8, maxX: -0.8, minZ: 0.4, maxZ: 0.72, label: 'bedroom_wall_L' },
  { minX: 1.5, maxX: 7.4, minZ: 0.4, maxZ: 0.72, label: 'bedroom_wall_R' },

  // Wall separating Companion Wing (X < -4.8) from Living/Bedroom, leaving open doorway at Z in [1.2 .. 3.4]
  { minX: -5.05, maxX: -4.75, minZ: -7.5, maxZ: 1.2, label: 'companion_wall_rear' },
  { minX: -5.05, maxX: -4.75, minZ: 3.4, maxZ: 7.5, label: 'companion_wall_front' },

  // Wall separating Living Room / Bedroom from Kitchen & Bathroom (X ~ 7.3..7.6), doorway into kitchen at Z in [1.6 .. 3.8] & bath at Z in [-3.4 .. -1.4]
  { minX: 7.25, maxX: 7.55, minZ: -7.5, maxZ: -3.4, label: 'east_wall_bath' },
  { minX: 7.25, maxX: 7.55, minZ: -1.4, maxZ: 1.6, label: 'east_wall_mid' },
  { minX: 7.25, maxX: 7.55, minZ: 3.8, maxZ: 7.5, label: 'east_wall_front' },

  // Wall separating Bathroom (Z < 0.8) from Kitchen (Z > 1.1) on East wing
  { minX: 7.4, maxX: 15.5, minZ: 0.75, maxZ: 1.08, label: 'kitchen_bath_divider' },

  // Solid furniture footprints (compact enough to walk cleanly around)
  // Master Bed (center lx 1.75, lz -5.4, size 2.2 x 2.5)
  { minX: 0.65, maxX: 2.85, minZ: -6.85, maxZ: -4.35, label: 'master_bed' },
  // Living room TV console against north partition (lx 1.2, lz 0.95) & Sofa (lx 1.2, lz 4.8)
  { minX: -0.4, maxX: 2.8, minZ: 0.78, maxZ: 1.35, label: 'tv_stand' },
  { minX: -0.6, maxX: 3.0, minZ: 4.5, maxZ: 5.55, label: 'living_sofa' },
  // Wardrobe & Storage Locker in Master Bedroom
  { minX: -4.55, maxX: -3.65, minZ: -4.6, maxZ: -2.4, label: 'wardrobe' },
  { minX: -4.55, maxX: -3.65, minZ: -6.9, maxZ: -5.2, label: 'storage_locker' },
  // Computer Desk
  { minX: 5.95, maxX: 7.15, minZ: -4.1, maxZ: -1.5, label: 'computer_desk' },
  // Kitchen Counter & Fridge along East/South-East wall
  { minX: 8.6, maxX: 15.4, minZ: 6.2, maxZ: 7.45, label: 'kitchen_counter' },
  { minX: 14.2, maxX: 15.4, minZ: 2.0, maxZ: 3.4, label: 'kitchen_fridge' },
  // Bathroom shower & vanity
  { minX: 13.4, maxX: 15.4, minZ: -7.4, maxZ: -5.4, label: 'bath_shower' },
  // Companion Bed & Desk
  { minX: -14.2, maxX: -11.8, minZ: -6.85, maxZ: -4.35, label: 'companion_bed' },
];

export function worldToAmeenLocal(wx: number, wz: number): { lx: number; lz: number } {
  const dx = wx - AMEEN_CENTER_SPEC.x;
  const dz = wz - AMEEN_CENTER_SPEC.z;
  const c = Math.cos(AMEEN_CENTER_SPEC.yaw);
  const s = Math.sin(AMEEN_CENTER_SPEC.yaw);
  return {
    lx: dx * c - dz * s,
    lz: dx * s + dz * c,
  };
}

export function ameenLocalToWorld(lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(AMEEN_CENTER_SPEC.yaw);
  const s = Math.sin(AMEEN_CENTER_SPEC.yaw);
  return {
    x: AMEEN_CENTER_SPEC.x + (lx * c + lz * s),
    z: AMEEN_CENTER_SPEC.z + (-lx * s + lz * c),
  };
}

export function isOverlappingAmeenCenterSite(wx: number, wz: number): boolean {
  const { lx, lz } = worldToAmeenLocal(wx, wz);
  // Exclude generic OSM placeholder buildings overlapping the 32x16 structure or its front entrance/crosswalk plaza
  return Math.abs(lx) < 21.5 && lz > -11.5 && lz < 26.5;
}

/**
 * Resolves interior collisions for Ameen Center per active floor:
 * - Outer perimeter walls + wide open +Z entrance doorway (|lx| < 2.5)
 * - Ground floor retail dividers (walkable front-facing booths!)
 * - Floor 2 Private Home Apartment rooms, doorways, and solid furniture
 */
export function resolveAmeenCenterInterior(
  lx: number,
  lz: number,
  radius: number,
  currentFloor: number
): { lx: number; lz: number; hit: boolean } {
  const hw = AMEEN_CENTER_SPEC.width * 0.5;
  const hd = AMEEN_CENTER_SPEC.depth * 0.5;
  const wallT = 0.45;
  const inDoorX = currentFloor === 0 && Math.abs(lx) < AMEEN_CENTER_SPEC.doorHalfWidth;

  let rx = Math.max(-hw + wallT + radius, Math.min(hw - wallT - radius, lx));
  let rz = lz;
  let hit = rx !== lx;

  if (rz < -hd + wallT + radius) {
    rz = -hd + wallT + radius;
    hit = true;
  }
  if (rz > hd - wallT - radius && !inDoorX) {
    rz = hd - wallT - radius;
    hit = true;
  }

  // Ground floor shop counters along side wings (leave walkable gallery aisle Z in [-1..+6.5] + back stair aisle)
  if (currentFloor === 0) {
    // Back display counters inside left & right shop bays
    const groundCounters: InteriorWallBox[] = [
      { minX: -15.4, maxX: -5.8, minZ: 1.0, maxZ: 1.65 },
      { minX: 5.8, maxX: 15.4, minZ: 1.0, maxZ: 1.65 },
    ];
    for (const box of groundCounters) {
      const cx = Math.max(box.minX, Math.min(rx, box.maxX));
      const cz = Math.max(box.minZ, Math.min(rz, box.maxZ));
      const vx = rx - cx;
      const vz = rz - cz;
      const dSq = vx * vx + vz * vz;
      if (dSq < radius * radius) {
        hit = true;
        const d = Math.sqrt(dSq);
        if (d > 0.0001) {
          rx += (vx / d) * (radius - d);
          rz += (vz / d) * (radius - d);
        } else {
          rz = rz >= (box.minZ + box.maxZ) * 0.5 ? box.maxZ + radius : box.minZ - radius;
        }
      }
    }
  } else if (currentFloor === 2) {
    for (const box of FLOOR2_APARTMENT_COLLIDERS) {
      const cx = Math.max(box.minX, Math.min(rx, box.maxX));
      const cz = Math.max(box.minZ, Math.min(rz, box.maxZ));
      const vx = rx - cx;
      const vz = rz - cz;
      const dSq = vx * vx + vz * vz;
      if (dSq < radius * radius) {
        hit = true;
        const d = Math.sqrt(dSq);
        if (d > 0.0001) {
          rx += (vx / d) * (radius - d);
          rz += (vz / d) * (radius - d);
        } else {
          const dLeft = Math.abs(rx - box.minX);
          const dRight = Math.abs(box.maxX - rx);
          const dTop = Math.abs(rz - box.minZ);
          const dBot = Math.abs(box.maxZ - rz);
          const m = Math.min(dLeft, dRight, dTop, dBot);
          if (m === dLeft) rx = box.minX - radius;
          else if (m === dRight) rx = box.maxX + radius;
          else if (m === dTop) rz = box.minZ - radius;
          else rz = box.maxZ + radius;
        }
      }
    }
  }

  return { lx: rx, lz: rz, hit };
}

/**
 * Physical stair/escalator height inside Ameen Center.
 * Walking along the stair ramp footprint smoothly transitions between adjacent floors.
 * - Entering from bottom (z near zBottom = +3.2) climbs upward to currentFloor + 1.
 * - Entering from top (z near zTop = -5.6, when stairMode === 'down') descends smoothly to currentFloor - 1.
 */
export function resolveAmeenStairRamp(
  lx: number,
  lz: number,
  currentFloor: number,
  baseY: number,
  stairMode: 'none' | 'up' | 'down' = 'up'
): { y: number; nextFloor: number; onRamp: boolean; exitedToLz: number | null; nextMode: 'none' | 'up' | 'down' } {
  const { minX, maxX, zBottom, zTop } = AMEEN_CENTER_SPEC.stairBounds;
  const fh = AMEEN_CENTER_SPEC.floorHeight;
  const slabOff = AMEEN_CENTER_SPEC.slabOffsetY;
  const baseFloorY = baseY + currentFloor * fh + slabOff;
  const insideFootprint = lx >= minX && lx <= maxX && lz <= zBottom && lz >= zTop;

  if (!insideFootprint) {
    return {
      y: baseFloorY,
      nextFloor: currentFloor,
      onRamp: false,
      exitedToLz: null,
      nextMode: 'none',
    };
  }

  // Decide direction upon entering ramp if not yet locked
  let mode = stairMode;
  if (mode === 'none') {
    const distBot = Math.abs(zBottom - lz);
    const distTop = Math.abs(lz - zTop);
    if (distTop < distBot && currentFloor > 0) {
      mode = 'down';
    } else if (currentFloor < AMEEN_CENTER_SPEC.floors) {
      mode = 'up';
    } else if (currentFloor > 0) {
      mode = 'down';
    }
  }

  const t = Math.max(0, Math.min(1, (zBottom - lz) / (zBottom - zTop)));
  if (mode === 'up' && currentFloor < AMEEN_CENTER_SPEC.floors) {
    if (t >= 0.93) {
      const nextF = Math.min(AMEEN_CENTER_SPEC.floors, currentFloor + 1);
      return {
        y: baseY + nextF * fh + slabOff,
        nextFloor: nextF,
        onRamp: false,
        exitedToLz: zTop - 0.45,
        nextMode: 'none',
      };
    }
    return {
      y: baseFloorY + t * fh,
      nextFloor: currentFloor,
      onRamp: true,
      exitedToLz: null,
      nextMode: 'up',
    };
  }

  if (mode === 'down' && currentFloor > 0) {
    if (t <= 0.07) {
      const nextF = Math.max(0, currentFloor - 1);
      return {
        y: baseY + nextF * fh + slabOff,
        nextFloor: nextF,
        onRamp: false,
        exitedToLz: zBottom + 0.45,
        nextMode: 'none',
      };
    }
    return {
      y: baseY + (currentFloor - 1) * fh + slabOff + t * fh,
      nextFloor: currentFloor,
      onRamp: true,
      exitedToLz: null,
      nextMode: 'down',
    };
  }

  return {
    y: baseFloorY,
    nextFloor: currentFloor,
    onRamp: false,
    exitedToLz: null,
    nextMode: 'none',
  };
}

export function findNearestAmeenGroundShop(lx: number, lz: number, currentFloor: number): AmeenGroundShop | null {
  if (currentFloor !== 0) return null;
  let best: AmeenGroundShop | null = null;
  let bestD = 3.2;
  for (const s of AMEEN_GROUND_SHOPS) {
    const d = Math.hypot(lx - s.lxCenter, lz - s.counterLz);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function findNearestApartmentSpot(lx: number, lz: number, currentFloor: number): ApartmentSpot | null {
  if (currentFloor !== 2) return null;
  let best: ApartmentSpot | null = null;
  let bestD = Infinity;
  for (const spot of AMEEN_APARTMENT_SPOTS) {
    const d = Math.hypot(lx - spot.lx, lz - spot.lz);
    if (d <= spot.radius && d < bestD) {
      bestD = d;
      best = spot;
    }
  }
  return best;
}
