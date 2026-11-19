import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GIS_DATA, GisBuilding } from '../gis/projection';
import { LandmarkRecord, VERIFIED_LANDMARKS } from '../gis/landmarks';
import { getTerrainHeight, sampleElevationASL } from '../sim/terrain';
import { ProceduralTexturePack, createBengaliSignTexture } from './textures';
import { AMEEN_CENTER_SPEC, isOverlappingAmeenCenterSite } from '../sim/ameenCenter';
import { buildAmeenCenterLandmark } from './ameenCenterBuilder';

export interface EnterableLandmarkInstance {
  landmark: LandmarkRecord;
  group: THREE.Group;
  doorPivot: THREE.Group;
  doorOpenProgress: number;
  targetDoorOpen: boolean;
  elevatorCabin?: THREE.Group;
  elevatorFloor: number;
  targetFloor: number;
  floorHeight: number;
  baseY: number;
}

export interface BuildingSystemHandles {
  enterables: EnterableLandmarkInstance[];
  solidMeshes: THREE.Object3D[];
  dispose: () => void;
}

function estimateBuildingMetrics(b: GisBuilding): { height: number; tier: 'tower' | 'midrise' | 'hillside' | 'shack' } {
  const asl = sampleElevationASL(b.cx, b.cz);
  if (b.levels > 0) {
    const h = b.levels * 3.2;
    return {
      height: h,
      tier: b.levels >= 6 ? 'tower' : b.levels >= 3 ? 'midrise' : 'hillside',
    };
  }
  // Hilltop dwellings (Motijharna / Tankir Pahar) vs CDA Avenue commercial/residential blocks
  if (asl > 29 && b.area < 140) {
    return { height: 3.2 + (b.area % 3), tier: 'shack' };
  }
  if (asl > 26 && b.area < 240) {
    return { height: 5.8 + (b.area % 4), tier: 'hillside' };
  }
  if (b.area > 650 || b.type === 'apartments' || b.type === 'commercial') {
    return { height: 18 + (b.area % 12), tier: 'tower' };
  }
  if (b.area > 220) {
    return { height: 10.5 + (b.area % 7), tier: 'midrise' };
  }
  return { height: 6.2 + (b.area % 4), tier: 'hillside' };
}

