import { GisRoad } from '../gis/projection';
import { ShopItem } from '../gis/landmarks';

export type RoadsideShopCategory =
  | 'tea_stall'
  | 'paan_shop'
  | 'clothing'
  | 'car_showroom'
  | 'motorbike_showroom'
  | 'grocery'
  | 'restaurant'
  | 'mobile_shop'
  | 'electronics'
  | 'pharmacy'
  | 'shopping_complex'
  | 'bus_counter'
  | 'repair_garage'
  | 'footwear'
  | 'bags'
  | 'cosmetics'
  | 'toys'
  | 'household';

export interface VendorVoiceLine {
  id: string;
  bengaliText: string;
  romanized: string;
  englishMeaning: string;
  categories: RoadsideShopCategory[];
  syllableCount: number;
  basePitchHz: number;
}

export const NEW_MARKET_VENDOR_LINES: VendorVoiceLine[] = [
  {
    id: 'vl_mama_asen',
    bengaliText: 'মামা, আসেন আসেন! কী লাগবে?',
    romanized: 'Mama, ashen ashen! Ki lagbe?',
    englishMeaning: 'Uncle/friend, come on over! What do you need?',
    categories: ['clothing', 'footwear', 'bags', 'cosmetics', 'toys', 'household', 'grocery'],
    syllableCount: 9,
    basePitchHz: 148,
  },
  {
    id: 'vl_eidike_bhalo',
    bengaliText: 'এইদিকে আসেন, ভালো মাল আছে!',
    romanized: 'Eidike ashen, bhalo maal achhe!',
    englishMeaning: 'Come this way, we have quality goods!',
    categories: ['clothing', 'electronics', 'mobile_shop', 'bags', 'footwear'],
    syllableCount: 9,
    basePitchHz: 136,
  },
  {
    id: 'vl_dekhe_jan',
    bengaliText: 'মামা, দেখে যান, পছন্দ হলে নিয়ে যান!',
    romanized: 'Mama, dekhe jan, pochhondo hole niye jan!',
    englishMeaning: 'Take a look friend, take it home if you like it!',
    categories: ['clothing', 'footwear', 'bags', 'cosmetics', 'toys'],
    syllableCount: 11,
    basePitchHz: 154,
  },
  {
    id: 'vl_jama_sundor',
    bengaliText: 'ভাই, এই জামাটা অনেক সুন্দর!',
    romanized: 'Bhai, ei jamata onek sundor!',
    englishMeaning: 'Brother, this shirt/garment is very handsome!',
    categories: ['clothing', 'shopping_complex'],
    syllableCount: 9,
    basePitchHz: 162,
  },
  {
    id: 'vl_kom_dame',
    bengaliText: 'কম দামে দিয়ে দেব, আসেন!',
    romanized: 'Kom dame diye debo, ashen!',
    englishMeaning: 'I will give you a discount price, come!',
    categories: ['footwear', 'household', 'toys', 'cosmetics', 'bags'],
    syllableCount: 8,
    basePitchHz: 142,
  },
  {
    id: 'vl_ki_lagbe_bolen',
    bengaliText: 'কী লাগবে মামা? বলেন!',
    romanized: 'Ki lagbe mama? Bolen!',
    englishMeaning: 'What do you need friend? Tell me!',
    categories: ['tea_stall', 'paan_shop', 'restaurant', 'grocery', 'pharmacy', 'repair_garage'],
    syllableCount: 7,
    basePitchHz: 132,
  },
  {
    id: 'vl_garam_cha',
    bengaliText: 'গরম মালাই চা আর সিঙ্গারা আছে, আসেন!',
    romanized: 'Gorom malai cha ar singara achhe, ashen!',
    englishMeaning: 'Fresh hot milk tea and singara ready, come sit!',
    categories: ['tea_stall', 'restaurant'],
    syllableCount: 11,
    basePitchHz: 144,
  },
  {
    id: 'vl_original_phone',
    bengaliText: 'অরিজিনাল ফোন আর অ্যাক্সেসরিজ, দেখে যান ভাই!',
    romanized: 'Original phone ar accessories, dekhe jan bhai!',
    englishMeaning: 'Genuine phones and accessories, come check brother!',
    categories: ['mobile_shop', 'electronics', 'car_showroom', 'motorbike_showroom'],
    syllableCount: 11,
    basePitchHz: 150,
  },
];

