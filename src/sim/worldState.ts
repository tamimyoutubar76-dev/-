export type WeatherMode = 'clear' | 'overcast' | 'rain';
export type CrowdDensity = 'low' | 'medium' | 'high';
export type VehicleType = 'cng' | 'car' | 'bus' | 'motorbike' | 'rickshaw';

export interface PrayerTimeInfo {
  name: string;
  bengaliName: string;
  hourFloat: number;
  timeStr: string;
}

export const CHATTOGRAM_PRAYER_SCHEDULE: PrayerTimeInfo[] = [
  { name: 'Fajr', bengaliName: 'ফজর', hourFloat: 5.05, timeStr: '05:03 AM' },
  { name: 'Dhuhr', bengaliName: 'যোহর', hourFloat: 12.15, timeStr: '12:09 PM' },
  { name: 'Asr', bengaliName: 'আসর', hourFloat: 15.6, timeStr: '03:36 PM' },
  { name: 'Maghrib', bengaliName: 'মাগরিব', hourFloat: 17.35, timeStr: '05:21 PM' },
  { name: 'Isha', bengaliName: 'ইশা', hourFloat: 18.85, timeStr: '06:51 PM' },
];

export function getNextPrayer(timeOfDayHours: number): { current: PrayerTimeInfo; next: PrayerTimeInfo; isAdhanWindow: boolean } {
  const h = ((timeOfDayHours % 24) + 24) % 24;
  let current = CHATTOGRAM_PRAYER_SCHEDULE[CHATTOGRAM_PRAYER_SCHEDULE.length - 1];
  let next = CHATTOGRAM_PRAYER_SCHEDULE[0];

  for (let i = 0; i < CHATTOGRAM_PRAYER_SCHEDULE.length; i++) {
    if (h >= CHATTOGRAM_PRAYER_SCHEDULE[i].hourFloat) {
      current = CHATTOGRAM_PRAYER_SCHEDULE[i];
      next = CHATTOGRAM_PRAYER_SCHEDULE[(i + 1) % CHATTOGRAM_PRAYER_SCHEDULE.length];
    }
  }

  const isAdhanWindow = CHATTOGRAM_PRAYER_SCHEDULE.some((p) => Math.abs(h - p.hourFloat) < 0.25);
  return { current, next, isAdhanWindow };
}

export function formatChattogramClock(timeOfDayHours: number): string {
  const hNorm = ((timeOfDayHours % 24) + 24) % 24;
  const hrs24 = Math.floor(hNorm);
  const mins = Math.floor((hNorm - hrs24) * 60);
  const ampm = hrs24 >= 12 ? 'PM' : 'AM';
  const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;
  return `${String(hrs12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
}

export function getCrowdCountForDensity(density: CrowdDensity): number {
  switch (density) {
    case 'low':
      return 70;
    case 'medium':
      return 140;
    case 'high':
      return 240;
  }
}

export interface InventoryItemRecord {
  id: string;
  name: string;
  bengaliName: string;
  count: number;
  kind: 'food' | 'drink' | 'item';
}

export interface CompanionSaveState {
  id: string;
  name: string;
  bengaliName: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  state: 'following' | 'home' | 'sleeping' | 'in_vehicle';
  insideBuildingId: string | null;
  currentFloor: number;
}

export interface ApartmentSaveState {
  tvOn: boolean;
  tvChannel: number;
  pcActive: boolean;
  storedItems: string[];
  wardrobeOutfit: 'ac_milan_bwin' | 'portugal_black_7' | 'casual_chattogram' | 'home_comfort';
}

export interface SavedVehicleState {
  id: string;
  type: VehicleType;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface PlayerSaveData {
  saveVersion: number;
  characterIdentity: {
    id: string;
    displayName: string;
    jerseyName: string;
    jerseyNumber: number;
  };
  homeBuildingId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  insideLandmarkId: string | null;
  currentFloor: number;
  walletBdt: number;
  energy: number;
  timeOfDay: number;
  weather: WeatherMode;
  weatherAuto: boolean;
  clockSpeed: 1 | 10 | 60;
  crowdDensity: CrowdDensity;
  shoesRemoved: boolean;
  wuduPerformed: boolean;
  visitedLandmarks: string[];
  prayersCompleted: number;
  inventory: InventoryItemRecord[];
  ownedVehicles: string[];
  savedVehicle: SavedVehicleState | null;
  completedMissions: string[];
  apartmentState: ApartmentSaveState;
  companion: CompanionSaveState;
  sleepCount: number;
  lastSleptHour: number | null;
  settings: {
    soundMuted: boolean;
    mobileControlsOverride: boolean | null;
    cameraMode: 'third' | 'first';
  };
}

export const DEFAULT_SPAWN = {
  // Unobstructed front entrance sidewalk plaza right outside Ameen Center facing the open glass doors
  x: 281.8,
  z: 258.5,
  yaw: -2.38,
};

export function createInitialSaveData(): PlayerSaveData {
  return {
    saveVersion: 3,
    characterIdentity: {
      id: 'protagonist_friend_acmilan',
      displayName: 'Lalkhan Protagonist',
      jerseyName: 'AC MILAN',
      jerseyNumber: 0,
    },
    homeBuildingId: 'amin_centre',
    x: DEFAULT_SPAWN.x,
    y: 0,
    z: DEFAULT_SPAWN.z,
    yaw: DEFAULT_SPAWN.yaw,
    insideLandmarkId: null,
    currentFloor: 0,
    walletBdt: 1500,
    energy: 95,
    timeOfDay: 10.25, // Crisp 10:15 AM Chattogram morning
    weather: 'clear',
    weatherAuto: true,
    clockSpeed: 1,
    crowdDensity: 'medium',
    shoesRemoved: false,
    wuduPerformed: false,
    visitedLandmarks: ['amin_centre'],
    prayersCompleted: 0,
    inventory: [
      { id: 'home_key_ameen', name: 'Ameen Center Apt Key', bengaliName: 'বাসার চাবি', count: 1, kind: 'item' },
    ],
    ownedVehicles: ['parked_0', 'parked_1'],
    savedVehicle: null,
    completedMissions: [],
    apartmentState: {
      tvOn: true,
      tvChannel: 1,
      pcActive: true,
      storedItems: ['Football Jersey Spare', 'Passport & NID Folder'],
      wardrobeOutfit: 'ac_milan_bwin',
    },
    companion: {
      id: 'companion_tariq_fixed',
      name: 'Tariq',
      bengaliName: 'তারিক',
      x: 283.4,
      y: 0,
      z: 256.8,
      yaw: -2.38,
      state: 'following',
      insideBuildingId: null,
      currentFloor: 0,
    },
    sleepCount: 0,
    lastSleptHour: null,
    settings: {
      soundMuted: false,
      mobileControlsOverride: null,
      cameraMode: 'third',
    },
  };
}