function buildFootprintPrismGeometry(b: GisBuilding, baseY: number, height: number): THREE.BufferGeometry | null {
  if (b.poly.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(b.poly[0][0] - b.cx, -(b.poly[0][1] - b.cz));
  for (let i = 1; i < b.poly.length; i++) {
    shape.lineTo(b.poly[i][0] - b.cx, -(b.poly[i][1] - b.cz));
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(b.cx, baseY - 0.8, b.cz); // Sink 0.8m foundation into hillside slopes so zero buildings float!
  return geo;
}

function buildEnterableLandmarkGroup(
  scene: THREE.Scene,
  lm: LandmarkRecord,
  textures: ProceduralTexturePack,
  maxAnisotropy: number,
  disposables: { dispose: () => void }[]
): EnterableLandmarkInstance {
  if (lm.id === AMEEN_CENTER_SPEC.id) {
    return buildAmeenCenterLandmark(scene, lm, textures, maxAnisotropy, disposables);
  }
  const baseY = getTerrainHeight(lm.x, lm.z);
  const g = new THREE.Group();
  g.position.set(lm.x, baseY, lm.z);
  g.rotation.y = lm.yaw;

  const totalH = lm.floors * lm.floorHeight;
  const hw = lm.width * 0.5;
  const hd = lm.depth * 0.5;
  const wallT = 0.4;
  const doorHalfW = 2.0;

  // Exterior & interior materials
  const wallColor =
    lm.isMosque
      ? 0xf4f0e6
      : lm.category === 'commercial' || lm.category === 'office'
        ? 0xdce4ea
        : lm.category === 'hotel'
          ? 0xe8e2d6
          : lm.category === 'tea_stall'
            ? 0x2b6e58
            : 0xe6d7c3;

  const extMap = lm.isMosque ? textures.mosqueTileMap : lm.category === 'tea_stall' ? undefined : textures.facadeApartmentMap;
  const extMat = new THREE.MeshStandardMaterial({
    color: wallColor,
    ...(extMap ? { map: extMap } : {}),
    roughness: lm.isMosque ? 0.45 : 0.72,
    metalness: lm.category === 'commercial' || lm.category === 'hotel' ? 0.18 : 0.04,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: lm.isMosque ? textures.prayerCarpetMap : textures.mosqueTileMap,
    roughness: lm.isMosque ? 0.92 : 0.42,
    metalness: 0.05,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: lm.isMosque ? 0x156549 : 0x3b4856,
    roughness: 0.35,
    metalness: 0.45,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x7cb0cf,
    roughness: 0.12,
    metalness: 0.6,
    transparent: true,
    opacity: 0.55,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6f4728,
    roughness: 0.75,
    metalness: 0.05,
  });

  disposables.push(extMat, floorMat, trimMat, glassMat, woodMat);

  // Foundation plinth (reaches down -1.5m into slope)
  const plinthGeo = new THREE.BoxGeometry(lm.width + 0.8, 1.8, lm.depth + 0.8);
  plinthGeo.translate(0, -0.75, 0);
  disposables.push(plinthGeo);
  const plinth = new THREE.Mesh(plinthGeo, trimMat);
  plinth.receiveShadow = true;
  g.add(plinth);

  // Ground Floor Slab + Upper Floor Slabs + Rooftop Slab
  const slabGeo = new THREE.BoxGeometry(lm.width, 0.28, lm.depth);
  disposables.push(slabGeo);
  const groundSlab = new THREE.Mesh(slabGeo, floorMat);
  groundSlab.position.set(0, 0.14, 0);
  groundSlab.receiveShadow = true;
  g.add(groundSlab);

  for (let f = 1; f <= lm.floors; f++) {
    const slab = new THREE.Mesh(slabGeo, trimMat);
    slab.position.set(0, f * lm.floorHeight, 0);
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);
  }

  // Rooftop Parapet Wall (so player can walk safely on rooftop & enjoy Lalkhan Bazar view!)
  if (lm.hasRooftop) {
    const parH = 1.05;
    const pFB = new THREE.BoxGeometry(lm.width, parH, 0.3);
    const pLR = new THREE.BoxGeometry(0.3, parH, lm.depth);
    disposables.push(pFB, pLR);
    const pN = new THREE.Mesh(pFB, extMat);
    pN.position.set(0, totalH + parH * 0.5, -hd + 0.15);
    const pS = new THREE.Mesh(pFB, extMat);
    pS.position.set(0, totalH + parH * 0.5, hd - 0.15);
    const pW = new THREE.Mesh(pLR, extMat);
    pW.position.set(-hw + 0.15, totalH + parH * 0.5, 0);
    const pE = new THREE.Mesh(pLR, extMat);
    pE.position.set(hw - 0.15, totalH + parH * 0.5, 0);
    g.add(pN, pS, pW, pE);

    // Rooftop water tank (signature Chattogram skyline detail!)
    const tankGeo = new THREE.CylinderGeometry(1.1, 1.1, 2.0, 12);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.45 });
    disposables.push(tankGeo, tankMat);
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.set(-hw + 2.4, totalH + 1.1, -hd + 2.4);
    g.add(tank);
  }

  // Solid Back Wall (-Z), Left Wall (-X), Right Wall (+X)
  const backGeo = new THREE.BoxGeometry(lm.width, totalH, wallT);
  const sideGeo = new THREE.BoxGeometry(wallT, totalH, lm.depth);
  disposables.push(backGeo, sideGeo);
  const backW = new THREE.Mesh(backGeo, extMat);
  backW.position.set(0, totalH * 0.5, -hd + wallT * 0.5);
  backW.castShadow = true;
  backW.receiveShadow = true;
  const leftW = new THREE.Mesh(sideGeo, extMat);
  leftW.position.set(-hw + wallT * 0.5, totalH * 0.5, 0);
  leftW.castShadow = true;
  const rightW = new THREE.Mesh(sideGeo, extMat);
  rightW.position.set(hw - wallT * 0.5, totalH * 0.5, 0);
  rightW.castShadow = true;
  g.add(backW, leftW, rightW);

  // Front Wall (+Z) split cleanly around open center doorway (|x| < doorHalfW, y < 3.1m)
  const wingW = Math.max(1.0, hw - doorHalfW);
  const wingGeo = new THREE.BoxGeometry(wingW, totalH, wallT);
  const headerGeo = new THREE.BoxGeometry(doorHalfW * 2, Math.max(0.4, totalH - 3.1), wallT);
  disposables.push(wingGeo, headerGeo);

  const frontL = new THREE.Mesh(wingGeo, extMat);
  frontL.position.set(-hw + wingW * 0.5, totalH * 0.5, hd - wallT * 0.5);
  const frontR = new THREE.Mesh(wingGeo, extMat);
  frontR.position.set(hw - wingW * 0.5, totalH * 0.5, hd - wallT * 0.5);
  g.add(frontL, frontR);

  if (totalH > 3.2) {
    const frontHeader = new THREE.Mesh(headerGeo, extMat);
    frontHeader.position.set(0, 3.1 + (totalH - 3.1) * 0.5, hd - wallT * 0.5);
    g.add(frontHeader);
  }

  // Animated Hinged Front Door
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-doorHalfW, 0.25, hd - wallT * 0.5);
  const doorLeafGeo = new THREE.BoxGeometry(doorHalfW * 1.9, 2.8, 0.1);
  doorLeafGeo.translate(doorHalfW * 0.95, 1.4, 0);
  disposables.push(doorLeafGeo);
  const doorMesh = new THREE.Mesh(doorLeafGeo, lm.category === 'commercial' ? glassMat : woodMat);
  doorPivot.add(doorMesh);
  g.add(doorPivot);

  // Bengali + English Shop/Landmark Signboard above Entrance
  const signW = Math.min(lm.width - 1.2, 11.5);
  const signGeo = new THREE.PlaneGeometry(signW, 1.65);
  const signTex = createBengaliSignTexture(
    lm.bengaliName,
    lm.name,
    lm.isMosque ? '#0f523a' : lm.category === 'tea_stall' ? '#8c3b20' : '#182b3a',
    '#ffffff',
    '#f0c659',
    maxAnisotropy
  );
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 });
  disposables.push(signGeo, signTex, signMat);
  const signMesh = new THREE.Mesh(signGeo, signMat);
  signMesh.position.set(0, 3.85, hd + 0.08);
  g.add(signMesh);

  // Special Interior & Architectural Features
  if (lm.isMosque) {
    // Central Green/White Islamic Dome + Twin Minarets
    const domeGeo = new THREE.SphereGeometry(Math.min(hw, hd) * 0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x167554, roughness: 0.3, metalness: 0.35 });
    const minaretGeo = new THREE.CylinderGeometry(0.45, 0.65, totalH + 6.5, 10);
    const spireGeo = new THREE.ConeGeometry(0.65, 1.8, 10);
    disposables.push(domeGeo, domeMat, minaretGeo, spireGeo);

    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(0, totalH + 0.1, 0);
    g.add(dome);

    for (const sx of [-1, 1]) {
      const min = new THREE.Mesh(minaretGeo, extMat);
      min.position.set(sx * (hw - 1.1), (totalH + 6.5) * 0.5, hd - 1.1);
      const sp = new THREE.Mesh(spireGeo, domeMat);
      sp.position.set(sx * (hw - 1.1), totalH + 7.4, hd - 1.1);
      g.add(min, sp);
    }

    // Shoe Rack near doorway + Wudu (Ablution) Fountain Basin inside courtyard corner
    const rackGeo = new THREE.BoxGeometry(2.4, 1.0, 0.5);
    const wuduGeo = new THREE.CylinderGeometry(1.3, 1.4, 0.65, 16);
    const waterGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.1, 16);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f88b5, roughness: 0.1, metalness: 0.3 });
    disposables.push(rackGeo, wuduGeo, waterGeo, waterMat);

    const rack = new THREE.Mesh(rackGeo, woodMat);
    rack.position.set(hw - 2.0, 0.75, hd - 1.5);
    const wudu = new THREE.Mesh(wuduGeo, extMat);
    wudu.position.set(-hw + 2.4, 0.55, hd - 2.6);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(-hw + 2.4, 0.88, hd - 2.6);
    g.add(rack, wudu, water);
  } else if (lm.shopMenu && lm.shopMenu.length > 0) {
    // Counter & dining tables/benches inside shops & tea stalls
    const counterGeo = new THREE.BoxGeometry(Math.min(5.2, lm.width * 0.5), 1.05, 0.9);
    const tableGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.78, 12);
    disposables.push(counterGeo, tableGeo);
    const counter = new THREE.Mesh(counterGeo, woodMat);
    counter.position.set(0, 0.75, -hd + 2.2);
    g.add(counter);

    const t1 = new THREE.Mesh(tableGeo, woodMat);
    t1.position.set(-hw * 0.38, 0.65, 0.8);
    const t2 = new THREE.Mesh(tableGeo, woodMat);
    t2.position.set(hw * 0.38, 0.65, 0.8);
    g.add(t1, t2);
  }

  // Interactive Working Elevator Shaft & Cabin
  let elevatorCabin: THREE.Group | undefined;
  if (lm.hasElevator) {
    const shaftGeo = new THREE.BoxGeometry(2.6, totalH, 2.6);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0x3b4e5e,
      roughness: 0.25,
      metalness: 0.55,
      transparent: true,
      opacity: 0.35,
    });
    const cabFloorGeo = new THREE.BoxGeometry(2.2, 0.18, 2.2);
    const cabBackGeo = new THREE.BoxGeometry(2.2, 2.4, 0.12);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xc29d53, roughness: 0.3, metalness: 0.7 });
    disposables.push(shaftGeo, shaftMat, cabFloorGeo, cabBackGeo, cabMat);

    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(hw - 2.5, totalH * 0.5, -hd + 2.5);
    g.add(shaft);

    elevatorCabin = new THREE.Group();
    elevatorCabin.position.set(hw - 2.5, 0.3, -hd + 2.5);
    const cFloor = new THREE.Mesh(cabFloorGeo, cabMat);
    const cBack = new THREE.Mesh(cabBackGeo, cabMat);
    cBack.position.set(0, 1.25, -1.04);
    elevatorCabin.add(cFloor, cBack);
    g.add(elevatorCabin);
  }

  scene.add(g);

  return {
    landmark: lm,
    group: g,
    doorPivot,
    doorOpenProgress: 0,
    targetDoorOpen: false,
    elevatorCabin,
    elevatorFloor: 0,
    targetFloor: 0,
    floorHeight: lm.floorHeight,
    baseY,
  };
}