export interface RoadsideShopSpec {
  id: string;
  name: string;
  bengaliName: string;
  category: RoadsideShopCategory;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  yaw: number;
  wallColor: number;
  signBg: string;
  signAccent: string;
  isNewMarket: boolean;
  hasAwning: boolean;
  hasGlassShowroom?: boolean;
  hasVendor: boolean;
  vendorLineId: string;
  items: ShopItem[];
}

/**
 * Seamless New Market connecting roads linking Lalkhan Bazar (Saifuddin Khaled Rd & Neval Ave)
 * into the Chattogram New Market Plaza (x ∈ [805..955], z ∈ [440..640]).
 */
export const NEW_MARKET_CONNECTOR_ROADS: GisRoad[] = [
  {
    id: 'nm_neval_link',
    hw: 'secondary',
    name: 'New Market Avenue (Biponi Bitan Rd)',
    oneway: false,
    bridge: false,
    layer: 0,
    pts: [
      [790, 617.8],
      [838, 608],
      [842, 540],
      [840, 448],
      [790, 380],
    ],
  },
  {
    id: 'nm_saifuddin_north_link',
    hw: 'secondary',
    name: 'Saifuddin Khaled · New Market Link',
    oneway: false,
    bridge: false,
    layer: 0,
    pts: [
      [790, 369.4],
      [855, 366],
      [918, 398],
      [920, 448],
    ],
  },
  {
    id: 'nm_inner_promenade',
    hw: 'pedestrian',
    name: 'New Market Central Bazaar Walkway',
    oneway: false,
    bridge: false,
    layer: 0,
    pts: [
      [842, 540],
      [882, 540],
      [938, 540],
    ],
  },
  {
    id: 'nm_inner_crosswalk',
    hw: 'pedestrian',
    name: 'New Market Arcade Corridor',
    oneway: false,
    bridge: false,
    layer: 0,
    pts: [
      [882, 462],
      [882, 540],
      [882, 618],
    ],
  },
];

