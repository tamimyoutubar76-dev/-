import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeColorTex(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function finalizeDataTex(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export interface ProceduralTexturePack {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  sidewalkMap: THREE.CanvasTexture;
  flyoverConcreteMap: THREE.CanvasTexture;
  zebraCrossingMap: THREE.CanvasTexture;
  barrierConcreteMap: THREE.CanvasTexture;
  metalGuardrailMap: THREE.CanvasTexture;
  shopfrontMap: THREE.CanvasTexture;
  facadeApartmentMap: THREE.CanvasTexture;
  facadeHillsideMap: THREE.CanvasTexture;
  tinRoofMap: THREE.CanvasTexture;
  mosqueTileMap: THREE.CanvasTexture;
  prayerCarpetMap: THREE.CanvasTexture;
  contactShadowTex: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTexturePack(maxAnisotropy: number): ProceduralTexturePack {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));

  // 1. High-clarity Bangladeshi Asphalt Road with fine aggregate, lane dashes, and curb edges
  const [asphC, asphCtx] = makeCanvas(512, 512);
  asphCtx.fillStyle = '#2a2e33';
  asphCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 34 + Math.floor(Math.random() * 26);
    asphCtx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    asphCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // Crisp dashed white center lane line
  asphCtx.fillStyle = 'rgba(242,240,232,0.92)';
  asphCtx.fillRect(250, 20, 12, 180);
  asphCtx.fillRect(250, 276, 12, 180);
  // Crisp yellow-white edge shoulder lines
  asphCtx.fillStyle = 'rgba(232,188,68,0.68)';
  asphCtx.fillRect(14, 0, 8, 512);
  asphCtx.fillRect(490, 0, 8, 512);
  const asphaltMap = finalizeColorTex(asphC, aniso, 1, 1);

  const [bumpC, bumpCtx] = makeCanvas(128, 128);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2000; i++) {
    const g = 90 + Math.floor(Math.random() * 75);
    bumpCtx.fillStyle = `rgb(${g},${g},${g})`;
    bumpCtx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const asphaltBump = finalizeDataTex(bumpC, aniso, 4, 4);

  // 2. Concrete Sidewalk Pavers
  const [swC, swCtx] = makeCanvas(128, 128);
  swCtx.fillStyle = '#aea89e';
  swCtx.fillRect(0, 0, 128, 128);
  swCtx.strokeStyle = '#7e7971';
  swCtx.lineWidth = 2;
  for (let y = 0; y <= 128; y += 32) {
    swCtx.beginPath();
    swCtx.moveTo(0, y);
    swCtx.lineTo(128, y);
    swCtx.stroke();
  }
  for (let x = 0; x <= 128; x += 32) {
    swCtx.beginPath();
    swCtx.moveTo(x, 0);
    swCtx.lineTo(x, 128);
    swCtx.stroke();
  }
  const sidewalkMap = finalizeColorTex(swC, aniso, 1, 1);

  // 3. Weathered Flyover Concrete
  const [flyC, flyCtx] = makeCanvas(256, 256);
  flyCtx.fillStyle = '#9b9890';
  flyCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const shade = 124 + Math.floor(Math.random() * 44);
    flyCtx.fillStyle = `rgba(${shade},${shade - 2},${shade - 6},0.35)`;
    flyCtx.fillRect(Math.random() * 256, Math.random() * 256, 4, 10);
  }
  flyCtx.fillStyle = 'rgba(55,58,62,0.22)';
  flyCtx.fillRect(0, 126, 256, 4);
  const flyoverConcreteMap = finalizeColorTex(flyC, aniso, 2, 2);

  // 3b. Zebra Crossing Stripes Texture
  const [zbC, zbCtx] = makeCanvas(256, 128);
  zbCtx.fillStyle = '#2a2e33';
  zbCtx.fillRect(0, 0, 256, 128);
  zbCtx.fillStyle = '#f4f2ea';
  for (let x = 10; x < 246; x += 32) {
    zbCtx.fillRect(x, 10, 18, 108);
  }
  const zebraCrossingMap = finalizeColorTex(zbC, aniso, 1, 1);

  // 3c. Concrete Jersey Divider with Yellow/Black Bangladeshi Curb Stripes
  const [bcC, bcCtx] = makeCanvas(256, 128);
  bcCtx.fillStyle = '#9aa0a6';
  bcCtx.fillRect(0, 0, 256, 92);
  for (let x = 0; x < 256; x += 32) {
    bcCtx.fillStyle = (x / 32) % 2 === 0 ? '#eab308' : '#1f2937';
    bcCtx.fillRect(x, 92, 32, 36);
  }
  const barrierConcreteMap = finalizeColorTex(bcC, aniso, 2, 1);

  // 3d. Low Jumpable Yellow-Black Steel Pedestrian Guardrail
  const [mgC, mgCtx] = makeCanvas(128, 64);
  for (let x = 0; x < 128; x += 16) {
    mgCtx.fillStyle = (x / 16) % 2 === 0 ? '#facc15' : '#18181b';
    mgCtx.fillRect(x, 0, 16, 64);
  }
  const metalGuardrailMap = finalizeColorTex(mgC, aniso, 2, 1);

  // 3e. Warm Backlit Bangladeshi Shopfront Glazing & Display Goods
  const [sfC, sfCtx] = makeCanvas(256, 256);
  sfCtx.fillStyle = '#232c36';
  sfCtx.fillRect(0, 0, 256, 256);
  const sGrad = sfCtx.createLinearGradient(0, 20, 0, 236);
  sGrad.addColorStop(0, '#ffe6a3');
  sGrad.addColorStop(0.55, '#f2b866');
  sGrad.addColorStop(1, '#8c5a2b');
  sfCtx.fillStyle = sGrad;
  sfCtx.fillRect(14, 18, 228, 220);
  // Display shelf bars & hanging goods silhouettes
  sfCtx.fillStyle = 'rgba(38, 28, 22, 0.55)';
  sfCtx.fillRect(14, 88, 228, 8);
  sfCtx.fillRect(14, 158, 228, 8);
  const itemColors = ['#dc2626', '#2563eb', '#16a34a', '#eab308', '#9333ea'];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      sfCtx.fillStyle = itemColors[(row * 6 + col) % itemColors.length];
      sfCtx.fillRect(24 + col * 36, 40 + row * 72, 24, 42);
    }
  }
  // Vertical aluminum mullion
  sfCtx.fillStyle = '#334155';
  sfCtx.fillRect(124, 12, 8, 232);
  const shopfrontMap = finalizeColorTex(sfC, aniso, 1, 1);

  // 4. Chattogram Apartment / Commercial Multi-Storey Facade (windows, AC units, balconies)
  const [facC, facCtx] = makeCanvas(256, 256);
  facCtx.fillStyle = '#e5ddd0';
  facCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    facCtx.fillStyle = 'rgba(110,104,95,0.08)';
    facCtx.fillRect(Math.random() * 256, 0, 3 + Math.random() * 5, 256);
  }
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const wx = 12 + col * 62;
      const wy = 14 + row * 62;
      facCtx.fillStyle = '#c8bfb0';
      facCtx.fillRect(wx - 4, wy + 34, 46, 7);
      facCtx.fillStyle = '#2d3b46';
      facCtx.fillRect(wx, wy, 38, 34);
      facCtx.fillStyle = '#4e6f84';
      facCtx.fillRect(wx + 3, wy + 3, 15, 28);
      facCtx.fillRect(wx + 20, wy + 3, 15, 28);
      facCtx.fillStyle = 'rgba(30,34,38,0.45)';
      for (let g = 8; g < 32; g += 7) {
        facCtx.fillRect(wx + 2, wy + g, 34, 1.5);
      }
    }
  }
  const facadeApartmentMap = finalizeColorTex(facC, aniso, 1, 1);

  // 5. Hillside Brick / Plaster Dwelling Facade (Motijharna / Tankir Pahar)
  const [hillC, hillCtx] = makeCanvas(256, 256);
  hillCtx.fillStyle = '#c87e62';
  hillCtx.fillRect(0, 0, 256, 256);
  hillCtx.strokeStyle = 'rgba(92,50,36,0.35)';
  hillCtx.lineWidth = 1.5;
  for (let y = 0; y < 256; y += 16) {
    hillCtx.beginPath();
    hillCtx.moveTo(0, y);
    hillCtx.lineTo(256, y);
    hillCtx.stroke();
    const off = (y / 16) % 2 === 0 ? 0 : 16;
    for (let x = off; x < 256; x += 32) {
      hillCtx.beginPath();
      hillCtx.moveTo(x, y);
      hillCtx.lineTo(x, y + 16);
      hillCtx.stroke();
    }
  }
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const wx = 22 + col * 80;
      const wy = 32 + row * 124;
      hillCtx.fillStyle = '#38464f';
      hillCtx.fillRect(wx, wy, 36, 46);
      hillCtx.fillStyle = '#5a736b';
      hillCtx.fillRect(wx + 3, wy + 3, 14, 40);
      hillCtx.fillRect(wx + 19, wy + 3, 14, 40);
    }
  }
  const facadeHillsideMap = finalizeColorTex(hillC, aniso, 1, 1);

  // 6. Corrugated Tin Roof (Bangladeshi Dheu Tin)
  const [tinC, tinCtx] = makeCanvas(128, 128);
  tinCtx.fillStyle = '#6f7e86';
  tinCtx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 8) {
    tinCtx.fillStyle = x % 16 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(20,25,30,0.22)';
    tinCtx.fillRect(x, 0, 4, 128);
  }
  for (let i = 0; i < 40; i++) {
    tinCtx.fillStyle = 'rgba(138,72,42,0.28)';
    tinCtx.fillRect(Math.random() * 128, Math.random() * 128, 10, 6);
  }
  const tinRoofMap = finalizeColorTex(tinC, aniso, 2, 2);

  // 7. Mosque Marble & Geometric Tile
  const [mosC, mosCtx] = makeCanvas(256, 256);
  mosCtx.fillStyle = '#f2efe6';
  mosCtx.fillRect(0, 0, 256, 256);
  mosCtx.strokeStyle = '#c8c1b0';
  mosCtx.lineWidth = 2;
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      mosCtx.strokeRect(x, y, 64, 64);
      mosCtx.fillStyle = 'rgba(22, 101, 74, 0.14)';
      mosCtx.beginPath();
      mosCtx.moveTo(x + 32, y + 10);
      mosCtx.lineTo(x + 54, y + 32);
      mosCtx.lineTo(x + 32, y + 54);
      mosCtx.lineTo(x + 10, y + 32);
      mosCtx.closePath();
      mosCtx.fill();
    }
  }
  const mosqueTileMap = finalizeColorTex(mosC, aniso, 3, 3);

  // 8. Mosque Prayer Carpet
  const [carC, carCtx] = makeCanvas(256, 256);
  carCtx.fillStyle = '#156046';
  carCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const px = col * 64 + 4;
      const py = row * 128 + 8;
      carCtx.strokeStyle = '#d4af37';
      carCtx.lineWidth = 2;
      carCtx.strokeRect(px, py, 56, 112);
      carCtx.beginPath();
      carCtx.moveTo(px + 10, py + 95);
      carCtx.lineTo(px + 10, py + 32);
      carCtx.quadraticCurveTo(px + 28, py + 8, px + 46, py + 32);
      carCtx.lineTo(px + 46, py + 95);
      carCtx.stroke();
    }
  }
  const prayerCarpetMap = finalizeColorTex(carC, aniso, 4, 3);

  // 9. Soft Radial Contact Shadow Disc
  const [shC, shCtx] = makeCanvas(128, 128);
  const grad = shCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(8, 10, 14, 0.72)');
  grad.addColorStop(0.6, 'rgba(8, 10, 14, 0.28)');
  grad.addColorStop(1, 'rgba(8, 10, 14, 0.0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadowTex = finalizeColorTex(shC, 1, 1, 1);

  return {
    asphaltMap,
    asphaltBump,
    sidewalkMap,
    flyoverConcreteMap,
    zebraCrossingMap,
    barrierConcreteMap,
    metalGuardrailMap,
    shopfrontMap,
    facadeApartmentMap,
    facadeHillsideMap,
    tinRoofMap,
    mosqueTileMap,
    prayerCarpetMap,
    contactShadowTex,
    dispose: () => {
      asphaltMap.dispose();
      asphaltBump.dispose();
      sidewalkMap.dispose();
      flyoverConcreteMap.dispose();
      zebraCrossingMap.dispose();
      barrierConcreteMap.dispose();
      metalGuardrailMap.dispose();
      shopfrontMap.dispose();
      facadeApartmentMap.dispose();
      facadeHillsideMap.dispose();
      tinRoofMap.dispose();
      mosqueTileMap.dispose();
      prayerCarpetMap.dispose();
      contactShadowTex.dispose();
    },
  };
}

/** Generate authentic Bengali + English signboard CanvasTexture */
export function createBengaliSignTexture(
  bengaliTitle: string,
  englishSub: string,
  bgColor: string,
  textColor: string,
  accentColor: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 160);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 148);

  ctx.fillStyle = accentColor;
  ctx.fillRect(10, 10, 492, 16);

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 40px "Noto Sans Bengali", "Outfit", sans-serif';
  ctx.fillText(bengaliTitle, 256, 72, 470);

  ctx.font = '600 22px "Outfit", sans-serif';
  ctx.fillStyle = accentColor === bgColor ? textColor : accentColor;
  ctx.fillText(englishSub, 256, 122, 470);

  return finalizeColorTex(c, Math.max(1, Math.min(8, maxAnisotropy)), 1, 1);
}
