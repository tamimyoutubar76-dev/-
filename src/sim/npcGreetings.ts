export type NpcActivity = 'walking' | 'waiting_bus' | 'tea_stall' | 'mosque' | 'hill_walk' | 'shop';

export interface NpcGreetingSample {
  id: string;
  bengaliText: string;
  romanized: string;
  englishMeaning: string;
  activities: ('all' | NpcActivity)[];
}

export interface NpcGreetingEvent {
  npcId: string;
  npcX: number;
  npcY: number;
  npcZ: number;
  roleLabel: string;
  bengaliText: string;
  romanized: string;
  englishMeaning: string;
  distanceM: number;
  isManual?: boolean;
}

export interface ScreenSpeechBubble {
  id: string;
  speakerLabel: string;
  bengaliText: string;
  romanized: string;
  englishMeaning: string;
  screenX: number;
  screenY: number;
  distanceM: number;
  variant: 'npc' | 'vendor' | 'companion';
}

export interface ProximityNpcCandidate {
  id: string;
  x: number;
  z: number;
  activity: NpcActivity;
  greetCooldown: number;
}

export const CHITTAGONIAN_GREETINGS: NpcGreetingSample[] = [
  {
    id: 'cg_bhai_kothay',
    bengaliText: 'ভাই, কোথায় যাবেন?',
    romanized: 'Bhai, kothay jaben?',
    englishMeaning: 'Brother, where are you going?',
    activities: ['all', 'walking', 'waiting_bus'],
  },
  {
    id: 'cg_shop_new_products',
    bengaliText: 'আমাদের দোকানে নতুন পণ্য এসেছে।',
    romanized: 'Amader dokane notun ponno eshechhe.',
    englishMeaning: 'New products have arrived at our shop.',
    activities: ['shop', 'tea_stall'],
  },
  {
    id: 'cg_kemon_achen',
    bengaliText: 'কেমন আছেন?',
    romanized: 'Kemon achhen?',
    englishMeaning: 'How are you doing?',
    activities: ['all', 'walking', 'mosque', 'shop'],
  },
  {
    id: 'cg_kichu_kinben',
    bengaliText: 'কিছু কিনবেন?',
    romanized: 'Kichhu kinben?',
    englishMeaning: 'Would you like to buy something?',
    activities: ['shop', 'tea_stall'],
  },
  {
    id: 'cg_eidike_asun',
    bengaliText: 'এইদিকে আসুন!',
    romanized: 'Eidike ashun!',
    englishMeaning: 'Come this way!',
    activities: ['shop', 'all'],
  },
  {
    id: 'cg_salam',
    bengaliText: 'আসসালামু আলাইকুম, ক্যান আছন?',
    romanized: 'Assalamu Alaikum, ken achon?',
    englishMeaning: 'Peace be upon you, how are you?',
    activities: ['all', 'walking', 'mosque'],
  },
  {
    id: 'cg_konde_jan',
    bengaliText: 'কিতা খবর অ ভাই, কঁডে যান?',
    romanized: 'Kita khobor o bhai, konde jan?',
    englishMeaning: "What's the news brother, where are you heading?",
    activities: ['all', 'walking', 'hill_walk'],
  },
  {
    id: 'cg_bhala_acho',
    bengaliText: 'ভালা আছো নি ভাইজান?',
    romanized: 'Bhala acho ni bhaijan?',
    englishMeaning: 'Are you doing well, brother?',
    activities: ['all', 'walking'],
  },
  {
    id: 'cg_lalkhan_cha',
    bengaliText: 'চা খাইবা নি? লালখান বাজারত গরম চা আছে!',
    romanized: 'Cha khaiba ni? Lalkhan Bazarot gorom cha ache!',
    englishMeaning: 'Want some tea? Hot tea is ready at Lalkhan Bazar!',
    activities: ['all', 'tea_stall', 'walking'],
  },
  {
    id: 'cg_rong_cha',
    bengaliText: 'বসোঁ অ ভাই, এক কাপ রং চা লও!',
    romanized: 'Bosho o bhai, ek kap rong cha lo!',
    englishMeaning: 'Have a seat brother, take a cup of red tea!',
    activities: ['tea_stall'],
  },
  {
    id: 'cg_bus_jam',
    bengaliText: 'বাস আয়ের নি অ ভাই? বহুত ভিড় আজকে!',
    romanized: 'Bus ayer ni o bhai? Bohut bhir ajke!',
    englishMeaning: 'Is the bus coming brother? Quite a crowd today!',
    activities: ['waiting_bus'],
  },
  {
    id: 'cg_mosque_jamat',
    bengaliText: 'মসজিদত জামাতর সময় অই যার ভাই!',
    romanized: 'Mosjidot jamator shomoy oi jar bhai!',
    englishMeaning: 'Congregation time at the mosque is approaching, brother!',
    activities: ['mosque'],
  },
  {
    id: 'cg_pahar_batash',
    bengaliText: 'পাহাড়র বাতাস ক্যান লাগের? সাবধানে উঠিয়ো!',
    romanized: 'Paharor batash ken lager? Shabdhan-e uthiyo!',
    englishMeaning: "How's the hillside breeze? Climb carefully!",
    activities: ['hill_walk'],
  },
  {
    id: 'cg_rasta_par',
    bengaliText: 'রাস্তা-ঘাট সাবধানে পার অইয়ো অ ভাই!',
    romanized: 'Rasta-ghat shabdhan-e par oiyo o bhai!',
    englishMeaning: 'Cross the busy road carefully, brother!',
    activities: ['walking', 'waiting_bus'],
  },
];

export function getNpcRoleLabel(activity: NpcActivity): string {
  switch (activity) {
    case 'waiting_bus':
      return 'Ispahani / Lalkhan Commuter';
    case 'tea_stall':
      return 'Cha-er Dokan Patron';
    case 'shop':
      return 'Shopkeeper · দোকানদার';
    case 'mosque':
      return 'Mosque Neighbor';
    case 'hill_walk':
      return 'Motijharna Hill Resident';
    case 'walking':
    default:
      return 'Lalkhan Bazar Resident';
  }
}

export function selectChittagonianGreeting(
  activity: NpcActivity,
  randomVal: number,
  lastGreetingId?: string | null
): NpcGreetingSample {
  const matching = CHITTAGONIAN_GREETINGS.filter(
    (g) => g.activities.includes(activity) || g.activities.includes('all')
  );
  const pool =
    lastGreetingId && matching.length > 1
      ? matching.filter((g) => g.id !== lastGreetingId)
      : matching;
  const clamped = Math.max(0, Math.min(0.999999, randomVal));
  const idx = Math.floor(clamped * pool.length);
  return pool[idx] || CHITTAGONIAN_GREETINGS[0];
}

export function findProximityGreetingCandidate<T extends ProximityNpcCandidate>(
  candidates: readonly T[],
  activeCount: number,
  playerX: number,
  playerZ: number,
  radiusM = 6.5
): { agent: T; distanceM: number } | null {
  let bestAgent: T | null = null;
  let bestDist = radiusM;
  const limit = Math.min(activeCount, candidates.length);

  for (let i = 0; i < limit; i++) {
    const a = candidates[i];
    if (a.greetCooldown > 0) continue;
    const d = Math.hypot(a.x - playerX, a.z - playerZ);
    if (d <= bestDist) {
      bestDist = d;
      bestAgent = a;
    }
  }

  if (!bestAgent) return null;
  return { agent: bestAgent, distanceM: Math.round(bestDist * 10) / 10 };
}