export const ROADSIDE_AND_NEW_MARKET_SHOPS: RoadsideShopSpec[] = [
  // === 1. LALKHAN BAZAR & CDA AVENUE ROADSIDE SHOPS (all requested categories) ===
  {
    id: 'shop_cda_tea_stall',
    name: 'Bismillah Corner Tea Stall',
    bengaliName: 'বিসমিল্লাহ চা-এর দোকান',
    category: 'tea_stall',
    x: 248,
    z: 368,
    width: 4.6,
    depth: 3.6,
    height: 2.9,
    yaw: -0.45,
    wallColor: 0x2a6c56,
    signBg: '#165b44',
    signAccent: '#f5c451',
    isNewMarket: false,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_garam_cha',
    items: [
      { id: 'tea_malai', name: 'Hot Malai Cha', bengaliName: 'গরম মালাই চা', priceBdt: 15, energyGain: 18, kind: 'drink' },
      { id: 'samosa_plate', name: 'Singara & Samosa', bengaliName: 'সিঙ্গারা ও সমুচা', priceBdt: 20, energyGain: 22, kind: 'food' },
    ],
  },
  {
    id: 'shop_ispahani_paan',
    name: 'Maayer Doa Paan & Cold Store',
    bengaliName: 'মায়ের দোয়া পান ও স্টোর',
    category: 'paan_shop',
    x: 280,
    z: 344,
    width: 3.6,
    depth: 3.0,
    height: 2.7,
    yaw: 1.15,
    wallColor: 0x8f3929,
    signBg: '#7a2519',
    signAccent: '#ffd166',
    isNewMarket: false,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_ki_lagbe_bolen',
    items: [
      { id: 'mishti_paan', name: 'Chattogram Mishti Paan', bengaliName: 'মিষ্টি পান', priceBdt: 20, energyGain: 12, kind: 'food' },
      { id: 'chanachur_pack', name: 'Spiced Chanachur', bengaliName: 'মসলা চানাচুর', priceBdt: 30, energyGain: 18, kind: 'food' },
    ],
  },
  {
    id: 'shop_lalkhan_clothing',
    name: 'Bangla Heritage Clothing Showroom',
    bengaliName: 'বাংলা হেরিটেজ ক্লথিং শো-রুম',
    category: 'clothing',
    x: 318,
    z: 285,
    width: 9.5,
    depth: 6.5,
    height: 4.2,
    yaw: -0.42,
    wallColor: 0xe8e0d2,
    signBg: '#1b365d',
    signAccent: '#f4c554',
    isNewMarket: false,
    hasAwning: false,
    hasGlassShowroom: true,
    hasVendor: true,
    vendorLineId: 'vl_jama_sundor',
    items: [
      { id: 'eid_panjabi', name: 'Cotton Panjabi', bengaliName: 'সুতি পাঞ্জাবি', priceBdt: 650, energyGain: 10, kind: 'item' },
    ],
  },
  {
    id: 'shop_cda_car_showroom',
    name: 'Port City Motors · Car Showroom',
    bengaliName: 'পোর্ট সিটি কার শো-রুম',
    category: 'car_showroom',
    x: 368,
    z: 105,
    width: 14.0,
    depth: 9.5,
    height: 4.8,
    yaw: -0.25,
    wallColor: 0xd9e3ec,
    signBg: '#0f2537',
    signAccent: '#38bdf8',
    isNewMarket: false,
    hasAwning: false,
    hasGlassShowroom: true,
    hasVendor: true,
    vendorLineId: 'vl_original_phone',
    items: [
      { id: 'car_wash_pass', name: 'Car Detailing Voucher', bengaliName: 'কার ডিটেইলিং', priceBdt: 350, energyGain: 15, kind: 'item' },
    ],
  },
  {
    id: 'shop_wasa_bike_showroom',
    name: 'Karnaphuli Motorcycle Showroom',
    bengaliName: 'কর্ণফুলী মোটরসাইকেল শো-রুম',
    category: 'motorbike_showroom',
    x: 504,
    z: -165,
    width: 11.0,
    depth: 7.5,
    height: 4.2,
    yaw: 1.5,
    wallColor: 0x2e3740,
    signBg: '#8c1d18',
    signAccent: '#f8fafc',
    isNewMarket: false,
    hasAwning: false,
    hasGlassShowroom: true,
    hasVendor: true,
    vendorLineId: 'vl_eidike_bhalo',
    items: [
      { id: 'helmet_gear', name: 'Riding Helmet', bengaliName: 'রাইডিং হেলমেট', priceBdt: 550, energyGain: 12, kind: 'item' },
    ],
  },
  {
    id: 'shop_chanmari_grocery',
    name: 'Al-Madina Grocery & Mudi Store',
    bengaliName: 'আল-মদিনা মুদি ও গ্রোসারি শপ',
    category: 'grocery',
    x: 224,
    z: 438,
    width: 7.2,
    depth: 5.5,
    height: 3.4,
    yaw: 0.3,
    wallColor: 0xdccbb4,
    signBg: '#1c5d41',
    signAccent: '#fce38a',
    isNewMarket: false,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_ki_lagbe_bolen',
    items: [
      { id: 'grocery_fruit', name: 'Fresh Mango & Banana Pack', bengaliName: 'তাজা ফল', priceBdt: 60, energyGain: 32, kind: 'food' },
    ],
  },
  {
    id: 'shop_fuchka_restaurant',
    name: 'Chattogram Mezban & Fuchka Corner',
    bengaliName: 'চট্টগ্রাম মেজবান ও ফুচকা কর্নার',
    category: 'restaurant',
    x: 334,
    z: 324,
    width: 7.8,
    depth: 5.6,
    height: 3.5,
    yaw: 0.25,
    wallColor: 0xe6cdb2,
    signBg: '#9a3412',
    signAccent: '#fde047',
    isNewMarket: false,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_garam_cha',
    items: [
      { id: 'fuchka_special', name: 'Special Fuchka & Doi', bengaliName: 'স্পেশাল ফুচকা', priceBdt: 50, energyGain: 34, kind: 'food' },
      { id: 'haleem_bowl', name: 'Beef Haleem', bengaliName: 'বিফ হালিম', priceBdt: 110, energyGain: 48, kind: 'food' },
    ],
  },
  {
    id: 'shop_lalkhan_mobile',
    name: 'Bay Mobile Zone & Accessories',
    bengaliName: 'বে মোবাইল ফোন শপ',
    category: 'mobile_shop',
    x: 432,
    z: 192,
    width: 7.0,
    depth: 5.5,
    height: 3.6,
    yaw: -0.35,
    wallColor: 0xe4ebf2,
    signBg: '#0c4a6e',
    signAccent: '#38bdf8',
    isNewMarket: false,
    hasAwning: false,
    hasGlassShowroom: true,
    hasVendor: true,
    vendorLineId: 'vl_original_phone',
    items: [
      { id: 'powerbank', name: 'Fast Power Bank', bengaliName: 'পাওয়ার ব্যাংক', priceBdt: 450, energyGain: 15, kind: 'item' },
    ],
  },
  {
    id: 'shop_wasa_electronics',
    name: 'Green Valley Electronics Store',
    bengaliName: 'গ্রিন ভ্যালি ইলেকট্রনিক্স স্টোর',
    category: 'electronics',
    x: 520,
    z: -95,
    width: 9.0,
    depth: 6.5,
    height: 4.0,
    yaw: 1.48,
    wallColor: 0xd7dfe8,
    signBg: '#1e3a8a',
    signAccent: '#facc15',
    isNewMarket: false,
    hasAwning: false,
    hasGlassShowroom: true,
    hasVendor: true,
    vendorLineId: 'vl_eidike_bhalo',
    items: [
      { id: 'earbuds', name: 'Wireless Earbuds', bengaliName: 'ইয়ারবাডস', priceBdt: 380, energyGain: 10, kind: 'item' },
    ],
  },
  {
    id: 'shop_lalkhan_pharmacy',
    name: 'Lalkhan Bazar Model Pharmacy',
    bengaliName: 'লালখান বাজার মডেল ফার্মেসি',
    category: 'pharmacy',
    x: 326,
    z: 224,
    width: 6.8,
    depth: 5.2,
    height: 3.4,
    yaw: 0.76,
    wallColor: 0xf4f7f8,
    signBg: '#047857',
    signAccent: '#ffffff',
    isNewMarket: false,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_ki_lagbe_bolen',
    items: [
      { id: 'saline_aid', name: 'Glucose & ORS Pack', bengaliName: 'গ্লুকোজ ও স্যালাইন', priceBdt: 30, energyGain: 40, kind: 'drink' },
    ],
  },
  {
    id: 'shop_wasa_shopping_complex',
    name: 'WASA Square Shopping Complex',
    bengaliName: 'ওয়াসা স্কয়ার শপিং কমপ্লেক্স',
    category: 'shopping_complex',
    x: 562,
    z: -195,
    width: 16.0,
    depth: 11.0,
    height: 11.5,
    yaw: 0.0,
    wallColor: 0xdbe3ea,
    signBg: '#312e81',
    signAccent: '#fbbf24',
    isNewMarket: false,
    hasAwning: false,
    hasGlassShowroom: true,
    hasVendor: true,
    vendorLineId: 'vl_mama_asen',
    items: [
      { id: 'mall_coffee', name: 'Food Court Iced Tea', bengaliName: 'আইসড টি', priceBdt: 90, energyGain: 25, kind: 'drink' },
    ],
  },
  {
    id: 'shop_dampara_bus_counter',
    name: 'Dampara Green Line Bus Counter',
    bengaliName: 'দামপাড়া বাস কাউন্টার',
    category: 'bus_counter',
    x: 472,
    z: -415,
    width: 8.5,
    depth: 5.2,
    height: 3.5,
    yaw: 1.38,
    wallColor: 0xd7efe2,
    signBg: '#065f46',
    signAccent: '#fde047',
    isNewMarket: false,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_ki_lagbe_bolen',
    items: [
      { id: 'intercity_snack', name: 'Travel Water & Biscuits', bengaliName: 'ভ্রমণ নাস্তা', priceBdt: 40, energyGain: 25, kind: 'food' },
    ],
  },
  {
    id: 'shop_tigerpass_garage',
    name: 'Tigerpass Auto & CNG Repair Garage',
    bengaliName: 'টাইগারপাস মোটর গ্যারেজ ও রিপেয়ার',
    category: 'repair_garage',
    x: 175,
    z: 492,
    width: 10.5,
    depth: 7.2,
    height: 3.9,
    yaw: -0.52,
    wallColor: 0x626b73,
    signBg: '#b45309',
    signAccent: '#fef08a',
    isNewMarket: false,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_ki_lagbe_bolen',
    items: [
      { id: 'cold_soda', name: 'Chilled Lemon Soda', bengaliName: 'ঠান্ডা লেবু সোডা', priceBdt: 25, energyGain: 20, kind: 'drink' },
    ],
  },

  // === 2. CHATTOGRAM NEW MARKET PLAZA (x ∈ [846..956], z ∈ [452..626]) ===
  // Large Iconic Main Shopping Building (East Side facing plaza at -X)
  {
    id: 'nm_main_building_east',
    name: 'New Market Biponi Bitan Main Arcade',
    bengaliName: 'চট্টগ্রাম নিউ মার্কেট (বিপণি বিতান)',
    category: 'shopping_complex',
    x: 944,
    z: 540,
    width: 18.0,
    depth: 112.0,
    height: 14.5,
    yaw: 0,
    wallColor: 0xeee5d5,
    signBg: '#7c2d12',
    signAccent: '#facc15',
    isNewMarket: true,
    hasAwning: true,
    hasGlassShowroom: true,
    hasVendor: true,
    vendorLineId: 'vl_mama_asen',
    items: [
      { id: 'nm_jacket', name: 'Biponi Denim Jacket', bengaliName: 'ডেনিম জ্যাকেট', priceBdt: 520, energyGain: 15, kind: 'item' },
    ],
  },
  // North Wing Shopping Block
  {
    id: 'nm_north_wing',
    name: 'New Market North Electronics & Fashion Wing',
    bengaliName: 'নিউ মার্কেট উত্তর ব্লক · ইলেকট্রনিক্স ও বস্ত্র',
    category: 'electronics',
    x: 892,
    z: 454,
    width: 78.0,
    depth: 14.0,
    height: 11.2,
    yaw: 0,
    wallColor: 0xe0e7ee,
    signBg: '#1e3a8a',
    signAccent: '#fcd34d',
    isNewMarket: true,
    hasAwning: true,
    hasGlassShowroom: true,
    hasVendor: true,
    vendorLineId: 'vl_eidike_bhalo',
    items: [
      { id: 'nm_speaker', name: 'Bluetooth Market Speaker', bengaliName: 'ব্লুটুথ স্পিকার', priceBdt: 400, energyGain: 12, kind: 'item' },
    ],
  },
  // South Wing Shopping Block
  {
    id: 'nm_south_wing',
    name: 'New Market South Footwear & Household Wing',
    bengaliName: 'নিউ মার্কেট দক্ষিণ ব্লক · জুতা ও গৃহস্থালি',
    category: 'footwear',
    x: 892,
    z: 624,
    width: 78.0,
    depth: 14.0,
    height: 11.2,
    yaw: 0,
    wallColor: 0xeadcd0,
    signBg: '#065f46',
    signAccent: '#fde047',
    isNewMarket: true,
    hasAwning: true,
    hasGlassShowroom: true,
    hasVendor: true,
    vendorLineId: 'vl_kom_dame',
    items: [
      { id: 'nm_sandal', name: 'Leather Sandals', bengaliName: 'চামড়ার স্যান্ডেল', priceBdt: 320, energyGain: 14, kind: 'item' },
    ],
  },

  // Detailed Bustling Market Shops & Stalls inside New Market Courtyard
  {
    id: 'nm_stall_clothing_1',
    name: 'Khwaja Fashion & Jamdani House',
    bengaliName: 'খাজা ফ্যাশন ও জামদানি হাউস',
    category: 'clothing',
    x: 866,
    z: 492,
    width: 8.5,
    depth: 5.5,
    height: 3.4,
    yaw: 0,
    wallColor: 0xf4e8d8,
    signBg: '#9f1239',
    signAccent: '#fde047',
    isNewMarket: true,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_jama_sundor',
    items: [
      { id: 'nm_kurta', name: 'Cotton Kurta / Three-Piece', bengaliName: 'কটন পাঞ্জাবি / থ্রি-পিস', priceBdt: 450, energyGain: 15, kind: 'item' },
    ],
  },
  {
    id: 'nm_stall_footwear_1',
    name: 'Chattogram Leather Footwear Corner',
    bengaliName: 'চট্টগ্রাম লেদার ফুটওয়্যার কর্নার',
    category: 'footwear',
    x: 866,
    z: 514,
    width: 8.5,
    depth: 5.5,
    height: 3.3,
    yaw: 0,
    wallColor: 0xe6d6c3,
    signBg: '#78350f',
    signAccent: '#fef08a',
    isNewMarket: true,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_kom_dame',
    items: [
      { id: 'nm_sneakers', name: 'Canvas Street Sneakers', bengaliName: 'স্ট্রিট স্নিকার্স', priceBdt: 480, energyGain: 16, kind: 'item' },
    ],
  },
  {
    id: 'nm_stall_bags_1',
    name: 'Bengal Bag & Travel House',
    bengaliName: 'বেঙ্গল ব্যাগ ও ট্রাভেল হাউস',
    category: 'bags',
    x: 866,
    z: 566,
    width: 8.5,
    depth: 5.5,
    height: 3.3,
    yaw: Math.PI,
    wallColor: 0xdce4ea,
    signBg: '#1e293b',
    signAccent: '#fbbf24',
    isNewMarket: true,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_mama_asen',
    items: [
      { id: 'nm_backpack', name: 'City Backpack', bengaliName: 'সিটি ব্যাকপ্যাক', priceBdt: 390, energyGain: 14, kind: 'item' },
    ],
  },
  {
    id: 'nm_stall_cosmetics_1',
    name: 'Ruposhi Cosmetics & Perfumes',
    bengaliName: 'রূপসী কসমেটিক্স ও পারফিউম',
    category: 'cosmetics',
    x: 866,
    z: 588,
    width: 8.5,
    depth: 5.5,
    height: 3.3,
    yaw: Math.PI,
    wallColor: 0xf7e4ec,
    signBg: '#86198f',
    signAccent: '#fef08a',
    isNewMarket: true,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_dekhe_jan',
    items: [
      { id: 'nm_attar', name: 'Jasmine Attar Perfume', bengaliName: 'জুঁই আতর', priceBdt: 140, energyGain: 18, kind: 'item' },
    ],
  },
  {
    id: 'nm_stall_electronics_1',
    name: 'Metro Electronics & Watch Mart',
    bengaliName: 'মেট্রো ইলেকট্রনিক্স ও ঘড়ি বাজার',
    category: 'electronics',
    x: 906,
    z: 492,
    width: 8.5,
    depth: 5.5,
    height: 3.4,
    yaw: 0,
    wallColor: 0xdbe6f0,
    signBg: '#0f172a',
    signAccent: '#38bdf8',
    isNewMarket: true,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_eidike_bhalo',
    items: [
      { id: 'nm_watch', name: 'Digital Wristwatch', bengaliName: 'হাতঘড়ি', priceBdt: 280, energyGain: 12, kind: 'item' },
    ],
  },
  {
    id: 'nm_stall_toys_1',
    name: 'Shishu Mela Toy & Gift Corner',
    bengaliName: 'শিশু মেলা খেলনা ও গিফট শপ',
    category: 'toys',
    x: 906,
    z: 514,
    width: 8.5,
    depth: 5.5,
    height: 3.3,
    yaw: 0,
    wallColor: 0xfef3c7,
    signBg: '#b91c1c',
    signAccent: '#fde047',
    isNewMarket: true,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_dekhe_jan',
    items: [
      { id: 'nm_rickshaw_model', name: 'Miniature Rickshaw Toy', bengaliName: 'খেলনা রিকশা', priceBdt: 150, energyGain: 15, kind: 'item' },
    ],
  },
  {
    id: 'nm_stall_household_1',
    name: 'Ghor-Shongshar Household Bazaar',
    bengaliName: 'ঘর-সংসার গৃহস্থালি ও ক্রোকারিজ',
    category: 'household',
    x: 906,
    z: 566,
    width: 8.5,
    depth: 5.5,
    height: 3.3,
    yaw: Math.PI,
    wallColor: 0xe6ece2,
    signBg: '#166534',
    signAccent: '#fef08a',
    isNewMarket: true,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_kom_dame',
    items: [
      { id: 'nm_flask', name: 'Tea Thermos Flask', bengaliName: 'চা-ফ্লাস্ক', priceBdt: 260, energyGain: 15, kind: 'item' },
    ],
  },
  {
    id: 'nm_stall_tea_food',
    name: 'New Market Chotpoti & Malai Tea',
    bengaliName: 'নিউ মার্কেট চটপটি ও চা স্টল',
    category: 'tea_stall',
    x: 906,
    z: 588,
    width: 8.5,
    depth: 5.5,
    height: 3.2,
    yaw: Math.PI,
    wallColor: 0x3b725e,
    signBg: '#c2410c',
    signAccent: '#fef08a',
    isNewMarket: true,
    hasAwning: true,
    hasVendor: true,
    vendorLineId: 'vl_garam_cha',
    items: [
      { id: 'nm_chotpoti', name: 'Hot Chotpoti & Tamarind', bengaliName: 'গরম চটপটি', priceBdt: 45, energyGain: 35, kind: 'food' },
      { id: 'nm_malai_tea', name: 'New Market Special Cha', bengaliName: 'স্পেশাল মালাই চা', priceBdt: 20, energyGain: 22, kind: 'drink' },
    ],
  },
];

