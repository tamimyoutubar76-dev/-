import * as THREE from 'three';
import {
  CHARACTER_BODY_PROPORTIONS as P,
  CHARACTER_REF_CROPS as CROPS,
  CHARACTER_REF_IMAGE_URL,
  RefCropRect,
} from '../sim/characterReference';

export interface ProtagonistRig {
  group: THREE.Group;
  bodyRoot: THREE.Group;
  headGroup: THREE.Group;
  torsoGroup: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  lowerLegL: THREE.Group;
  lowerLegR: THREE.Group;
}

export interface ProtagonistAnimState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  yawRate: number;
  moveSpeed: number;
  isRunning: boolean;
  grounded: boolean;
  vy: number;
  walkPhase: number;
  squashScaleY: number;
  elapsed: number;
  isSitting: boolean;
  lieAmount?: number;
}

interface TextureSlot {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  crop?: RefCropRect;
  floodMode?: 'all_borders' | 'upper_only' | 'none';
  patchRightForearm?: boolean;
  mirrorX?: boolean;
  hairCrownTile?: boolean;
  fallbackFill: string;
}

function makeTexSlot(
  w: number,
  h: number,
  aniso: number,
  disposables: { dispose: () => void }[],
  drawFallback: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: {
    crop?: RefCropRect;
    floodMode?: 'all_borders' | 'upper_only' | 'none';
    patchRightForearm?: boolean;
    mirrorX?: boolean;
    hairCrownTile?: boolean;
    fallbackFill?: string;
  } = {}
): TextureSlot {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  drawFallback(ctx, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = Math.max(1, Math.min(8, aniso));
  tex.needsUpdate = true;
  disposables.push(tex);

  return {
    canvas,
    ctx,
    tex,
    crop: opts.crop,
    floodMode: opts.floodMode ?? 'all_borders',
    patchRightForearm: opts.patchRightForearm ?? false,
    mirrorX: opts.mirrorX ?? false,
    hairCrownTile: opts.hairCrownTile ?? false,
    fallbackFill: opts.fallbackFill ?? '#14161b',
  };
}

function removeExteriorWhiteAndSmear(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: 'all_borders' | 'upper_only' | 'none',
  fallbackFill: string
) {
  if (mode === 'none') return;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const n = w * h;
  const isWhiteBg = new Uint8Array(n);
  const visited = new Uint8Array(n);

  const checkWhite = (idx: number): boolean => {
    const o = idx * 4;
    const r = d[o];
    const g = d[o + 1];
    const b = d[o + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    return mn >= 224 && mx - mn <= 24;
  };

  for (let i = 0; i < n; i++) {
    if (checkWhite(i)) isWhiteBg[i] = 1;
  }

  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const push = (idx: number) => {
    if (!visited[idx] && isWhiteBg[idx]) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };

  const sideLimitY = mode === 'upper_only' ? Math.floor(h * 0.56) : h;
  for (let x = 0; x < w; x++) {
    push(x); // top border
    if (mode === 'all_borders') {
      push((h - 1) * w + x); // bottom border
    }
  }
  for (let y = 0; y < sideLimitY; y++) {
    push(y * w);
    push(y * w + (w - 1));
  }

  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % w;
    const cy = (cur - cx) / w;
    if (cx > 0) push(cur - 1);
    if (cx < w - 1) push(cur + 1);
    if (cy > 0) push(cur - w);
    if (cy < h - 1 && (mode === 'all_borders' || cy < sideLimitY)) push(cur + w);
  }

  // Dilate 1px border halo to eliminate bright anti-aliased fringe pixels
  const halo = new Uint8Array(visited);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx]) continue;
      const o = idx * 4;
      const lum = (d[o] + d[o + 1] + d[o + 2]) / 3;
      if (lum > 185 && (mode === 'all_borders' || y < sideLimitY)) {
        const adj =
          (x > 0 && visited[idx - 1]) ||
          (x < w - 1 && visited[idx + 1]) ||
          (y > 0 && visited[idx - w]) ||
          (y < h - 1 && visited[idx + w]);
        if (adj) halo[idx] = 1;
      }
    }
  }

  // Parse fallback color
  const fb = new THREE.Color(fallbackFill);
  const fbR = Math.round(fb.r * 255);
  const fbG = Math.round(fb.g * 255);
  const fbB = Math.round(fb.b * 255);

  // Horizontal smear inward/outward from nearest foreground pixel per row, then vertical pass if row is empty
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let lastFg = -1;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      if (!halo[idx]) {
        if (lastFg === -1 && x > 0) {
          // Fill leading bg pixels on left with first foreground pixel
          const fo = idx * 4;
          for (let px = 0; px < x; px++) {
            const po = (row + px) * 4;
            d[po] = d[fo];
            d[po + 1] = d[fo + 1];
            d[po + 2] = d[fo + 2];
          }
        }
        lastFg = idx;
      } else if (lastFg !== -1) {
        const fo = lastFg * 4;
        const po = idx * 4;
        d[po] = d[fo];
        d[po + 1] = d[fo + 1];
        d[po + 2] = d[fo + 2];
      }
    }
    if (lastFg === -1) {
      for (let x = 0; x < w; x++) {
        const po = (row + x) * 4;
        d[po] = fbR;
        d[po + 1] = fbG;
        d[po + 2] = fbB;
      }
    }
  }

  // Fill top-empty rows from first populated row below
  for (let x = 0; x < w; x++) {
    let firstValidY = -1;
    for (let y = 0; y < h; y++) {
      if (!halo[y * w + x]) {
        firstValidY = y;
        break;
      }
    }
    if (firstValidY > 0) {
      const srcO = (firstValidY * w + x) * 4;
      for (let y = 0; y < firstValidY; y++) {
        const dstO = (y * w + x) * 4;
        d[dstO] = d[srcO];
        d[dstO + 1] = d[srcO + 1];
        d[dstO + 2] = d[srcO + 2];
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// Procedural synchronous fallbacks matching the exact AC Milan bwin kit & custom friend look
function drawFallbackHair(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#201612';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 240; i++) {
    const shade = 26 + ((i * 19) % 34);
    ctx.fillStyle = `rgb(${shade + 10},${shade + 2},${shade - 2})`;
    ctx.fillRect((i * 37) % w, (i * 53) % h, 6, 8);
  }
}

function drawFallbackSkin(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f2aa78';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(185,105,58,0.2)';
  ctx.fillRect(0, 0, w * 0.08, h);
  ctx.fillRect(w * 0.92, 0, w * 0.08, h);
}

function drawFallbackFaceFront(ctx: CanvasRenderingContext2D, w: number, h: number) {
  drawFallbackSkin(ctx, w, h);
  // Dark brown side-swept tousled hair crown
  drawFallbackHair(ctx, w, Math.round(h * 0.36));
  // Eyebrows
  ctx.fillStyle = '#1f1612';
  ctx.fillRect(w * 0.21, h * 0.42, w * 0.2, h * 0.038);
  ctx.fillRect(w * 0.59, h * 0.42, w * 0.2, h * 0.038);
  // Eyes
  ctx.fillStyle = '#f5f2ed';
  ctx.fillRect(w * 0.23, h * 0.48, w * 0.15, h * 0.055);
  ctx.fillRect(w * 0.62, h * 0.48, w * 0.15, h * 0.055);
  ctx.fillStyle = '#241711';
  ctx.fillRect(w * 0.28, h * 0.485, w * 0.065, h * 0.05);
  ctx.fillRect(w * 0.67, h * 0.485, w * 0.065, h * 0.05);
  // Nose & clean-shaven lips
  ctx.fillStyle = '#d38457';
  ctx.fillRect(w * 0.45, h * 0.56, w * 0.1, h * 0.15);
  ctx.fillStyle = '#be7060';
  ctx.fillRect(w * 0.39, h * 0.78, w * 0.22, h * 0.05);
}

function drawFallbackJerseyFront(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#14151a';
  ctx.fillRect(0, 0, w, h);
  // Diagonal subtle dark weave
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 4;
  for (let i = -h; i < w + h; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, h);
    ctx.lineTo(i + h * 0.65, 0);
    ctx.stroke();
  }
  // Red AC Milan shoulder arcs
  ctx.strokeStyle = '#dc1e35';
  ctx.lineWidth = Math.max(8, w * 0.055);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.26);
  ctx.quadraticCurveTo(w * 0.22, h * 0.12, w * 0.34, 0);
  ctx.moveTo(w, h * 0.26);
  ctx.quadraticCurveTo(w * 0.78, h * 0.12, w * 0.66, 0);
  ctx.stroke();

  // White round crew collar
  ctx.strokeStyle = '#f5f5f5';
  ctx.lineWidth = Math.max(5, w * 0.035);
  ctx.beginPath();
  ctx.arc(w * 0.5, 0, w * 0.16, 0.1, Math.PI - 0.1);
  ctx.stroke();

  // Champions League badge (viewer left) + AC Milan crest (viewer right)
  ctx.fillStyle = '#e5b83b';
  ctx.beginPath();
  ctx.arc(w * 0.25, h * 0.34, w * 0.065, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#cc1b2c';
  ctx.beginPath();
  ctx.ellipse(w * 0.75, h * 0.34, w * 0.065, h * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f5f5f5';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Center bwin sponsor
  ctx.fillStyle = '#f5f5f5';
  ctx.font = `bold ${Math.round(h * 0.18)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('bwin', w * 0.5, h * 0.61);
}

function drawFallbackJerseyBack(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#14151a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(w * 0.28, 0, w * 0.44, h * 0.045);
  ctx.strokeStyle = '#dc1e35';
  ctx.lineWidth = Math.max(8, w * 0.055);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.28);
  ctx.quadraticCurveTo(w * 0.22, h * 0.12, w * 0.3, 0);
  ctx.moveTo(w, h * 0.28);
  ctx.quadraticCurveTo(w * 0.78, h * 0.12, w * 0.7, 0);
  ctx.stroke();
}

function drawFallbackArm(ctx: CanvasRenderingContext2D, w: number, h: number, hasWatch: boolean) {
  ctx.fillStyle = '#14151a';
  ctx.fillRect(0, 0, w, Math.round(h * 0.48));
  // Red & white Adidas sleeve stripes
  ctx.fillStyle = '#dc1e35';
  ctx.fillRect(w * 0.22, 0, w * 0.16, Math.round(h * 0.42));
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(w * 0.44, 0, w * 0.12, Math.round(h * 0.42));
  ctx.fillStyle = '#dc1e35';
  ctx.fillRect(w * 0.62, 0, w * 0.16, Math.round(h * 0.42));
  // Skin forearm & hand
  ctx.fillStyle = '#f2aa78';
  ctx.fillRect(0, Math.round(h * 0.48), w, Math.ceil(h * 0.52));
  if (hasWatch) {
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, Math.round(h * 0.80), w, Math.round(h * 0.08));
  }
}

function drawFallbackTrouser(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  variant: 'leftFront' | 'rightFront' | 'side' | 'back'
) {
  ctx.fillStyle = '#131418';
  ctx.fillRect(0, 0, w, h);
  if (variant === 'side') {
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(w * 0.36, 0, w * 0.06, h);
    ctx.fillRect(w * 0.47, 0, w * 0.06, h);
    ctx.fillRect(w * 0.58, 0, w * 0.06, h);
  } else if (variant === 'leftFront') {
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(w * 0.46, h * 0.25, w * 0.28, h * 0.1);
  }
}

function drawFallbackShoe(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#14161b';
  ctx.fillRect(0, 0, w, h);
  // White tongue/lace accent
  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(w * 0.28, h * 0.06, w * 0.44, h * 0.18);
  // Chunky white midsole + black outsole
  ctx.fillStyle = '#f5f5f3';
  ctx.fillRect(0, Math.round(h * 0.60), w, Math.round(h * 0.31));
  ctx.fillStyle = '#0e1014';
  ctx.fillRect(0, Math.round(h * 0.91), w, Math.ceil(h * 0.09));
}

function buildBoxFaceMaterials(
  slots: [TextureSlot, TextureSlot, TextureSlot, TextureSlot, TextureSlot, TextureSlot],
  roughness: number,
  metalness: number,
  disposables: { dispose: () => void }[]
): THREE.MeshStandardMaterial[] {
  return slots.map((s) => {
    const mat = new THREE.MeshStandardMaterial({
      map: s.tex,
      roughness,
      metalness,
    });
    disposables.push(mat);
    return mat;
  });
}

function loadReferenceSheetIntoSlots(slots: TextureSlot[]) {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    for (const slot of slots) {
      if (!slot.crop) continue;
      const { canvas, ctx, tex, crop, floodMode, patchRightForearm, mirrorX, hairCrownTile, fallbackFill } =
        slot;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (hairCrownTile) {
        // Tile central spiky curly black hair swatch cleanly across head top (+Y)
        const sx = crop.x;
        const sy = crop.y;
        const sw = crop.w;
        const sh = crop.h;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h * 0.55);
        ctx.save();
        ctx.translate(0, h);
        ctx.scale(1, -1);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h * 0.55);
        ctx.restore();
        // Rich dark espresso-brown tint compensates for overhead sky/directional light hitting +Y cube face
        ctx.fillStyle = 'rgba(20, 12, 9, 0.78)';
        ctx.fillRect(0, 0, w, h);
        tex.needsUpdate = true;
        continue;
      }

      if (mirrorX) {
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
      }

      if (patchRightForearm) {
        // View 3 has a wristwatch band around yFrac 0.85..0.91 while Front/Back show bare right forearm
        const srcY = Math.round(h * 0.72);
        const srcH = Math.max(4, Math.round(h * 0.09));
        const dstY = Math.round(h * 0.81);
        const dstH = Math.round(h * 0.14);
        ctx.drawImage(canvas, 0, srcY, w, srcH, 0, dstY, w, dstH);
      }

      removeExteriorWhiteAndSmear(ctx, w, h, floodMode ?? 'all_borders', fallbackFill);
      tex.needsUpdate = true;
    }
  };
  img.src = CHARACTER_REF_IMAGE_URL;
}

export function createProtagonistMesh(
  contactShadowTex: THREE.Texture,
  maxAnisotropy: number,
  disposables: { dispose: () => void }[]
): ProtagonistRig {
  const slots: TextureSlot[] = [];
  const reg = (s: TextureSlot) => {
    slots.push(s);
    return s;
  };

  const root = new THREE.Group();
  const bodyRoot = new THREE.Group();
  root.add(bodyRoot);

  // Contact shadow disc grounded under shoes
  const shGeo = new THREE.CircleGeometry(0.62, 16);
  shGeo.rotateX(-Math.PI / 2);
  const shMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.48,
  });
  disposables.push(shGeo, shMat);
  const shMesh = new THREE.Mesh(shGeo, shMat);
  shMesh.position.y = 0.02;
  root.add(shMesh);

  // ---------------------------------------------------------------------------
  // 1. UPPER BODY PIVOT (TORSO + NECK/HEAD + ARMS) AT HIP Y = 0.66m
  // ---------------------------------------------------------------------------
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, P.hipY, 0);
  bodyRoot.add(torsoGroup);

  const torsoGeo = new THREE.BoxGeometry(P.torsoWidth, P.torsoHeight, P.torsoDepth);
  disposables.push(torsoGeo);
  const torsoSide = reg(makeTexSlot(128, 256, maxAnisotropy, disposables, (c, w, h) => { c.fillStyle = '#121318'; c.fillRect(0, 0, w, h); }, { crop: CROPS.torsoSidePattern, floodMode: 'none', fallbackFill: '#121318' }));
  const torsoFront = reg(makeTexSlot(256, 256, maxAnisotropy, disposables, drawFallbackJerseyFront, { crop: CROPS.torsoFront, fallbackFill: '#121318' }));
  const torsoBack = reg(makeTexSlot(256, 256, maxAnisotropy, disposables, drawFallbackJerseyBack, { crop: CROPS.torsoBack, fallbackFill: '#121318' }));
  const torsoMesh = new THREE.Mesh(
    torsoGeo,
    buildBoxFaceMaterials([torsoSide, torsoSide, torsoSide, torsoSide, torsoFront, torsoBack], 0.74, 0.06, disposables)
  );
  torsoMesh.position.set(0, P.torsoHeight * 0.5, 0);
  torsoMesh.castShadow = true;
  torsoGroup.add(torsoMesh);

  // ---------------------------------------------------------------------------
  // 2. CUBE-SHAPED HEAD + PROTRUDING 3D EARS + NECK CONNECTOR
  // ---------------------------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.position.set(0, P.torsoHeight, 0);
  torsoGroup.add(headGroup);

  const headGeo = new THREE.BoxGeometry(P.headWidth, P.headHeight, P.headDepth);
  disposables.push(headGeo);
  const headLeft = reg(makeTexSlot(256, 256, maxAnisotropy, disposables, drawFallbackFaceFront, { crop: CROPS.headLeft, fallbackFill: '#1a1a1d' }));
  const headRight = reg(makeTexSlot(256, 256, maxAnisotropy, disposables, drawFallbackFaceFront, { crop: CROPS.headRight, fallbackFill: '#1a1a1d' }));
  const headTop = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, drawFallbackHair, { crop: CROPS.headTop, hairCrownTile: true, floodMode: 'none', fallbackFill: '#16171b' }));
  const headBottom = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, drawFallbackSkin, { crop: CROPS.headBottom, fallbackFill: '#e89864' }));
  const headFront = reg(makeTexSlot(256, 256, maxAnisotropy, disposables, drawFallbackFaceFront, { crop: CROPS.headFront, fallbackFill: '#1a1a1d' }));
  const headBack = reg(makeTexSlot(256, 256, maxAnisotropy, disposables, drawFallbackHair, { crop: CROPS.headBack, fallbackFill: '#18181c' }));

  const headMats = buildBoxFaceMaterials(
    [headLeft, headRight, headTop, headBottom, headFront, headBack],
    0.72,
    0.02,
    disposables
  );
  headMats[2].roughness = 0.94;
  headMats[2].metalness = 0.0;
  const headCube = new THREE.Mesh(headGeo, headMats);
  headCube.position.set(0, P.headHeight * 0.5, 0);
  headCube.castShadow = true;
  headGroup.add(headCube);

  // Neck joint plug (prevents gap during head tilt/nod)
  const neckGeo = new THREE.BoxGeometry(0.18, 0.08, 0.16);
  const neckSlot = reg(makeTexSlot(64, 64, maxAnisotropy, disposables, drawFallbackSkin, { crop: CROPS.headBottom, fallbackFill: '#e59662' }));
  const neckMat = new THREE.MeshStandardMaterial({ map: neckSlot.tex, roughness: 0.72 });
  disposables.push(neckGeo, neckMat);
  const neckMesh = new THREE.Mesh(neckGeo, neckMat);
  neckMesh.position.set(0, -0.02, 0);
  headGroup.add(neckMesh);

  // Protruding 3D Left & Right Ears
  const earGeo = new THREE.BoxGeometry(0.036, 0.132, 0.08);
  disposables.push(earGeo);
  const earLFront = reg(makeTexSlot(64, 96, maxAnisotropy, disposables, drawFallbackSkin, { crop: CROPS.earLeftFront, fallbackFill: '#e4925e' }));
  const earLBack = reg(makeTexSlot(64, 96, maxAnisotropy, disposables, drawFallbackSkin, { crop: CROPS.earLeftBack, fallbackFill: '#e4925e' }));
  const earLSide = reg(makeTexSlot(96, 96, maxAnisotropy, disposables, drawFallbackSkin, { crop: CROPS.earLeftSide, fallbackFill: '#e4925e' }));
  const earL = new THREE.Mesh(
    earGeo,
    buildBoxFaceMaterials([earLSide, earLSide, earLSide, earLSide, earLFront, earLBack], 0.7, 0.02, disposables)
  );
  earL.position.set(P.headWidth * 0.5 + 0.012, 0.205, -0.02);
  headGroup.add(earL);

  const earRFront = reg(makeTexSlot(64, 96, maxAnisotropy, disposables, drawFallbackSkin, { crop: CROPS.earRightFront, fallbackFill: '#e4925e' }));
  const earRBack = reg(makeTexSlot(64, 96, maxAnisotropy, disposables, drawFallbackSkin, { crop: CROPS.earRightBack, fallbackFill: '#e4925e' }));
  const earRSide = reg(makeTexSlot(96, 96, maxAnisotropy, disposables, drawFallbackSkin, { crop: CROPS.earRightSide, fallbackFill: '#e4925e' }));
  const earR = new THREE.Mesh(
    earGeo,
    buildBoxFaceMaterials([earRSide, earRSide, earRSide, earRSide, earRFront, earRBack], 0.7, 0.02, disposables)
  );
  earR.position.set(-(P.headWidth * 0.5 + 0.012), 0.205, -0.02);
  headGroup.add(earR);

  // ---------------------------------------------------------------------------
  // 3. RECTANGULAR BLOCK ARMS + 3D GOLD WRISTWATCH ON LEFT WRIST
  // ---------------------------------------------------------------------------
  const armGeo = new THREE.BoxGeometry(P.armWidth, P.armHeight, P.armDepth);
  armGeo.translate(0, -0.27, 0); // shoulder pivot near top (top=+0.03, bottom=-0.57)
  disposables.push(armGeo);

  const armL = new THREE.Group();
  armL.position.set(P.torsoWidth * 0.5 + P.armWidth * 0.5 + 0.005, P.shoulderY - P.hipY, 0);
  torsoGroup.add(armL);

  const armLFront = reg(makeTexSlot(128, 256, maxAnisotropy, disposables, (c, w, h) => drawFallbackArm(c, w, h, true), { crop: CROPS.armLeftFront, fallbackFill: '#14151a' }));
  const armLBack = reg(makeTexSlot(128, 256, maxAnisotropy, disposables, (c, w, h) => drawFallbackArm(c, w, h, true), { crop: CROPS.armLeftBack, fallbackFill: '#14151a' }));
  const armLOuter = reg(makeTexSlot(128, 256, maxAnisotropy, disposables, (c, w, h) => drawFallbackArm(c, w, h, true), { crop: CROPS.armLeftSide, fallbackFill: '#14151a' }));
  const armLInner = reg(makeTexSlot(128, 256, maxAnisotropy, disposables, (c, w, h) => drawFallbackArm(c, w, h, false), { crop: CROPS.armRightBack, fallbackFill: '#14151a' }));
  const armLSolidDark = reg(makeTexSlot(64, 64, maxAnisotropy, disposables, (c, w, h) => { c.fillStyle = '#14151a'; c.fillRect(0, 0, w, h); }, { crop: CROPS.torsoSidePattern, floodMode: 'none' }));
  const armLSkinBot = reg(makeTexSlot(64, 64, maxAnisotropy, disposables, drawFallbackSkin, { crop: CROPS.headBottom, fallbackFill: '#f2aa78' }));

  const armLMesh = new THREE.Mesh(
    armGeo,
    buildBoxFaceMaterials([armLOuter, armLInner, armLSolidDark, armLSkinBot, armLFront, armLBack], 0.72, 0.05, disposables)
  );
  armLMesh.castShadow = true;
  armL.add(armLMesh);

  // 3D Solid Gold Link Wristwatch on Left Arm (+X) matching reference image
  const watchGroup = new THREE.Group();
  watchGroup.position.set(0, -0.495, 0);
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xebc044, roughness: 0.26, metalness: 0.88 });
  const dialMat = new THREE.MeshStandardMaterial({ color: 0x111419, roughness: 0.2, metalness: 0.5 });
  const strapGeo = new THREE.BoxGeometry(P.armWidth + 0.012, 0.044, P.armDepth + 0.012);
  const bezelGeo = new THREE.CylinderGeometry(0.056, 0.056, 0.018, 18);
  bezelGeo.rotateZ(Math.PI / 2);
  const faceGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.021, 16);
  faceGeo.rotateZ(Math.PI / 2);
  disposables.push(goldMat, dialMat, strapGeo, bezelGeo, faceGeo);

  const strapMesh = new THREE.Mesh(strapGeo, goldMat);
  const bezelMesh = new THREE.Mesh(bezelGeo, goldMat);
  bezelMesh.position.set(P.armWidth * 0.5 + 0.008, 0, 0);
  const dialMesh = new THREE.Mesh(faceGeo, dialMat);
  dialMesh.position.set(P.armWidth * 0.5 + 0.009, 0, 0);
  watchGroup.add(strapMesh, bezelMesh, dialMesh);
  armL.add(watchGroup);

  // Right Arm (-X, no watch)
  const armR = new THREE.Group();
  armR.position.set(-(P.torsoWidth * 0.5 + P.armWidth * 0.5 + 0.005), P.shoulderY - P.hipY, 0);
  torsoGroup.add(armR);

  const armRFront = reg(makeTexSlot(128, 256, maxAnisotropy, disposables, (c, w, h) => drawFallbackArm(c, w, h, false), { crop: CROPS.armRightFront, fallbackFill: '#121318' }));
  const armRBack = reg(makeTexSlot(128, 256, maxAnisotropy, disposables, (c, w, h) => drawFallbackArm(c, w, h, false), { crop: CROPS.armRightBack, fallbackFill: '#121318' }));
  const armROuter = reg(makeTexSlot(128, 256, maxAnisotropy, disposables, (c, w, h) => drawFallbackArm(c, w, h, false), { crop: CROPS.armRightSide, patchRightForearm: true, fallbackFill: '#121318' }));
  const armRMesh = new THREE.Mesh(
    armGeo,
    buildBoxFaceMaterials([armLInner, armROuter, armLSolidDark, armLSkinBot, armRFront, armRBack], 0.72, 0.05, disposables)
  );
  armRMesh.castShadow = true;
  armR.add(armRMesh);

  // ---------------------------------------------------------------------------
  // 4. SEPARATE ARTICULATED RECTANGULAR LEGS + CHECKERED BLOCK SNEAKERS
  // ---------------------------------------------------------------------------
  const thighGeo = new THREE.BoxGeometry(P.thighWidth, P.thighHeight, P.thighDepth);
  thighGeo.translate(0, -P.thighHeight * 0.5, 0);
  const shinGeo = new THREE.BoxGeometry(P.shinWidth, P.shinHeight, P.shinDepth);
  shinGeo.translate(0, -P.shinHeight * 0.5, 0);
  const shoeGeo = new THREE.BoxGeometry(P.shoeWidth, P.shoeHeight, P.shoeDepth);
  shoeGeo.translate(0, -P.shinHeight - P.shoeHeight * 0.5, P.shoeForwardOffsetZ);
  disposables.push(thighGeo, shinGeo, shoeGeo);

  const trouserSolid = reg(makeTexSlot(64, 64, maxAnisotropy, disposables, (c, w, h) => { c.fillStyle = '#111318'; c.fillRect(0, 0, w, h); }, { crop: CROPS.torsoSidePattern, floodMode: 'none' }));
  const soleSolid = reg(makeTexSlot(64, 64, maxAnisotropy, disposables, (c, w, h) => { c.fillStyle = '#0e1014'; c.fillRect(0, 0, w, h); }, { floodMode: 'none' }));

  // LEFT LEG (+X)
  const legL = new THREE.Group();
  legL.position.set(0.125, P.hipY, 0);
  bodyRoot.add(legL);

  const tLFront = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'leftFront'), { crop: CROPS.thighLeftFront, fallbackFill: '#111318' }));
  const tLBack = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'back'), { crop: CROPS.thighLeftBack, fallbackFill: '#111318' }));
  const tLOuter = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'side'), { crop: CROPS.thighLeftSide, fallbackFill: '#111318' }));
  const thighLMesh = new THREE.Mesh(
    thighGeo,
    buildBoxFaceMaterials([tLOuter, trouserSolid, trouserSolid, trouserSolid, tLFront, tLBack], 0.76, 0.05, disposables)
  );
  thighLMesh.castShadow = true;
  legL.add(thighLMesh);

  const lowerLegL = new THREE.Group();
  lowerLegL.position.set(0, P.kneeOffsetY, 0);
  legL.add(lowerLegL);

  const sLFront = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'back'), { crop: CROPS.shinLeftFront, fallbackFill: '#111318' }));
  const sLBack = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'back'), { crop: CROPS.shinLeftBack, fallbackFill: '#111318' }));
  const sLOuter = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'side'), { crop: CROPS.shinLeftSide, fallbackFill: '#111318' }));
  const shinLMesh = new THREE.Mesh(
    shinGeo,
    buildBoxFaceMaterials([sLOuter, trouserSolid, trouserSolid, trouserSolid, sLFront, sLBack], 0.76, 0.05, disposables)
  );
  shinLMesh.castShadow = true;
  lowerLegL.add(shinLMesh);

  const shLFront = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, drawFallbackShoe, { crop: CROPS.shoeLeftFront, floodMode: 'upper_only', fallbackFill: '#111318' }));
  const shLBack = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, drawFallbackShoe, { crop: CROPS.shoeLeftBack, floodMode: 'upper_only', fallbackFill: '#111318' }));
  const shLOuter = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, drawFallbackShoe, { crop: CROPS.shoeLeftSide, floodMode: 'upper_only', fallbackFill: '#111318' }));
  const shLInner = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, drawFallbackShoe, { crop: CROPS.shoeLeftSide, floodMode: 'upper_only', mirrorX: true, fallbackFill: '#111318' }));
  const shoeLMesh = new THREE.Mesh(
    shoeGeo,
    buildBoxFaceMaterials([shLOuter, shLInner, soleSolid, soleSolid, shLFront, shLBack], 0.65, 0.05, disposables)
  );
  shoeLMesh.castShadow = true;
  lowerLegL.add(shoeLMesh);

  // RIGHT LEG (-X)
  const legR = new THREE.Group();
  legR.position.set(-0.125, P.hipY, 0);
  bodyRoot.add(legR);

  const tRFront = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'rightFront'), { crop: CROPS.thighRightFront, fallbackFill: '#111318' }));
  const tRBack = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'back'), { crop: CROPS.thighRightBack, fallbackFill: '#111318' }));
  const tROuter = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'side'), { crop: CROPS.thighRightSide, fallbackFill: '#111318' }));
  const thighRMesh = new THREE.Mesh(
    thighGeo,
    buildBoxFaceMaterials([trouserSolid, tROuter, trouserSolid, trouserSolid, tRFront, tRBack], 0.76, 0.05, disposables)
  );
  thighRMesh.castShadow = true;
  legR.add(thighRMesh);

  const lowerLegR = new THREE.Group();
  lowerLegR.position.set(0, P.kneeOffsetY, 0);
  legR.add(lowerLegR);

  const sRFront = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'back'), { crop: CROPS.shinRightFront, fallbackFill: '#111318' }));
  const sRBack = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'back'), { crop: CROPS.shinRightBack, fallbackFill: '#111318' }));
  const sROuter = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, (c, w, h) => drawFallbackTrouser(c, w, h, 'side'), { crop: CROPS.shinRightSide, fallbackFill: '#111318' }));
  const shinRMesh = new THREE.Mesh(
    shinGeo,
    buildBoxFaceMaterials([trouserSolid, sROuter, trouserSolid, trouserSolid, sRFront, sRBack], 0.76, 0.05, disposables)
  );
  shinRMesh.castShadow = true;
  lowerLegR.add(shinRMesh);

  const shRFront = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, drawFallbackShoe, { crop: CROPS.shoeRightFront, floodMode: 'upper_only', fallbackFill: '#111318' }));
  const shRBack = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, drawFallbackShoe, { crop: CROPS.shoeRightBack, floodMode: 'upper_only', fallbackFill: '#111318' }));
  const shROuter = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, drawFallbackShoe, { crop: CROPS.shoeRightSide, floodMode: 'upper_only', fallbackFill: '#111318' }));
  const shRInner = reg(makeTexSlot(128, 128, maxAnisotropy, disposables, drawFallbackShoe, { crop: CROPS.shoeRightSide, floodMode: 'upper_only', mirrorX: true, fallbackFill: '#111318' }));
  const shoeRMesh = new THREE.Mesh(
    shoeGeo,
    buildBoxFaceMaterials([shRInner, shROuter, soleSolid, soleSolid, shRFront, shRBack], 0.65, 0.05, disposables)
  );
  shoeRMesh.castShadow = true;
  lowerLegR.add(shoeRMesh);

  loadReferenceSheetIntoSlots(slots);

  return {
    group: root,
    bodyRoot,
    headGroup,
    torsoGroup,
    armL,
    armR,
    legL,
    legR,
    lowerLegL,
    lowerLegR,
  };
}

export function updateProtagonistAnimation(
  rig: ProtagonistRig,
  state: ProtagonistAnimState,
  dt: number
) {
  const invXZ = 1 / Math.sqrt(Math.max(0.5, state.squashScaleY));
  rig.group.position.set(state.x, state.y, state.z);
  rig.group.rotation.y = state.yaw;
  rig.group.scale.set(invXZ, state.squashScaleY, invXZ);

  let targetLegL = 0;
  let targetLegR = 0;
  let targetKneeL = 0;
  let targetKneeR = 0;
  let targetArmLX = 0;
  let targetArmRX = 0;
  let targetArmLZ = 0.025;
  let targetArmRZ = -0.025;
  let targetTorsoX = 0;
  let targetBodyY = 0;
  let targetBodyZ = 0;
  let targetHeadX = 0;
  let targetHeadY = 0;
  let targetBodyXRot = 0;

  const lie = Math.max(0, Math.min(1, state.lieAmount ?? 0));
  if (lie > 0.02) {
    // Lying horizontally on apartment bed (head rests toward headboard)
    targetBodyXRot = -Math.PI * 0.48 * lie;
    targetBodyY = 0.08 * lie;
    targetArmLZ = 0.08 * lie;
    targetArmRZ = -0.08 * lie;
    targetHeadX = 0.14 * lie;
  } else if (state.isSitting) {
    // Sitting pose (e.g., riding open motorbike/rickshaw)
    targetBodyY = -0.22;
    targetTorsoX = 0.16;
    targetLegL = -1.12;
    targetLegR = -1.12;
    targetKneeL = 1.24;
    targetKneeR = 1.24;
    targetArmLX = -0.78;
    targetArmRX = -0.78;
    targetArmLZ = 0.14;
    targetArmRZ = -0.14;
    targetHeadX = -0.08;
  } else if (!state.grounded) {
    // Jumping vs Falling airborne pose
    const rising = state.vy > 0.25;
    targetLegL = rising ? -0.34 : -0.14;
    targetLegR = rising ? 0.28 : 0.18;
    targetKneeL = rising ? 0.56 : 0.24;
    targetKneeR = rising ? 0.28 : 0.18;
    targetArmLX = rising ? -0.52 : -0.82;
    targetArmRX = rising ? 0.34 : -0.72;
    targetArmLZ = rising ? 0.14 : 0.28;
    targetArmRZ = rising ? -0.14 : -0.28;
    targetTorsoX = rising ? 0.06 : 0.12;
    targetHeadX = rising ? -0.05 : 0.06;
  } else if (state.moveSpeed > 0.05) {
    // Walking / Running cycle
    const amp = state.isRunning ? 0.78 : 0.52;
    const s = Math.sin(state.walkPhase);
    targetLegL = s * amp;
    targetLegR = -s * amp;
    // Knee bends naturally on trailing/lifted leg
    targetKneeL = Math.max(0, -s) * (state.isRunning ? 0.75 : 0.38);
    targetKneeR = Math.max(0, s) * (state.isRunning ? 0.75 : 0.38);
    targetArmLX = -s * amp * 0.85;
    targetArmRX = s * amp * 0.85;
    targetArmLZ = 0.04;
    targetArmRZ = -0.04;
    targetTorsoX = state.isRunning ? 0.14 : 0.04;
    targetBodyY = Math.abs(Math.cos(state.walkPhase)) * (state.isRunning ? 0.045 : 0.022);
    // Slight turning bank & head look lead
    const clampTurn = Math.max(-0.4, Math.min(0.4, state.yawRate * 0.15));
    targetBodyZ = -clampTurn * 0.22;
    targetHeadY = clampTurn * 0.45;
  } else {
    // Idle relaxed breathing & micro-sway
    const breath = Math.sin(state.elapsed * 2.1);
    targetBodyY = breath * 0.008;
    targetArmLX = breath * 0.025;
    targetArmRX = -breath * 0.025;
    targetArmLZ = 0.025 + breath * 0.008;
    targetArmRZ = -(0.025 + breath * 0.008);
    targetHeadX = breath * 0.015;
  }

  const rate = 15;
  rig.legL.rotation.x = THREE.MathUtils.damp(rig.legL.rotation.x, targetLegL, rate, dt);
  rig.legR.rotation.x = THREE.MathUtils.damp(rig.legR.rotation.x, targetLegR, rate, dt);
  rig.lowerLegL.rotation.x = THREE.MathUtils.damp(rig.lowerLegL.rotation.x, targetKneeL, rate, dt);
  rig.lowerLegR.rotation.x = THREE.MathUtils.damp(rig.lowerLegR.rotation.x, targetKneeR, rate, dt);

  rig.armL.rotation.x = THREE.MathUtils.damp(rig.armL.rotation.x, targetArmLX, rate, dt);
  rig.armR.rotation.x = THREE.MathUtils.damp(rig.armR.rotation.x, targetArmRX, rate, dt);
  rig.armL.rotation.z = THREE.MathUtils.damp(rig.armL.rotation.z, targetArmLZ, rate, dt);
  rig.armR.rotation.z = THREE.MathUtils.damp(rig.armR.rotation.z, targetArmRZ, rate, dt);

  rig.torsoGroup.rotation.x = THREE.MathUtils.damp(rig.torsoGroup.rotation.x, targetTorsoX, rate, dt);
  rig.bodyRoot.position.y = THREE.MathUtils.damp(rig.bodyRoot.position.y, targetBodyY, rate, dt);
  rig.bodyRoot.rotation.x = THREE.MathUtils.damp(rig.bodyRoot.rotation.x, targetBodyXRot, rate, dt);
  rig.bodyRoot.rotation.z = THREE.MathUtils.damp(rig.bodyRoot.rotation.z, targetBodyZ, 12, dt);
  rig.headGroup.rotation.x = THREE.MathUtils.damp(rig.headGroup.rotation.x, targetHeadX, 12, dt);
  rig.headGroup.rotation.y = THREE.MathUtils.damp(rig.headGroup.rotation.y, targetHeadY, 12, dt);
}
