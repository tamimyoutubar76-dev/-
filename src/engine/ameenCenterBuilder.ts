import * as THREE from 'three';
import { LandmarkRecord } from '../gis/landmarks';
import { getTerrainHeight } from '../sim/terrain';
import {
  AMEEN_CENTER_SPEC,
  AMEEN_GROUND_SHOPS,
  AMEEN_BED_COORDS,
} from '../sim/ameenCenter';
import type { EnterableLandmarkInstance } from './buildingSystem';
import { ProceduralTexturePack } from './textures';

function makeAmeenSignTexture(
  text: string,
  bgColor: string,
  textColor: string,
  accentLine: string | null,
  maxAnisotropy: number,
  w = 512,
  h = 128,
  fontSize = 62
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  if (accentLine) {
    ctx.strokeStyle = accentLine;
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  }

  // Subtle architectural glossy sheen on signboards
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,0.14)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = textColor;
  ctx.font = `800 ${fontSize}px "Outfit", "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w * 0.5, h * 0.52, w * 0.88);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

function makeWingConcreteTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ece6db';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(130, 124, 112, 0.28)';
  ctx.lineWidth = 2;
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

function makeBlueCladdingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1277e3';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(7, 56, 122, 0.45)';
  ctx.lineWidth = 3;
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.2)';
  ctx.lineWidth = 2;
  for (let x = 64; x < 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

export function buildAmeenCenterLandmark(
  scene: THREE.Scene,
  lm: LandmarkRecord,
  textures: ProceduralTexturePack,
  maxAnisotropy: number,
  disposables: { dispose: () => void }[]
): EnterableLandmarkInstance {
  const baseY = getTerrainHeight(lm.x, lm.z);
  const g = new THREE.Group();
  g.position.set(lm.x, baseY, lm.z);
  g.rotation.y = lm.yaw;

  const W = AMEEN_CENTER_SPEC.width; // 32m
  const D = AMEEN_CENTER_SPEC.depth; // 16m
  const hw = W * 0.5; // 16m
  const hd = D * 0.5; // 8m
  const fh = AMEEN_CENTER_SPEC.floorHeight; // 4.2m
  const totalH = AMEEN_CENTER_SPEC.floors * fh; // 12.6m
  const doorHalfW = AMEEN_CENTER_SPEC.doorHalfWidth; // 2.5m
  const wallT = 0.42;

  const wingTex = makeWingConcreteTexture(maxAnisotropy);
  const blueTex = makeBlueCladdingTexture(maxAnisotropy);
  disposables.push(wingTex, blueTex);

  const bluePortalMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: blueTex,
    roughness: 0.34,
    metalness: 0.22,
  });
  const creamWingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: wingTex,
    roughness: 0.62,
    metalness: 0.06,
  });
  const darkMullionMat = new THREE.MeshStandardMaterial({
    color: 0x22303d,
    roughness: 0.32,
    metalness: 0.65,
  });
  const curtainGlassMat = new THREE.MeshStandardMaterial({
    color: 0x62add8,
    emissive: 0x3b6c92,
    emissiveIntensity: 0.22,
    roughness: 0.12,
    metalness: 0.58,
    transparent: true,
    opacity: 0.52,
  });
  const interiorTileMat = new THREE.MeshStandardMaterial({
    color: 0xf4efe6,
    map: textures.mosqueTileMap,
    roughness: 0.38,
    metalness: 0.05,
  });
  const apartmentFloorMat = new THREE.MeshStandardMaterial({
    color: 0xd9c2a3,
    roughness: 0.68,
    metalness: 0.04,
  });
  const interiorWallMat = new THREE.MeshStandardMaterial({
    color: 0xf5f0e8,
    roughness: 0.78,
    metalness: 0.02,
  });
  const trimSteelMat = new THREE.MeshStandardMaterial({
    color: 0x687785,
    roughness: 0.36,
    metalness: 0.6,
  });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6d472b, roughness: 0.7, metalness: 0.04 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3b2617, roughness: 0.68, metalness: 0.06 });
  const glowWarmMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d4,
    emissive: 0xffd78c,
    emissiveIntensity: 0.85,
    roughness: 0.3,
  });

  disposables.push(
    bluePortalMat,
    creamWingMat,
    darkMullionMat,
    curtainGlassMat,
    interiorTileMat,
    apartmentFloorMat,
    interiorWallMat,
    trimSteelMat,
    woodMat,
    darkWoodMat,
    glowWarmMat
  );

  // =========================================================================
  // 1. FOUNDATION PLINTH, FLOOR SLABS & ROOFTOP PARAPET / TUBULAR RAILINGS
  // =========================================================================
  const plinthGeo = new THREE.BoxGeometry(W + 1.2, 1.8, D + 1.2);
  plinthGeo.translate(0, -0.78, 0);
  const fullSlabGeo = new THREE.BoxGeometry(W, 0.28, D);
  const f1SlabGeo = new THREE.BoxGeometry(W, 0.28, D);
  disposables.push(plinthGeo, fullSlabGeo, f1SlabGeo);

  const plinth = new THREE.Mesh(plinthGeo, darkMullionMat);
  plinth.receiveShadow = true;
  g.add(plinth);

  const groundSlab = new THREE.Mesh(fullSlabGeo, interiorTileMat);
  groundSlab.position.set(0, 0.0, 0);
  groundSlab.receiveShadow = true;
  g.add(groundSlab);

  // Floor 1 & Floor 2 Slabs + Floor 3 Rooftop Slab
  const floor1Slab = new THREE.Mesh(f1SlabGeo, interiorTileMat);
  floor1Slab.position.set(0, fh, 0);
  floor1Slab.receiveShadow = true;
  g.add(floor1Slab);

  const floor2Slab = new THREE.Mesh(fullSlabGeo, apartmentFloorMat);
  floor2Slab.position.set(0, fh * 2, 0);
  floor2Slab.receiveShadow = true;
  g.add(floor2Slab);

  const roofSlab = new THREE.Mesh(fullSlabGeo, creamWingMat);
  roofSlab.position.set(0, totalH, 0);
  roofSlab.castShadow = true;
  roofSlab.receiveShadow = true;
  g.add(roofSlab);

  // Rooftop concrete curb parapet + galvanized tubular metal safety railings matching reference image
  const parH = 0.62;
  const parFB = new THREE.BoxGeometry(W, parH, 0.34);
  const parLR = new THREE.BoxGeometry(0.34, parH, D);
  const railBarFB = new THREE.CylinderGeometry(0.035, 0.035, W - 0.6, 8);
  railBarFB.rotateZ(Math.PI / 2);
  const railBarLR = new THREE.CylinderGeometry(0.035, 0.035, D - 0.6, 8);
  railBarLR.rotateX(Math.PI / 2);
  const railPostGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.05, 8);
  disposables.push(parFB, parLR, railBarFB, railBarLR, railPostGeo);

  for (const sz of [-1, 1]) {
    const p = new THREE.Mesh(parFB, creamWingMat);
    p.position.set(0, totalH + parH * 0.5, sz * (hd - 0.17));
    g.add(p);
    for (const ry of [totalH + 0.92, totalH + 1.32]) {
      const bar = new THREE.Mesh(railBarFB, trimSteelMat);
      bar.position.set(0, ry, sz * (hd - 0.17));
      g.add(bar);
    }
    for (let rx = -hw + 1.0; rx <= hw - 1.0; rx += 3.0) {
      const post = new THREE.Mesh(railPostGeo, trimSteelMat);
      post.position.set(rx, totalH + 0.9, sz * (hd - 0.17));
      g.add(post);
    }
  }
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(parLR, creamWingMat);
    p.position.set(sx * (hw - 0.17), totalH + parH * 0.5, 0);
    g.add(p);
    for (const ry of [totalH + 0.92, totalH + 1.32]) {
      const bar = new THREE.Mesh(railBarLR, trimSteelMat);
      bar.position.set(sx * (hw - 0.17), ry, 0);
      g.add(bar);
    }
  }

  // Rooftop HVAC box + Stair penthouse + Black Water Tanks (matches reference roof skyline)
  const pentGeo = new THREE.BoxGeometry(6.2, 2.2, 4.4);
  const acUnitGeo = new THREE.BoxGeometry(0.95, 0.65, 0.42);
  const acFanGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 12);
  acFanGeo.rotateX(Math.PI / 2);
  const acMat = new THREE.MeshStandardMaterial({ color: 0xf0f2f4, roughness: 0.45 });
  const tankGeo = new THREE.CylinderGeometry(0.95, 0.95, 1.9, 12);
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.45 });
  disposables.push(pentGeo, acUnitGeo, acFanGeo, acMat, tankGeo, tankMat);

  const pent = new THREE.Mesh(pentGeo, creamWingMat);
  pent.position.set(-6.8, totalH + 1.1, -3.6);
  g.add(pent);

  for (const tx of [-12.5, -10.3]) {
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.set(tx, totalH + 0.95, -5.4);
    g.add(tank);
  }
  // Wall-mounted AC outdoor units on front right upper facade matching reference photo
  for (const ax of [9.6, 13.8]) {
    const ac = new THREE.Mesh(acUnitGeo, acMat);
    ac.position.set(ax, totalH - 0.72, hd + 0.22);
    const fan = new THREE.Mesh(acFanGeo, darkMullionMat);
    fan.position.set(ax - 0.12, totalH - 0.72, hd + 0.44);
    g.add(ac, fan);
  }

  // =========================================================================
  // 2. SOLID BACK WALL (-Z), LEFT (-X) & RIGHT (+X) FACADES + LEFT BLUE SIGN
  // =========================================================================
  const backWallGeo = new THREE.BoxGeometry(W, totalH, wallT);
  const sideWallGeo = new THREE.BoxGeometry(wallT, totalH, D);
  disposables.push(backWallGeo, sideWallGeo);

  const backWall = new THREE.Mesh(backWallGeo, creamWingMat);
  backWall.position.set(0, totalH * 0.5, -hd + wallT * 0.5);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  g.add(backWall);

  const leftWall = new THREE.Mesh(sideWallGeo, creamWingMat);
  leftWall.position.set(-hw + wallT * 0.5, totalH * 0.5, 0);
  leftWall.castShadow = true;
  g.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, creamWingMat);
  rightWall.position.set(hw - wallT * 0.5, totalH * 0.5, 0);
  rightWall.castShadow = true;
  g.add(rightWall);

  // Left-side blue corner block + "AMEEN CENTER" sign visible on left facade in reference photo
  const leftCornerBlueGeo = new THREE.BoxGeometry(0.28, totalH, 6.4);
  const leftSideSignGeo = new THREE.PlaneGeometry(5.6, 2.2);
  const leftSideSignTex = makeAmeenSignTexture('AMEEN CENTER', '#1174e0', '#ffffff', null, maxAnisotropy, 512, 180, 56);
  const leftSideSignMat = new THREE.MeshStandardMaterial({
    map: leftSideSignTex,
    emissive: 0xaad8ff,
    emissiveMap: leftSideSignTex,
    emissiveIntensity: 0.24,
    roughness: 0.35,
  });
  disposables.push(leftCornerBlueGeo, leftSideSignGeo, leftSideSignTex, leftSideSignMat);
  const leftCornerBlue = new THREE.Mesh(leftCornerBlueGeo, bluePortalMat);
  leftCornerBlue.position.set(-hw - 0.08, totalH * 0.5, hd - 4.2);
  const leftSideSign = new THREE.Mesh(leftSideSignGeo, leftSideSignMat);
  leftSideSign.rotation.y = -Math.PI / 2;
  leftSideSign.position.set(-hw - 0.24, totalH - 3.6, hd - 4.2);
  g.add(leftCornerBlue, leftSideSign);

  // =========================================================================
  // 3. EXACT FRONT FACADE (+Z): PROJECTING BLUE PORTAL, GLASS ATRIUM & WINGS
  // =========================================================================
  // Central Royal-Blue Frame (lx in [-5.8 .. +5.8], projects +0.75m proud of wings!)
  const bluePierGeo = new THREE.BoxGeometry(1.35, totalH + 0.55, 1.3);
  const blueTopCrownGeo = new THREE.BoxGeometry(11.6, 2.15, 1.35);
  const blueMidBeamGeo = new THREE.BoxGeometry(9.2, 1.25, 1.15);
  disposables.push(bluePierGeo, blueTopCrownGeo, blueMidBeamGeo);

  for (const sx of [-1, 1]) {
    const pier = new THREE.Mesh(bluePierGeo, bluePortalMat);
    pier.position.set(sx * 5.15, (totalH + 0.55) * 0.5, hd + 0.38);
    pier.castShadow = true;
    g.add(pier);
  }
  const topCrown = new THREE.Mesh(blueTopCrownGeo, bluePortalMat);
  topCrown.position.set(0, totalH - 0.65, hd + 0.38);
  topCrown.castShadow = true;
  g.add(topCrown);

  const midBeam = new THREE.Mesh(blueMidBeamGeo, bluePortalMat);
  midBeam.position.set(0, fh - 0.15, hd + 0.25);
  g.add(midBeam);

  // Main Roof Fascia & Entrance Beam "AMEEN CENTER" Illuminated Signboards
  const topSignTex = makeAmeenSignTexture('AMEEN CENTER', '#1174e0', '#ffffff', null, maxAnisotropy, 768, 160, 82);
  const topSignMat = new THREE.MeshStandardMaterial({
    map: topSignTex,
    emissive: 0x99d2ff,
    emissiveMap: topSignTex,
    emissiveIntensity: 0.3,
    roughness: 0.32,
  });
  const topSignGeo = new THREE.PlaneGeometry(10.6, 1.75);
  const lowSignGeo = new THREE.PlaneGeometry(8.4, 1.02);
  disposables.push(topSignTex, topSignMat, topSignGeo, lowSignGeo);

  const topSignMesh = new THREE.Mesh(topSignGeo, topSignMat);
  topSignMesh.position.set(0, totalH - 0.65, hd + 1.07);
  const lowSignMesh = new THREE.Mesh(lowSignGeo, topSignMat);
  lowSignMesh.position.set(0, fh - 0.15, hd + 0.84);
  g.add(topSignMesh, lowSignMesh);

  // Central 2-Storey Recessed Glass Curtain Atrium (Floors 1 & 2, lx in [-4.45..+4.45], y in [fh+0.45 .. totalH-1.7])
  const atriumGlassGeo = new THREE.PlaneGeometry(8.9, fh * 2 - 2.15);
  const atriumGlass = new THREE.Mesh(atriumGlassGeo, curtainGlassMat);
  atriumGlass.position.set(0, fh + 0.45 + (fh * 2 - 2.15) * 0.5, hd - 0.05);
  disposables.push(atriumGlassGeo);
  g.add(atriumGlass);

  // Horizontal & Vertical curtain-wall mullions across center atrium
  const vMullGeo = new THREE.BoxGeometry(0.11, fh * 2 - 2.15, 0.18);
  const hMullGeo = new THREE.BoxGeometry(8.95, 0.12, 0.18);
  disposables.push(vMullGeo, hMullGeo);
  for (let mx = -3.6; mx <= 3.6; mx += 1.8) {
    const vm = new THREE.Mesh(vMullGeo, darkMullionMat);
    vm.position.set(mx, fh + 0.45 + (fh * 2 - 2.15) * 0.5, hd);
    g.add(vm);
  }
  for (const my of [fh + 2.25, fh * 2, fh * 2 + 1.9]) {
    const hm = new THREE.Mesh(hMullGeo, darkMullionMat);
    hm.position.set(0, my, hd);
    g.add(hm);
  }

  // Left & Right Wings Upper Floors (lx in [-16 .. -5.8] & [+5.8 .. +16]):
  // Cream concrete floor spandrel bands + Wide Glass Window Ribbons on Floors 1 & 2!
  const spandrelGeo = new THREE.BoxGeometry(10.2, 0.92, wallT + 0.12);
  const cornerColGeo = new THREE.BoxGeometry(0.65, totalH, wallT + 0.14);
  const wingWinGlassGeo = new THREE.PlaneGeometry(9.4, fh - 1.0);
  const wingWinMullGeo = new THREE.BoxGeometry(0.11, fh - 0.95, 0.16);
  disposables.push(spandrelGeo, cornerColGeo, wingWinGlassGeo, wingWinMullGeo);

  for (const side of [-1, 1]) {
    const cx = side * 10.9; // center of 10.2m wing span
    // Outer wing corner pilaster
    const col = new THREE.Mesh(cornerColGeo, creamWingMat);
    col.position.set(side * (hw - 0.32), totalH * 0.5, hd - 0.18);
    g.add(col);

    // Cream concrete horizontal spandrel beams at floor levels
    for (const sy of [fh - 0.15, fh * 2 - 0.05, totalH - 0.32]) {
      const sp = new THREE.Mesh(spandrelGeo, creamWingMat);
      sp.position.set(cx, sy, hd - 0.18);
      g.add(sp);
    }

    // Large glass window ribbons for Floor 1 & Floor 2 on both wings
    for (const fy of [fh + 0.35 + (fh - 1.0) * 0.5, fh * 2 + 0.4 + (fh - 1.0) * 0.5]) {
      const wg = new THREE.Mesh(wingWinGlassGeo, curtainGlassMat);
      wg.position.set(cx, fy, hd - 0.18);
      g.add(wg);
      for (let mx = -3.6; mx <= 3.6; mx += 1.8) {
        const wm = new THREE.Mesh(wingWinMullGeo, darkMullionMat);
        wm.position.set(cx + mx, fy, hd - 0.12);
        g.add(wm);
      }
    }
  }

  // Wide Open Main Entrance Frame (|lx| < 2.5) + Animated Glass Double Doors
  const entTopGlassGeo = new THREE.PlaneGeometry(doorHalfW * 2, fh - 3.35);
  const entPierGeo = new THREE.BoxGeometry(1.9, 3.4, 0.38);
  disposables.push(entTopGlassGeo, entPierGeo);

  for (const sx of [-1, 1]) {
    const ep = new THREE.Mesh(entPierGeo, darkMullionMat);
    ep.position.set(sx * (doorHalfW + 0.95), 1.7, hd - 0.2);
    g.add(ep);
  }
  const entGlassHeader = new THREE.Mesh(entTopGlassGeo, curtainGlassMat);
  entGlassHeader.position.set(0, 3.35, hd - 0.2);
  g.add(entGlassHeader);

  // Hinged/pivoting Glass Entrance Door Leaf (swings open cleanly!)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-doorHalfW, 0.25, hd - 0.2);
  const doorLeafGeo = new THREE.BoxGeometry(doorHalfW * 0.96, 2.95, 0.08);
  doorLeafGeo.translate(doorHalfW * 0.48, 1.48, 0);
  const doorHandleGeo = new THREE.BoxGeometry(0.08, 0.52, 0.16);
  disposables.push(doorLeafGeo, doorHandleGeo);
  const doorMesh = new THREE.Mesh(doorLeafGeo, curtainGlassMat);
  const handleMesh = new THREE.Mesh(doorHandleGeo, trimSteelMat);
  handleMesh.position.set(doorHalfW * 0.85, 1.35, 0.06);
  doorPivot.add(doorMesh, handleMesh);
  g.add(doorPivot);

  // =========================================================================
  // 4. GROUND-FLOOR BRANDED SHOPS (Bata, oppo, SAMSUNG | vivo, realme, itel)
  // =========================================================================
  const shopFasciaGeo = new THREE.BoxGeometry(3.28, 0.86, 0.36);
  const shopGlassGeo = new THREE.PlaneGeometry(3.15, 2.75);
  const shopDisplayMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.shopfrontMap,
    emissive: 0xffd28a,
    emissiveMap: textures.shopfrontMap,
    emissiveIntensity: 0.32,
    roughness: 0.2,
    metalness: 0.35,
    transparent: true,
    opacity: 0.88,
  });
  const counterGeo = new THREE.BoxGeometry(2.6, 0.95, 0.72);
  disposables.push(shopFasciaGeo, shopGlassGeo, shopDisplayMat, counterGeo);

  for (const shop of AMEEN_GROUND_SHOPS) {
    const signTex = makeAmeenSignTexture(
      shop.brand,
      shop.bannerColor,
      shop.textColor,
      null,
      maxAnisotropy,
      320,
      96,
      shop.brand.length > 5 ? 48 : 58
    );
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0xffffff,
      emissiveMap: signTex,
      emissiveIntensity: 0.2,
      roughness: 0.35,
    });
    const fSideMat = new THREE.MeshStandardMaterial({ color: shop.bannerColor, roughness: 0.45 });
    disposables.push(signTex, signMat, fSideMat);

    // Exterior branded fascia signboard right above Ground Floor window band
    const fascia = new THREE.Mesh(shopFasciaGeo, [
      fSideMat, fSideMat, fSideMat, fSideMat, signMat, fSideMat,
    ]);
    fascia.position.set(shop.lxCenter, 3.55, hd + 0.05);
    g.add(fascia);

    // Exterior recessed glass storefront window (back-lit!)
    const winMesh = new THREE.Mesh(shopGlassGeo, shopDisplayMat);
    winMesh.position.set(shop.lxCenter, 1.55, hd - 0.14);
    g.add(winMesh);

    // Interior walkable shop counter & illuminated shelf behind glass
    const cnt = new THREE.Mesh(counterGeo, woodMat);
    cnt.position.set(shop.lxCenter, 0.62, 1.32);
    g.add(cnt);

    const interiorSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), signMat);
    interiorSign.position.set(shop.lxCenter, 2.75, 1.05);
    disposables.push(interiorSign.geometry);
    g.add(interiorSign);
  }

  // Interior Warm Ground Lobby Light Fixtures + Concierge Desk
  const concGeo = new THREE.BoxGeometry(3.2, 1.05, 0.9);
  const lampStripGeo = new THREE.BoxGeometry(2.8, 0.1, 0.45);
  disposables.push(concGeo, lampStripGeo);
  const concDesk = new THREE.Mesh(concGeo, darkWoodMat);
  concDesk.position.set(0, 0.66, -4.8);
  g.add(concDesk);
  for (const lz of [-2.0, 3.0]) {
    const ls = new THREE.Mesh(lampStripGeo, glowWarmMat);
    ls.position.set(0, fh - 0.18, lz);
    g.add(ls);
  }

  // =========================================================================
  // 5. WALKABLE 3D STAIRCASES / ESCALATORS & WORKING GLASS ELEVATOR
  // =========================================================================
  const { minX, maxX, zBottom, zTop } = AMEEN_CENTER_SPEC.stairBounds;
  const stairCenterX = (minX + maxX) * 0.5;
  const stairW = maxX - minX - 0.3;
  const stairSpanZ = zBottom - zTop; // 8.8m
  const stepCount = 16;
  const stepGeo = new THREE.BoxGeometry(stairW, 0.24, stairSpanZ / stepCount + 0.08);
  const railGeo = new THREE.BoxGeometry(0.12, 0.9, Math.hypot(stairSpanZ, fh));
  disposables.push(stepGeo, railGeo);

  // Build Flights for Floor 0->1, Floor 1->2, and Floor 2->Rooftop
  const stairAngle = Math.atan2(fh, stairSpanZ);
  for (let f = 0; f < AMEEN_CENTER_SPEC.floors; f++) {
    const fy = f * fh;
    for (let s = 0; s < stepCount; s++) {
      const frac = (s + 0.5) / stepCount;
      const step = new THREE.Mesh(stepGeo, trimSteelMat);
      step.position.set(stairCenterX, fy + frac * fh, zBottom - frac * stairSpanZ);
      g.add(step);
    }
    for (const sx of [minX + 0.15, maxX - 0.15]) {
      const rail = new THREE.Mesh(railGeo, darkMullionMat);
      rail.position.set(sx, fy + fh * 0.5 + 0.55, (zBottom + zTop) * 0.5);
      rail.rotation.x = stairAngle;
      g.add(rail);
    }
  }

  // Interactive Elevator Shaft & Moving Cabin at East Rear Corner (lx = 12.6, lz = -5.4)
  const elX = AMEEN_CENTER_SPEC.elevatorPos.lx;
  const elZ = AMEEN_CENTER_SPEC.elevatorPos.lz;
  const shaftGeo = new THREE.BoxGeometry(2.6, totalH, 2.6);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x3b4e5e,
    roughness: 0.22,
    metalness: 0.6,
    transparent: true,
    opacity: 0.34,
  });
  const cabFloorGeo = new THREE.BoxGeometry(2.2, 0.18, 2.2);
  const cabBackGeo = new THREE.BoxGeometry(2.2, 2.4, 0.12);
  const cabMat = new THREE.MeshStandardMaterial({ color: 0xc89d4c, roughness: 0.28, metalness: 0.72 });
  disposables.push(shaftGeo, shaftMat, cabFloorGeo, cabBackGeo, cabMat);

  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.set(elX, totalH * 0.5, elZ);
  g.add(shaft);

  const elevatorCabin = new THREE.Group();
  elevatorCabin.position.set(elX, 0.3, elZ);
  const cFloor = new THREE.Mesh(cabFloorGeo, cabMat);
  const cBack = new THREE.Mesh(cabBackGeo, cabMat);
  cBack.position.set(0, 1.25, -1.04);
  elevatorCabin.add(cFloor, cBack);
  g.add(elevatorCabin);

  // =========================================================================
  // 6. FLOOR 2 PERMANENT PRIVATE HOME APARTMENT (y = 2 * fh = 8.4m)
  // =========================================================================
  const aptY = fh * 2 + 0.14;
  const wallH = fh - 0.32;

  const addAptWall = (x1: number, x2: number, z1: number, z2: number) => {
    const w = x2 - x1;
    const d = z2 - z1;
    const wg = new THREE.BoxGeometry(w, wallH, d);
    disposables.push(wg);
    const m = new THREE.Mesh(wg, interiorWallMat);
    m.position.set((x1 + x2) * 0.5, aptY + wallH * 0.5, (z1 + z2) * 0.5);
    g.add(m);
  };

  // Partition walls matching FLOOR2_APARTMENT_COLLIDERS exact doorway gaps!
  addAptWall(-4.8, -0.8, 0.4, 0.72);
  addAptWall(1.5, 7.4, 0.4, 0.72);
  addAptWall(-5.05, -4.75, -7.5, 1.2);
  addAptWall(-5.05, -4.75, 3.4, 7.5);
  addAptWall(7.25, 7.55, -7.5, -3.4);
  addAptWall(7.25, 7.55, -1.4, 1.6);
  addAptWall(7.25, 7.55, 3.8, 7.5);
  addAptWall(7.4, 15.5, 0.75, 1.08);

  // --- Master Bedroom (lx: -4.6..+7.2, lz: -7.5..+0.4) ---
  // Master Bed (center lx = 1.75, lz = -5.4)
  const bedFrameMat = darkWoodMat;
  const mattressMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.88 });
  const blanketMat = new THREE.MeshStandardMaterial({ color: 0x1e4e79, roughness: 0.84 });
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xfff8eb, roughness: 0.9 });
  disposables.push(mattressMat, blanketMat, pillowMat);

  const bedGroup = new THREE.Group();
  bedGroup.position.set(AMEEN_BED_COORDS.mattressCenterLocal.lx, aptY, AMEEN_BED_COORDS.mattressCenterLocal.lz);
  const bedBaseG = new THREE.BoxGeometry(2.15, 0.34, 2.55);
  const bedHeadG = new THREE.BoxGeometry(2.22, 1.15, 0.16);
  const mattressG = new THREE.BoxGeometry(1.98, 0.24, 2.35);
  const blanketG = new THREE.BoxGeometry(2.02, 0.26, 1.55);
  const pillowG = new THREE.BoxGeometry(0.75, 0.14, 0.42);
  disposables.push(bedBaseG, bedHeadG, mattressG, blanketG, pillowG);

  const bedBase = new THREE.Mesh(bedBaseG, bedFrameMat);
  bedBase.position.y = 0.17;
  const bedHead = new THREE.Mesh(bedHeadG, bedFrameMat);
  bedHead.position.set(0, 0.58, -1.24);
  const mattress = new THREE.Mesh(mattressG, mattressMat);
  mattress.position.set(0, 0.42, 0);
  const blanket = new THREE.Mesh(blanketG, blanketMat);
  blanket.position.set(0, 0.44, 0.38);
  const pil1 = new THREE.Mesh(pillowG, pillowMat);
  pil1.position.set(-0.46, 0.58, -0.92);
  const pil2 = new THREE.Mesh(pillowG, pillowMat);
  pil2.position.set(0.46, 0.58, -0.92);
  bedGroup.add(bedBase, bedHead, mattress, blanket, pil1, pil2);
  g.add(bedGroup);

  // Wardrobe + Personal Storage Locker
  const wardG = new THREE.BoxGeometry(0.85, 2.25, 2.1);
  const lockG = new THREE.BoxGeometry(0.85, 1.55, 1.5);
  const lockMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.5 });
  disposables.push(wardG, lockG, lockMat);
  const wardrobe = new THREE.Mesh(wardG, woodMat);
  wardrobe.position.set(-4.1, aptY + 1.12, -3.5);
  const storage = new THREE.Mesh(lockG, lockMat);
  storage.position.set(-4.1, aptY + 0.78, -6.1);
  g.add(wardrobe, storage);

  // Computer Desk + Chair + Monitor
  const deskTopG = new THREE.BoxGeometry(1.1, 0.76, 2.4);
  const monScreenG = new THREE.BoxGeometry(0.08, 0.54, 0.92);
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.55,
    roughness: 0.2,
  });
  disposables.push(deskTopG, monScreenG, screenMat);
  const pcDesk = new THREE.Mesh(deskTopG, darkWoodMat);
  pcDesk.position.set(6.55, aptY + 0.38, -2.8);
  const pcMon = new THREE.Mesh(monScreenG, screenMat);
  pcMon.position.set(6.72, aptY + 1.12, -2.8);
  g.add(pcDesk, pcMon);

  // --- Living Room: Sofa + Rug + Coffee Table + Big Wall TV ---
  const sofaMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.85 });
  const rugMat = new THREE.MeshStandardMaterial({ color: 0x9b2c2c, roughness: 0.95 });
  const tvMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    emissive: 0x60a5fa,
    emissiveIntensity: 0.45,
    roughness: 0.18,
  });
  disposables.push(sofaMat, rugMat, tvMat);

  const rugG = new THREE.BoxGeometry(4.2, 0.03, 3.2);
  const sofaSeatG = new THREE.BoxGeometry(3.4, 0.48, 0.95);
  const sofaBackG = new THREE.BoxGeometry(3.4, 0.85, 0.25);
  const tvStandG = new THREE.BoxGeometry(2.8, 0.58, 0.52);
  const tvPanelG = new THREE.BoxGeometry(2.3, 1.28, 0.1);
  disposables.push(rugG, sofaSeatG, sofaBackG, tvStandG, tvPanelG);

  const rug = new THREE.Mesh(rugG, rugMat);
  rug.position.set(1.2, aptY + 0.02, 3.1);
  const sofaSeat = new THREE.Mesh(sofaSeatG, sofaMat);
  sofaSeat.position.set(1.2, aptY + 0.24, 5.05);
  const sofaBack = new THREE.Mesh(sofaBackG, sofaMat);
  sofaBack.position.set(1.2, aptY + 0.55, 5.42);
  const tvStand = new THREE.Mesh(tvStandG, darkWoodMat);
  tvStand.position.set(1.2, aptY + 0.29, 1.06);
  const tvPanel = new THREE.Mesh(tvPanelG, tvMat);
  tvPanel.position.set(1.2, aptY + 1.55, 0.85);
  g.add(rug, sofaSeat, sofaBack, tvStand, tvPanel);

  // --- Kitchen (lx: 7.6..15.5, lz: 1.1..7.5) ---
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.25 });
  const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.5 });
  disposables.push(marbleMat, fridgeMat);
  const kCounterG = new THREE.BoxGeometry(6.6, 0.95, 1.1);
  const kFridgeG = new THREE.BoxGeometry(1.1, 2.05, 1.1);
  const kIslandG = new THREE.BoxGeometry(2.2, 0.9, 1.0);
  disposables.push(kCounterG, kFridgeG, kIslandG);

  const kCounter = new THREE.Mesh(kCounterG, marbleMat);
  kCounter.position.set(12.0, aptY + 0.48, 6.85);
  const kFridge = new THREE.Mesh(kFridgeG, fridgeMat);
  kFridge.position.set(14.8, aptY + 1.02, 2.7);
  const kIsland = new THREE.Mesh(kIslandG, woodMat);
  kIsland.position.set(11.4, aptY + 0.45, 4.0);
  g.add(kCounter, kFridge, kIsland);

  // --- Bathroom (lx: 7.6..15.5, lz: -7.5..+0.7) ---
  const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18 });
  disposables.push(ceramicMat);
  const vanityG = new THREE.BoxGeometry(1.8, 0.85, 0.72);
  const showerFloorG = new THREE.BoxGeometry(1.8, 0.12, 1.8);
  const showerGlassG = new THREE.BoxGeometry(0.08, 2.1, 1.8);
  const toiletG = new THREE.BoxGeometry(0.56, 0.68, 0.72);
  disposables.push(vanityG, showerFloorG, showerGlassG, toiletG);

  const vanity = new THREE.Mesh(vanityG, ceramicMat);
  vanity.position.set(10.6, aptY + 0.42, -7.0);
  const shFloor = new THREE.Mesh(showerFloorG, marbleMat);
  shFloor.position.set(14.4, aptY + 0.06, -6.4);
  const shGlass = new THREE.Mesh(showerGlassG, curtainGlassMat);
  shGlass.position.set(13.45, aptY + 1.05, -6.4);
  const toilet = new THREE.Mesh(toiletG, ceramicMat);
  toilet.position.set(14.6, aptY + 0.34, -2.5);
  g.add(vanity, shFloor, shGlass, toilet);

  // --- Companion Tariq's Room / Corner (lx: -15.4..-5.1, lz: -7.5..+1.5) ---
  const compBlanketMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.85 });
  disposables.push(compBlanketMat);
  const compBedGroup = new THREE.Group();
  compBedGroup.position.set(AMEEN_BED_COORDS.companionBedLocal.lx, aptY, AMEEN_BED_COORDS.companionBedLocal.lz);
  const cBase = new THREE.Mesh(bedBaseG, darkWoodMat);
  cBase.position.y = 0.17;
  const cMatt = new THREE.Mesh(mattressG, mattressMat);
  cMatt.position.y = 0.42;
  const cBlanket = new THREE.Mesh(blanketG, compBlanketMat);
  cBlanket.position.set(0, 0.44, 0.38);
  const cPil = new THREE.Mesh(pillowG, pillowMat);
  cPil.position.set(0, 0.58, -0.92);
  compBedGroup.add(cBase, cMatt, cBlanket, cPil);
  g.add(compBedGroup);

  // Interior warm ceiling light glow discs on Floor 2 Apartment
  for (const [lx, lz] of [
    [1.2, -3.5],
    [1.2, 3.2],
    [11.4, 4.0],
    [-11.0, -3.0],
  ]) {
    const ls = new THREE.Mesh(lampStripGeo, glowWarmMat);
    ls.position.set(lx, aptY + wallH - 0.1, lz);
    g.add(ls);
  }

  // =========================================================================
  // 7. SURROUNDING SIDEWALK PLAZA, BLACK/WHITE CURB, HEDGES, TREES & CROSSWALK
  // =========================================================================
  // Paved sidewalk apron in front (+Z: 8..16.8m), top flush with Ground Floor tile at y = +0.14
  const apronGeo = new THREE.BoxGeometry(W + 6.0, 0.24, 8.8);
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.sidewalkMap,
    roughness: 0.82,
  });
  disposables.push(apronGeo, apronMat);
  const apron = new THREE.Mesh(apronGeo, apronMat);
  apron.position.set(0, 0.02, hd + 4.4);
  apron.receiveShadow = true;
  g.add(apron);

  // Black & White Alternating Curb Blocks along Sidewalk Edge & Reference Foreground Median Planters
  const curbGeo = new THREE.BoxGeometry(1.15, 0.24, 0.45);
  const curbBlackMat = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.78 });
  const curbWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.78 });
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.88 });
  const hedgeGeo = new THREE.BoxGeometry(8.5, 0.72, 1.35);
  disposables.push(curbGeo, curbBlackMat, curbWhiteMat, hedgeMat, hedgeGeo);

  for (let cx = -18.0, idx = 0; cx <= 18.0; cx += 1.2, idx++) {
    const curb = new THREE.Mesh(curbGeo, idx % 2 === 0 ? curbBlackMat : curbWhiteMat);
    curb.position.set(cx, 0.12, hd + 8.95);
    g.add(curb);
  }

  // Front Zebra Crossing stripes matching reference image right in front of Ameen Center plaza
  const zbGeo = new THREE.PlaneGeometry(11.0, 3.6);
  zbGeo.rotateX(-Math.PI / 2);
  const zbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.zebraCrossingMap,
    roughness: 0.8,
  });
  disposables.push(zbGeo, zbMat);
  const zbMesh = new THREE.Mesh(zbGeo, zbMat);
  zbMesh.position.set(0, 0.03, hd + 13.8);
  g.add(zbMesh);

  // Left & Right curbed median greenery planters (foreground of reference photo)
  for (const mx of [-12.5, 12.5]) {
    const hedge = new THREE.Mesh(hedgeGeo, hedgeMat);
    hedge.position.set(mx, 0.42, hd + 13.8);
    g.add(hedge);
    for (let kx = -4.2, idx = 0; kx <= 4.2; kx += 1.2, idx++) {
      const mc = new THREE.Mesh(curbGeo, idx % 2 === 0 ? curbBlackMat : curbWhiteMat);
      mc.position.set(mx + kx, 0.12, hd + 13.0);
      g.add(mc);
    }
  }

  // Metallic Roadside Streetlight Pole on Left Sidewalk & Wooden/Steel Utility Pole on Right Sidewalk + Shade Trees
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, roughness: 0.35, metalness: 0.65 });
  const stMastGeo = new THREE.CylinderGeometry(0.11, 0.16, 7.6, 8);
  const stArmGeo = new THREE.BoxGeometry(2.4, 0.14, 0.14);
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.32, 3.2, 8);
  const crownGeo = new THREE.IcosahedronGeometry(1.9, 1);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3b8c2a, roughness: 0.85 });
  disposables.push(poleMat, stMastGeo, stArmGeo, trunkGeo, crownGeo, trunkMat, leafMat);

  const stMast = new THREE.Mesh(stMastGeo, poleMat);
  stMast.position.set(-9.5, 3.8, hd + 8.6);
  const stArm = new THREE.Mesh(stArmGeo, poleMat);
  stArm.position.set(-8.4, 7.5, hd + 8.6);
  const stLamp = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.35), glowWarmMat);
  stLamp.position.set(-7.3, 7.45, hd + 8.6);
  disposables.push(stLamp.geometry);
  g.add(stMast, stArm, stLamp);

  const utPole = new THREE.Mesh(stMastGeo, poleMat);
  utPole.position.set(16.2, 3.8, hd + 8.5);
  g.add(utPole);

  for (const tx of [-19.5, 19.8]) {
    const tr = new THREE.Mesh(trunkGeo, trunkMat);
    tr.position.set(tx, 1.6, hd + 6.5);
    const cr = new THREE.Mesh(crownGeo, leafMat);
    cr.position.set(tx, 4.1, hd + 6.5);
    g.add(tr, cr);
  }

  scene.add(g);

  return {
    landmark: lm,
    group: g,
    doorPivot,
    doorOpenProgress: 0,
    targetDoorOpen: true, // Entrance doors open welcomingly!
    elevatorCabin,
    elevatorFloor: 0,
    targetFloor: 0,
    floorHeight: fh,
    baseY,
  };
}