export const NEW_MARKET_GATE_POS = { x: 848, z: 540 };

export function getVendorVoiceLineById(id: string): VendorVoiceLine {
  return NEW_MARKET_VENDOR_LINES.find((l) => l.id === id) || NEW_MARKET_VENDOR_LINES[0];
}

/**
 * Spatial audio distance attenuation curve for live Bengali vendor calls.
 * Smoothly grows louder near shops (<= 3m -> 1.0) and attenuates naturally to 0 by maxRangeM (28m).
 */
export function computeSpatialVoiceGain(distanceM: number, maxRangeM = 28): number {
  if (distanceM <= 2.2) return 1.0;
  if (distanceM >= maxRangeM) return 0;
  const norm = 1 - (distanceM - 2.2) / (maxRangeM - 2.2);
  return Math.round(norm * norm * 1000) / 1000;
}

export interface VendorVoiceCandidate {
  shopId: string;
  shopName: string;
  bengaliShopName: string;
  vendorX: number;
  vendorZ: number;
  distanceM: number;
  spatialGain: number;
  line: VendorVoiceLine;
}

export function findNearestVendorVoiceCandidate(
  playerX: number,
  playerZ: number,
  cooldowns: ReadonlyMap<string, number>,
  maxRangeM = 24
): VendorVoiceCandidate | null {
  let best: VendorVoiceCandidate | null = null;
  let bestDist = maxRangeM;

  for (const s of ROADSIDE_AND_NEW_MARKET_SHOPS) {
    if (!s.hasVendor) continue;
    const cd = cooldowns.get(s.id) ?? 0;
    if (cd > 0) continue;

    // Vendor stands right in front of the shopfront counter
    const vx = s.x + Math.sin(s.yaw) * (s.depth * 0.5 + 1.1);
    const vz = s.z + Math.cos(s.yaw) * (s.depth * 0.5 + 1.1);
    const d = Math.hypot(playerX - vx, playerZ - vz);
    if (d < bestDist) {
      bestDist = d;
      best = {
        shopId: s.id,
        shopName: s.name,
        bengaliShopName: s.bengaliName,
        vendorX: vx,
        vendorZ: vz,
        distanceM: Math.round(d * 10) / 10,
        spatialGain: computeSpatialVoiceGain(d, maxRangeM),
        line: getVendorVoiceLineById(s.vendorLineId),
      };
    }
  }
  return best;
}
