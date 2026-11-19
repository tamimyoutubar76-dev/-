import { metricToLatLon } from './projection';

export type BuildingCategory =
  | 'commercial'
  | 'mosque'
  | 'restaurant'
  | 'shop'
  | 'tea_stall'
  | 'office'
  | 'school'
  | 'hospital'
  | 'residential'
  | 'hotel';

export interface ShopItem {
  id: string;
  name: string;
  bengaliName: string;
  priceBdt: number;
  energyGain: number;
  kind: 'food' | 'drink' | 'item';
}

export interface LandmarkRecord {
  id: string;
  osmId?: string;
  name: string;
  bengaliName: string;
  category: BuildingCategory;
  x: number;
  z: number;
  width: number;
  depth: number;
  yaw: number; // rotation around Y in radians
  floors: number;
  floorHeight: number;
  verifiedRealName: boolean;
  referenceNote: string;
  enterable: boolean;
  hasElevator: boolean;
  hasRooftop: boolean;
  isMosque?: boolean;
  isOpenPlaza?: boolean;
  shopMenu?: ShopItem[];
}

export interface BusStopRecord {
  id: string;
  name: string;
  bengaliName: string;
  x: number;
  z: number;
  verified: boolean;
  informal: boolean;
  routes: string[];
}

export const VERIFIED_BUS_STOPS: BusStopRecord[] = [
  {
    id: 'bus_ispahani_circle',
    name: 'Ispahani Circle Bus Stop',
    bengaliName: 'ইস্পাহানী সার্কেল বাস স্টপ',
    x: 268.1,
    z: 356.5,
    verified: true,
    informal: true,
    routes: ['New Market ↔ Lalkhan Bazar ↔ GEC ↔ Muradpur', 'Agrabad ↔ Tigerpass ↔ Lalkhan Bazar ↔ 2 No Gate'],
  },
  {
    id: 'bus_ispahani',
    name: 'Ispahani Bus Stop (Southbound)',
    bengaliName: 'ইস্পাহানী বাস স্টপ',
    x: 247.9,
    z: 358.4,
    verified: true,
    informal: true,
    routes: ['GEC ↔ Lalkhan Bazar ↔ Tigerpass ↔ Agrabad'],
  },
  {
    id: 'bus_wasa',
    name: 'WASA Square Bus Stop',
    bengaliName: 'ওয়াসা মোড় বাস স্টপ',
    x: 554.2,
    z: -153.5,
    verified: true,
    informal: true,
    routes: ['New Market ↔ Lalkhan Bazar ↔ WASA ↔ GEC'],
  },
  {
    id: 'bus_garibullah',
    name: 'Garibullah Shah Bus Stop',
    bengaliName: 'গরীবুল্লাহ শাহ বাস স্টপ',
    x: 498.2,
    z: -624.2,
    verified: true,
    informal: true,
    routes: ['Lalkhan Bazar ↔ Dampara ↔ GEC ↔ Oxygen'],
  },
  {
    id: 'bus_new_market',
    name: 'New Market (Biponi Bitan) Bus Stand',
    bengaliName: 'নিউ মার্কেট বাস স্ট্যান্ড',
    x: 822.0,
    z: 598.0,
    verified: true,
    informal: true,
    routes: ['New Market ↔ Neval Ave ↔ Lalkhan Bazar ↔ WASA ↔ GEC'],
  },
];

