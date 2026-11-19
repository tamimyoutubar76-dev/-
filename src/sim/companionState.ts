import { VehicleType } from './worldState';

export const FIXED_COMPANION_IDENTITY = {
  id: 'companion_tariq_fixed',
  name: 'Tariq',
  bengaliName: 'তারিক',
  roleLabel: 'Best Friend · বন্ধু তারিক',
} as const;

export const COMPANION_DIALOGUE_LINES = [
  {
    id: 'comp_lets_go',
    bengaliText: 'চল ভাই, লালখান বাজার ঘুরে আসি!',
    romanized: 'Chol bhai, Lalkhan Bazar ghure ashi!',
    englishMeaning: "Let's go brother, let's explore Lalkhan Bazar!",
  },
  {
    id: 'comp_home_rest',
    bengaliText: 'বাসায় বিশ্রাম নিবি নাকি? আমাদের রুম রেডি আছে।',
    romanized: 'Bashay bishram nibi naki? Amader room ready achhe.',
    englishMeaning: 'Want to rest at our Ameen Center apartment? Our room is ready.',
  },
  {
    id: 'comp_vehicle_ride',
    bengaliText: 'গাড়িতে উঠ, আমি পাশের সিটে বসছি!',
    romanized: 'Garite uth, ami pasher seate boshchhi!',
    englishMeaning: "Hop in the vehicle, I'll take the passenger seat!",
  },
  {
    id: 'comp_shop_check',
    bengaliText: 'আমিন সেন্টারের নিচে নতুন দোকানগুলো দেখেছিস?',
    romanized: 'Ameen Center-er niche notun dokangulo dekhechhis?',
    englishMeaning: 'Have you checked out the shops downstairs in Ameen Center?',
  },
] as const;

/**
 * Local passenger seat offsets per drivable vehicle type in Lalkhan Bazar
 * so the Friend Companion visibly sits inside cars/CNGs/buses/rickshaws or pillion on motorbikes.
 */
export function getVehiclePassengerSeatOffset(type: VehicleType): {
  lx: number;
  ly: number;
  lz: number;
} {
  switch (type) {
    case 'car':
      // Front-left passenger cabin seat (right-hand drive in Bangladesh: passenger sits left -0.42m)
      return { lx: -0.42, ly: 0.16, lz: 0.12 };
    case 'cng':
      // Passenger rear bench inside open green CNG canopy
      return { lx: 0.24, ly: 0.52, lz: -0.52 };
    case 'bus':
      // Front passenger window seat behind windshield
      return { lx: -0.72, ly: 1.05, lz: 2.65 };
    case 'rickshaw':
      // Side-by-side passenger bench under rickshaw hood
      return { lx: 0.25, ly: 0.62, lz: -0.45 };
    case 'motorbike':
      // Pillion rider behind main player
      return { lx: 0, ly: 0.60, lz: -0.58 };
  }
}

export function transformSeatToWorld(
  vx: number,
  vy: number,
  vz: number,
  vyaw: number,
  offset: { lx: number; ly: number; lz: number }
): { x: number; y: number; z: number } {
  const c = Math.cos(vyaw);
  const s = Math.sin(vyaw);
  return {
    x: vx + offset.lx * c + offset.lz * s,
    y: vy + offset.ly,
    z: vz - offset.lx * s + offset.lz * c,
  };
}