import { ROADSIDE_AND_NEW_MARKET_SHOPS, NEW_MARKET_GATE_POS, RoadsideShopSpec } from '../sim/newMarketAndShops';

function buildShopGroup(
  scene: THREE.Scene,
  shop: RoadsideShopSpec,
  textures: ProceduralTexturePack,
  maxAnisotropy: number,
  disposables: { dispose: () => void }[]
): THREE.Group {
  const baseY = getTerrainHeight(shop.x, shop.z);
  const g = new THREE.Group();
  g.position.set(shop.x, baseY, shop.z);
  g.rotation.y = shop.yaw;

  const hw = shop.width * 0.5;
  const hd = shop.depth * 0.5;

  const wallMat = new THREE.MeshStandardMaterial({
    color: shop.wallColor,
    ...(shop.height >= 9 ? { map: textures.facadeApartmentMap } : {}),
    roughness: 0.72,
    metalness: shop.hasGlassShowroom ? 0.16 : 0.04,
  });
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x3a424a, roughness: 0.85 });
  const frontMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.shopfrontMap,
    emissive: 0xffb85c,
    emissiveMap: textures.shopfrontMap,
    emissiveIntensity: 0.35,
    roughness: 0.32,
    metalness: 0.12,
  });
  const awningMat = new THREE.MeshStandardMaterial({
    color: shop.signBg,
    roughness: 0.78,
    metalness: 0.05,
  });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x7c4d2b, roughness: 0.75 });
  disposables.push(wallMat, plinthMat, frontMat, awningMat, counterMat);

  // Foundation plinth sunk -0.8m into terrain
  const plinthGeo = new THREE.BoxGeometry(shop.width + 0.3, 1.0, shop.depth + 0.3);
  plinthGeo.translate(0, -0.35, 0);
  const bodyGeo = new THREE.BoxGeometry(shop.width, shop.height, shop.depth);
  bodyGeo.translate(0, shop.height * 0.5 + 0.1, 0);
  disposables.push(plinthGeo, bodyGeo);

  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  const body = new THREE.Mesh(bodyGeo, wallMat);
  body.castShadow = shop.height >= 4.0;
  body.receiveShadow = true;
  g.add(plinth, body);

  // Illuminated Glass / Open Shopfront on +Z face (or -X face for East New Market arcade)
  const isEastArcade = shop.id === 'nm_main_building_east';
  if (isEastArcade) {
    // Faces -X into the New Market Courtyard!
    const winGeo = new THREE.PlaneGeometry(shop.depth * 0.88, 3.4);
    const winMat = new THREE.MeshStandardMaterial({
      map: textures.shopfrontMap,
      emissive: 0xffc670,
      emissiveMap: textures.shopfrontMap,
      emissiveIntensity: 0.42,
      roughness: 0.25,
    });
    const signGeo = new THREE.PlaneGeometry(24, 2.8);
    const signTex = createBengaliSignTexture(shop.bengaliName, shop.name, shop.signBg, '#ffffff', shop.signAccent, maxAnisotropy);
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 });
    disposables.push(winGeo, winMat, signGeo, signTex, signMat);

    const win = new THREE.Mesh(winGeo, winMat);
    win.rotation.y = -Math.PI / 2;
    win.position.set(-hw - 0.06, 2.0, 0);
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.rotation.y = -Math.PI / 2;
    sign.position.set(-hw - 0.12, 4.9, 0);
    g.add(win, sign);
  } else {
    const winW = Math.min(shop.width * 0.84, 14);
    const winH = Math.min(shop.height * 0.72, 2.8);
    const winGeo = new THREE.PlaneGeometry(winW, winH);
    disposables.push(winGeo);
    const win = new THREE.Mesh(winGeo, frontMat);
    win.position.set(0, winH * 0.5 + 0.28, hd + 0.05);
    g.add(win);

    // Bangla Signboard
    const signW = Math.min(shop.width + 0.4, 11.5);
    const signH = shop.height >= 9 ? 1.85 : 1.15;
    const signGeo = new THREE.PlaneGeometry(signW, signH);
    const signTex = createBengaliSignTexture(shop.bengaliName, shop.name, shop.signBg, '#ffffff', shop.signAccent, maxAnisotropy);
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0xffe4a0,
      emissiveMap: signTex,
      emissiveIntensity: 0.22,
      roughness: 0.42,
    });
    disposables.push(signGeo, signTex, signMat);
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, Math.min(shop.height + 0.35, 4.35), hd + 0.12);
    g.add(sign);

    // Striped/colored overhanging awning & front vendor counter
    if (shop.hasAwning) {
      const awnGeo = new THREE.BoxGeometry(shop.width * 0.96, 0.12, 1.55);
      disposables.push(awnGeo);
      const awn = new THREE.Mesh(awnGeo, awningMat);
      awn.position.set(0, 2.85, hd + 0.72);
      awn.rotation.x = 0.22;
      g.add(awn);
    }

    if (shop.category === 'tea_stall' || shop.category === 'paan_shop' || shop.isNewMarket) {
      const cntGeo = new THREE.BoxGeometry(Math.min(shop.width * 0.7, 3.6), 0.92, 0.65);
      disposables.push(cntGeo);
      const cnt = new THREE.Mesh(cntGeo, counterMat);
      cnt.position.set(0, 0.56, hd + 0.38);
      g.add(cnt);
    }

    // Special Car / Motorbike Showroom podium accent & Repair Garage bay cone
    if (shop.category === 'car_showroom' || shop.category === 'motorbike_showroom') {
      const podGeo = new THREE.BoxGeometry(shop.width * 0.55, 0.22, 2.2);
      const podMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.4 });
      disposables.push(podGeo, podMat);
      const pod = new THREE.Mesh(podGeo, podMat);
      pod.position.set(0, 0.22, hd + 1.4);
      g.add(pod);
    } else if (shop.category === 'repair_garage') {
      const coneGeo = new THREE.ConeGeometry(0.22, 0.65, 8);
      const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
      disposables.push(coneGeo, coneMat);
      for (const cx of [-2.4, 2.4]) {
        const c = new THREE.Mesh(coneGeo, coneMat);
        c.position.set(cx, 0.42, hd + 1.3);
        g.add(c);
      }
    }
  }

  scene.add(g);
  return g;
}