export const VERIFIED_LANDMARKS: LandmarkRecord[] = [
  {
    id: 'ispahani_centre',
    name: 'Ispahani Centre (Rahman Plaza / Ispahani Moor)',
    bengaliName: 'ইস্পাহানী সেন্টার',
    category: 'commercial',
    x: 254.0,
    z: 302.0,
    width: 24,
    depth: 18,
    yaw: -0.45,
    floors: 9,
    floorHeight: 3.6,
    verifiedRealName: true,
    referenceNote: 'Verified 9-storey commercial complex at Ispahani Moor, CDA Avenue (Copper Chimney, corporate offices, retail). Interior reconstructed for gameplay.',
    enterable: true,
    hasElevator: true,
    hasRooftop: true,
    shopMenu: [
      { id: 'coffee_latte', name: 'Espresso / Cold Coffee', bengaliName: 'কোল্ড কফি', priceBdt: 180, energyGain: 28, kind: 'drink' },
      { id: 'club_sandwich', name: 'Grilled Club Sandwich', bengaliName: 'ক্লাব স্যান্ডউইচ', priceBdt: 260, energyGain: 45, kind: 'food' },
    ],
  },
  {
    id: 'amin_centre',
    name: 'Ameen Center',
    bengaliName: 'আমিন সেন্টার',
    category: 'commercial',
    x: 270.0,
    z: 246.0,
    width: 32,
    depth: 16,
    yaw: 0.76,
    floors: 3,
    floorHeight: 4.2,
    verifiedRealName: true,
    referenceNote:
      'Verified 3-storey commercial & residential complex at Ispahani Moor, CDA Avenue featuring blue central portal, glass atrium, ground-floor Bata/OPPO/Samsung/Vivo/Realme/itel shops, elevator, escalators/stairs, and permanent home apartment on Floor 2.',
    enterable: true,
    hasElevator: true,
    hasRooftop: true,
    shopMenu: [
      { id: 'pastry_snack', name: 'Bakery Roll & Juice', bengaliName: 'পেস্ট্রি ও জুস', priceBdt: 120, energyGain: 25, kind: 'food' },
    ],
  },
  {
    id: 'highway_plaza',
    name: 'Highway Plaza & Mezzan Haile Ayun',
    bengaliName: 'হাইওয়ে প্লাজা ও মেজ্জান হাইলে আইয়ুন',
    category: 'restaurant',
    x: 222.0,
    z: 332.0,
    width: 18,
    depth: 15,
    yaw: -0.45,
    floors: 5,
    floorHeight: 3.4,
    verifiedRealName: true,
    referenceNote: 'Verified commercial plaza & renowned Chattogram Mezbani dining spot at Ispahani Circle.',
    enterable: true,
    hasElevator: false,
    hasRooftop: true,
    shopMenu: [
      { id: 'mezbani_beef', name: 'Mezbani Beef & Rice Platter', bengaliName: 'মেজবানি মাংস ও ভাত', priceBdt: 320, energyGain: 65, kind: 'food' },
      { id: 'kala_bhuna', name: 'Chattogram Kala Bhuna', bengaliName: 'কালা ভুনা', priceBdt: 360, energyGain: 70, kind: 'food' },
      { id: 'borhani', name: 'Spiced Borhani', bengaliName: 'বোরহানি', priceBdt: 60, energyGain: 20, kind: 'drink' },
    ],
  },
  {
    id: 'prince_hotel',
    name: 'Prince Hotel & Restaurant',
    bengaliName: 'প্রিন্স হোটেল অ্যান্ড রেস্তোরাঁ',
    category: 'restaurant',
    x: 220.0,
    z: 306.0,
    width: 14,
    depth: 12,
    yaw: -0.45,
    floors: 3,
    floorHeight: 3.3,
    verifiedRealName: true,
    referenceNote: 'Verified restaurant on Moti Jhorna Lane / Ispahani Road, Lalkhan Bazar (OSM POI).',
    enterable: true,
    hasElevator: false,
    hasRooftop: false,
    shopMenu: [
      { id: 'paratha_tea', name: 'Paratha, Dal & Milk Tea', bengaliName: 'পরোটা, ডাল ও দুধ চা', priceBdt: 75, energyGain: 35, kind: 'food' },
      { id: 'chicken_biryani', name: 'Chattogram Chicken Biryani', bengaliName: 'চিকেন বিরিয়ানি', priceBdt: 190, energyGain: 55, kind: 'food' },
      { id: 'water_bottle', name: 'Mineral Water 500ml', bengaliName: 'পানির বোতল', priceBdt: 20, energyGain: 15, kind: 'drink' },
    ],
  },
  {
    id: 'govt_colony_masjid',
    name: 'Govt. Officers Colony Jame Masjid',
    bengaliName: 'সরকারি অফিসার্স কলোনি জামে মসজিদ',
    category: 'mosque',
    x: 193.0,
    z: 365.0,
    width: 18,
    depth: 16,
    yaw: -0.42,
    floors: 2,
    floorHeight: 4.0,
    verifiedRealName: true,
    referenceNote: 'Verified mosque on CDA Avenue near Ispahani Circle (OSM POI). Includes shoe rack, Wudu area, and prayer hall.',
    enterable: true,
    hasElevator: false,
    hasRooftop: false,
    isMosque: true,
  },
  {
    id: 'railway_colony_masjid',
    name: 'Railway Colony Jame Masjid',
    bengaliName: 'রেলওয়ে কলোনি জামে মসজিদ',
    category: 'mosque',
    x: 316.0,
    z: 355.0,
    width: 17,
    depth: 15,
    yaw: 0.15,
    floors: 2,
    floorHeight: 4.0,
    verifiedRealName: true,
    referenceNote: 'Verified mosque on Shahid Saifuddin Khaled Rd near Ispahani Circle (OSM POI).',
    enterable: true,
    hasElevator: false,
    hasRooftop: false,
    isMosque: true,
  },
  {
    id: 'lalkhan_madrasa_masjid',
    name: 'Jamiatul Uloom Lalkhan Bazar Madrasa & Masjid',
    bengaliName: 'লালখান বাজার মাদরাসা ও জামে মসজিদ',
    category: 'mosque',
    x: -104.0,
    z: -505.0,
    width: 24,
    depth: 20,
    yaw: 0.2,
    floors: 3,
    floorHeight: 4.0,
    verifiedRealName: true,
    referenceNote: 'Verified historic hillock Madrasa & Mosque complex in Lalkhan Bazar (OSM POI).',
    enterable: true,
    hasElevator: false,
    hasRooftop: false,
    isMosque: true,
  },
  {
    id: 'jamiatul_falah_mosque',
    name: 'Jamiatul Falah National Mosque',
    bengaliName: 'জমিয়তুল ফালাহ জাতীয় মসজিদ',
    category: 'mosque',
    x: 575.6,
    z: 33.0,
    width: 46,
    depth: 38,
    yaw: 0.0,
    floors: 3,
    floorHeight: 4.8,
    verifiedRealName: true,
    referenceNote: 'Verified 4,445 m² monumental mosque complex at WASA / Dampara border (OSM Building 4445m²).',
    enterable: true,
    hasElevator: false,
    hasRooftop: false,
    isMosque: true,
  },
  {
    id: 'lalkhan_tea_stall',
    name: 'Lalkhan Bazar Corner Cha-er Dokan',
    bengaliName: 'লালখান বাজার চা ও নাস্তার দোকান',
    category: 'tea_stall',
    x: 298.0,
    z: 230.0,
    width: 6,
    depth: 5,
    yaw: -0.45,
    floors: 1,
    floorHeight: 3.0,
    verifiedRealName: false,
    referenceNote: 'Plausible roadside tea stall under the Lalkhan Bazar flyover corridor.',
    enterable: true,
    hasElevator: false,
    hasRooftop: false,
    shopMenu: [
      { id: 'dudh_cha', name: 'Malai Dudh Cha (Milk Tea)', bengaliName: 'মালাই দুধ চা', priceBdt: 15, energyGain: 18, kind: 'drink' },
      { id: 'rong_cha', name: 'Lebu Rong Cha (Lemon Tea)', bengaliName: 'লেবু রঙ চা', priceBdt: 10, energyGain: 14, kind: 'drink' },
      { id: 'singara', name: 'Hot Singara & Samosa (2 pcs)', bengaliName: 'গরম সিঙ্গারা', priceBdt: 20, energyGain: 24, kind: 'food' },
      { id: 'bun_toast', name: 'Butter Bun & Biscuit', bengaliName: 'বন রুটি ও বিস্কুট', priceBdt: 25, energyGain: 22, kind: 'food' },
    ],
  },
  {
    id: 'chanmari_pharmacy_grocery',
    name: 'Chanmari Pharmacy & Mudi Dokan',
    bengaliName: 'চানমারি ফার্মেসী ও মুদি দোকান',
    category: 'shop',
    x: 196.0,
    z: 422.0,
    width: 11,
    depth: 9,
    yaw: 0.35,
    floors: 2,
    floorHeight: 3.2,
    verifiedRealName: false,
    referenceNote: 'Plausible local roadside grocery & pharmacy along Chanmari Road near Swapno Nir Hotel.',
    enterable: true,
    hasElevator: false,
    hasRooftop: false,
    shopMenu: [
      { id: 'ors_saline', name: 'Electrolyte ORS Drink', bengaliName: 'ওরস্যালাইন', priceBdt: 25, energyGain: 30, kind: 'drink' },
      { id: 'mango_juice', name: 'Mango Juice Pack', bengaliName: 'আমের জুস', priceBdt: 35, energyGain: 25, kind: 'drink' },
      { id: 'chips_biscuit', name: 'Chanachur & Crackers', bengaliName: 'চানাচুর ও বিস্কুট', priceBdt: 40, energyGain: 28, kind: 'food' },
    ],
  },
  {
    id: 'motijharna_hill_house',
    name: 'Motijharna Hillside Terrace House',
    bengaliName: 'মতিঝর্ণা পাহাড়ি বাড়ি',
    category: 'residential',
    x: 42.0,
    z: 145.0,
    width: 12,
    depth: 10,
    yaw: 0.25,
    floors: 3,
    floorHeight: 3.1,
    verifiedRealName: false,
    referenceNote: 'Plausible hillside residential terrace overlooking Lalkhan Bazar valley & flyover.',
    enterable: true,
    hasElevator: false,
    hasRooftop: true,
  },
  {
    id: 'wasa_hq',
    name: 'Chattogram WASA Headquarters',
    bengaliName: 'চট্টগ্রাম ওয়াসা ভবন',
    category: 'office',
    x: 578.0,
    z: -122.2,
    width: 26,
    depth: 20,
    yaw: 0.0,
    floors: 8,
    floorHeight: 3.6,
    verifiedRealName: true,
    referenceNote: 'Verified Water and Sewerage Authority (WASA) HQ at WASA Mor border (OSM Building).',
    enterable: true,
    hasElevator: true,
    hasRooftop: true,
  },
  {
    id: 'radisson_blu',
    name: 'Radisson Blu Chattogram Bay View',
    bengaliName: 'র‍্যাডিসন ব্লু চট্টগ্রাম বে ভিউ',
    category: 'hotel',
    x: 617.9,
    z: 242.3,
    width: 44,
    depth: 36,
    yaw: 0.0,
    floors: 18,
    floorHeight: 3.8,
    verifiedRealName: true,
    referenceNote: 'Verified landmark 18-storey tower along SS Khaled Rd / Red Crescent border (OSM Building 9104m²).',
    enterable: true,
    hasElevator: true,
    hasRooftop: true,
  },
  {
    id: 'new_market_bazaar',
    name: 'Chattogram New Market (Biponi Bitan)',
    bengaliName: 'চট্টগ্রাম নিউ মার্কেট (বিপণি বিতান)',
    category: 'commercial',
    x: 888.0,
    z: 540.0,
    width: 96,
    depth: 130,
    yaw: 0.0,
    floors: 4,
    floorHeight: 3.6,
    verifiedRealName: true,
    referenceNote: 'Interactive Chattogram New Market shopping complex connected via Saifuddin Khaled Rd & Neval Ave, featuring clothing, footwear, electronics, bags, cosmetics, toys, household & food stalls with live Bengali vendor voices.',
    enterable: false,
    hasElevator: false,
    hasRooftop: false,
    isOpenPlaza: true,
  },
];

export function getLandmarkWithLatLon(l: LandmarkRecord) {
  const { lat, lon } = metricToLatLon(l.x, l.z);
  return { ...l, lat, lon };
}