function buildNewMarketEntranceArch(
  scene: THREE.Scene,
  maxAnisotropy: number,
  disposables: { dispose: () => void }[]
): THREE.Group {
  const gx = NEW_MARKET_GATE_POS.x;
  const gz = NEW_MARKET_GATE_POS.z;
  const gy = getTerrainHeight(gx, gz);
  const g = new THREE.Group();
  g.position.set(gx, gy, gz);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.55, metalness: 0.15 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.45 });
  const pilGeo = new THREE.BoxGeometry(1.4, 7.2, 1.4);
  const beamGeo = new THREE.BoxGeometry(1.8, 2.4, 15.6);
  const signTex = createBengaliSignTexture(
    'চট্টগ্রাম নিউ মার্কেট (বিপণি বিতান)',
    'CHATTOGRAM NEW MARKET · SHOPPING PLAZA',
    '#7c2d12',
    '#ffffff',
    '#fde047',
    maxAnisotropy
  );
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: 0xffd570,
    emissiveMap: signTex,
    emissiveIntensity: 0.25,
    roughness: 0.4,
  });
  const signGeo = new THREE.PlaneGeometry(13.8, 2.1);

  disposables.push(pillarMat, trimMat, pilGeo, beamGeo, signTex, signMat, signGeo);

  const pNorth = new THREE.Mesh(pilGeo, pillarMat);
  pNorth.position.set(0, 3.6, -7.2);
  const pSouth = new THREE.Mesh(pilGeo, pillarMat);
  pSouth.position.set(0, 3.6, 7.2);
  const beam = new THREE.Mesh(beamGeo, trimMat);
  beam.position.set(0, 7.6, 0);

  const signW = new THREE.Mesh(signGeo, signMat);
  signW.rotation.y = -Math.PI / 2;
  signW.position.set(-0.95, 7.6, 0);
  const signE = new THREE.Mesh(signGeo, signMat);
  signE.rotation.y = Math.PI / 2;
  signE.position.set(0.95, 7.6, 0);

  g.add(pNorth, pSouth, beam, signW, signE);
  scene.add(g);
  return g;
}

export function buildBuildingSystem(
  scene: THREE.Scene,
  textures: ProceduralTexturePack,
  maxAnisotropy: number
): BuildingSystemHandles {
  const disposables: { dispose: () => void }[] = [];
  const solidMeshes: THREE.Object3D[] = [];
  const enterables: EnterableLandmarkInstance[] = [];

  // 1. Build all Enterable Landmarks (skip open-air New Market plaza entry)
  for (const lm of VERIFIED_LANDMARKS) {
    if (lm.isOpenPlaza) continue;
    const inst = buildEnterableLandmarkGroup(scene, lm, textures, maxAnisotropy, disposables);
    enterables.push(inst);
    solidMeshes.push(inst.group);
  }

  // 2. Build all Bangladeshi Roadside Businesses & Detailed New Market Shopping Plaza + Stalls
  for (const shop of ROADSIDE_AND_NEW_MARKET_SHOPS) {
    const sg = buildShopGroup(scene, shop, textures, maxAnisotropy, disposables);
    solidMeshes.push(sg);
  }
  solidMeshes.push(buildNewMarketEntranceArch(scene, maxAnisotropy, disposables));

  // 3. Batch all remaining ~4,177 real OSM building footprints by Chattogram architectural tier
  const towerGeos: THREE.BufferGeometry[] = [];
  const midriseGeos: THREE.BufferGeometry[] = [];
  const hillsideGeos: THREE.BufferGeometry[] = [];
  const shackGeos: THREE.BufferGeometry[] = [];
  const roofGeos: THREE.BufferGeometry[] = [];

  for (const b of GIS_DATA.buildings) {
    const overlapsLandmark =
      isOverlappingAmeenCenterSite(b.cx, b.cz) ||
      VERIFIED_LANDMARKS.some(
        (lm) => !lm.isOpenPlaza && Math.hypot(b.cx - lm.x, b.cz - lm.z) < Math.max(lm.width, lm.depth) * 0.68
      );
    if (overlapsLandmark) continue;

    const overlapsShop = ROADSIDE_AND_NEW_MARKET_SHOPS.some(
      (s) => Math.hypot(b.cx - s.x, b.cz - s.z) < Math.max(s.width, s.depth) * 0.65
    );
    if (overlapsShop) continue;

    const baseY = getTerrainHeight(b.cx, b.cz);
    const { height, tier } = estimateBuildingMetrics(b);
    const geo = buildFootprintPrismGeometry(b, baseY, height);
    if (!geo) continue;

    if (tier === 'tower') towerGeos.push(geo);
    else if (tier === 'midrise') midriseGeos.push(geo);
    else if (tier === 'hillside') hillsideGeos.push(geo);
    else shackGeos.push(geo);

    if (tier === 'shack' && b.area < 160) {
      const cap = buildFootprintPrismGeometry(b, baseY + height - 0.15, 0.35);
      if (cap) roofGeos.push(cap);
    }
  }

  const towerMat = new THREE.MeshStandardMaterial({
    color: 0xd9e1e8,
    map: textures.facadeApartmentMap,
    roughness: 0.62,
    metalness: 0.15,
  });
  const midriseMat = new THREE.MeshStandardMaterial({
    color: 0xe6dac9,
    map: textures.facadeApartmentMap,
    roughness: 0.78,
    metalness: 0.04,
  });
  const hillsideMat = new THREE.MeshStandardMaterial({
    color: 0xd8b8a4,
    map: textures.facadeHillsideMap,
    roughness: 0.88,
    metalness: 0.02,
  });
  const shackMat = new THREE.MeshStandardMaterial({
    color: 0xc29e83,
    map: textures.facadeHillsideMap,
    roughness: 0.92,
    metalness: 0.01,
  });
  const tinMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.tinRoofMap,
    roughness: 0.52,
    metalness: 0.45,
  });

  disposables.push(towerMat, midriseMat, hillsideMat, shackMat, tinMat);

  const addBatch = (geos: THREE.BufferGeometry[], mat: THREE.Material, castShadow: boolean) => {
    if (geos.length === 0) return;
    const chunkSize = 800;
    for (let i = 0; i < geos.length; i += chunkSize) {
      const slice = geos.slice(i, i + chunkSize);
      const merged = mergeGeometries(slice, false);
      slice.forEach((g) => g.dispose());
      if (merged) {
        disposables.push(merged);
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        scene.add(mesh);
        solidMeshes.push(mesh);
      }
    }
  };

  addBatch(towerGeos, towerMat, true);
  addBatch(midriseGeos, midriseMat, true);
  addBatch(hillsideGeos, hillsideMat, false);
  addBatch(shackGeos, shackMat, false);
  addBatch(roofGeos, tinMat, false);

  return {
    enterables,
    solidMeshes,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
