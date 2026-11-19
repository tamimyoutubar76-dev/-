import * as THREE from 'three';
import { FIXED_COMPANION_IDENTITY } from '../sim/companionState';

export interface CompanionRig {
  identity: typeof FIXED_COMPANION_IDENTITY;
  group: THREE.Group;
  bodyRoot: THREE.Group;
  headGroup: THREE.Group;
  torsoGroup: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

export interface CompanionAnimInput {
  x: number;
  y: number;
  z: number;
  yaw: number;
  moveSpeed: number;
  walkPhase: number;
  isSitting: boolean;
  lieAmount: number;
  elapsed: number;
}

function makeTex(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  aniso: number,
  disposables: { dispose: () => void }[]
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, Math.min(8, aniso));
  tex.needsUpdate = true;
  disposables.push(tex);
  return tex;
}

/**
 * Builds Friend Companion "Tariq" as a permanent fixed-identity block-style 3D character
 * with unmistakable distinct hair, face, and emerald-teal jacket outfit so he is always
 * recognizable alongside the black/gold Portugal #7 protagonist.
 */
export function createCompanionMesh(
  contactShadowTex: THREE.Texture,
  maxAnisotropy: number,
  disposables: { dispose: () => void }[]
): CompanionRig {
  const root = new THREE.Group();
  const bodyRoot = new THREE.Group();
  root.add(bodyRoot);

  const shGeo = new THREE.CircleGeometry(0.54, 14);
  shGeo.rotateX(-Math.PI / 2);
  const shMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.42,
  });
  disposables.push(shGeo, shMat);
  const shMesh = new THREE.Mesh(shGeo, shMat);
  shMesh.position.y = 0.02;
  root.add(shMesh);

  // Skin + Jacket + Charcoal Jeans fixed textures (never randomized!)
  const faceFrontTex = makeTex(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#d99062';
      ctx.fillRect(0, 0, w, h);
      // Warm side-parted dark brown hair crown
      ctx.fillStyle = '#1f1814';
      ctx.fillRect(0, 0, w, h * 0.34);
      ctx.fillRect(0, h * 0.34, w * 0.14, h * 0.14);
      // Friendly eyebrows
      ctx.fillStyle = '#1b1410';
      ctx.fillRect(w * 0.2, h * 0.43, w * 0.21, h * 0.045);
      ctx.fillRect(w * 0.59, h * 0.43, w * 0.21, h * 0.045);
      // Expressive eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w * 0.23, h * 0.5, w * 0.15, h * 0.08);
      ctx.fillRect(w * 0.62, h * 0.5, w * 0.15, h * 0.08);
      ctx.fillStyle = '#1c1410';
      ctx.fillRect(w * 0.27, h * 0.505, w * 0.08, h * 0.07);
      ctx.fillRect(w * 0.66, h * 0.505, w * 0.08, h * 0.07);
      // Nose & friendly smile
      ctx.fillStyle = '#be7348';
      ctx.fillRect(w * 0.45, h * 0.59, w * 0.1, h * 0.14);
      ctx.fillStyle = '#8b3e36';
      ctx.fillRect(w * 0.37, h * 0.8, w * 0.26, h * 0.05);
      ctx.fillStyle = '#f4f4f0';
      ctx.fillRect(w * 0.41, h * 0.81, w * 0.18, h * 0.02);
    },
    maxAnisotropy,
    disposables
  );

  const jacketFrontTex = makeTex(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#0f6a5c';
      ctx.fillRect(0, 0, w, h);
      // Cream chest band + collar + zipper
      ctx.fillStyle = '#f3ebd8';
      ctx.fillRect(0, h * 0.34, w, h * 0.13);
      ctx.fillStyle = '#153243';
      ctx.fillRect(w * 0.47, 0, w * 0.06, h);
      ctx.fillStyle = '#d99062';
      ctx.fillRect(w * 0.36, 0, w * 0.28, h * 0.1);
    },
    maxAnisotropy,
    disposables
  );

  const jacketSolidMat = new THREE.MeshStandardMaterial({ color: 0x0f6a5c, roughness: 0.78 });
  const jacketFrontMat = new THREE.MeshStandardMaterial({ map: jacketFrontTex, roughness: 0.78 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd99062, roughness: 0.74 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1f1814, roughness: 0.9 });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceFrontTex, roughness: 0.72 });
  const jeanMat = new THREE.MeshStandardMaterial({ color: 0x263240, roughness: 0.85 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.65 });
  const packMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.82 });

  disposables.push(jacketSolidMat, jacketFrontMat, skinMat, hairMat, faceMat, jeanMat, shoeMat, packMat);

  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.65, 0);
  bodyRoot.add(torsoGroup);

  const torsoGeo = new THREE.BoxGeometry(0.48, 0.62, 0.26);
  const packGeo = new THREE.BoxGeometry(0.36, 0.46, 0.14);
  disposables.push(torsoGeo, packGeo);
  const torsoMesh = new THREE.Mesh(torsoGeo, [
    jacketSolidMat,
    jacketSolidMat,
    jacketSolidMat,
    jacketSolidMat,
    jacketFrontMat,
    jacketSolidMat,
  ]);
  torsoMesh.position.y = 0.31;
  torsoMesh.castShadow = true;
  const pack = new THREE.Mesh(packGeo, packMat);
  pack.position.set(0, 0.33, -0.19);
  torsoGroup.add(torsoMesh, pack);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.62, 0);
  torsoGroup.add(headGroup);

  const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.4);
  disposables.push(headGeo);
  const headMesh = new THREE.Mesh(headGeo, [
    skinMat,
    skinMat,
    hairMat,
    skinMat,
    faceMat,
    hairMat,
  ]);
  headMesh.position.y = 0.21;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.16, 0.56, 0.16);
  armGeo.translate(0, -0.26, 0);
  disposables.push(armGeo);

  const armL = new THREE.Group();
  armL.position.set(0.325, 0.56, 0);
  const armLMesh = new THREE.Mesh(armGeo, jacketSolidMat);
  armL.add(armLMesh);

  const armR = new THREE.Group();
  armR.position.set(-0.325, 0.56, 0);
  const armRMesh = new THREE.Mesh(armGeo, jacketSolidMat);
  armR.add(armRMesh);

  const handGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  disposables.push(handGeo);
  const handL = new THREE.Mesh(handGeo, skinMat);
  handL.position.y = -0.52;
  const handR = new THREE.Mesh(handGeo, skinMat);
  handR.position.y = -0.52;
  armL.add(handL);
  armR.add(handR);
  torsoGroup.add(armL, armR);

  // Legs + Sneakers
  const legGeo = new THREE.BoxGeometry(0.19, 0.54, 0.2);
  legGeo.translate(0, -0.27, 0);
  const shoeGeo = new THREE.BoxGeometry(0.2, 0.12, 0.26);
  shoeGeo.translate(0, -0.59, 0.03);
  disposables.push(legGeo, shoeGeo);

  const legL = new THREE.Group();
  legL.position.set(0.12, 0.65, 0);
  legL.add(new THREE.Mesh(legGeo, jeanMat), new THREE.Mesh(shoeGeo, shoeMat));

  const legR = new THREE.Group();
  legR.position.set(-0.12, 0.65, 0);
  legR.add(new THREE.Mesh(legGeo, jeanMat), new THREE.Mesh(shoeGeo, shoeMat));
  bodyRoot.add(legL, legR);

  return {
    identity: FIXED_COMPANION_IDENTITY,
    group: root,
    bodyRoot,
    headGroup,
    torsoGroup,
    armL,
    armR,
    legL,
    legR,
  };
}

export function updateCompanionAnimation(
  rig: CompanionRig,
  input: CompanionAnimInput,
  dt: number
) {
  rig.group.position.set(input.x, input.y, input.z);
  rig.group.rotation.y = input.yaw;

  let targetLegL = 0;
  let targetLegR = 0;
  let targetArmL = 0;
  let targetArmR = 0;
  let targetBodyXRot = 0;
  let targetBodyY = 0;

  if (input.lieAmount > 0.02) {
    targetBodyXRot = -Math.PI * 0.48 * input.lieAmount;
    targetBodyY = 0.08 * input.lieAmount;
  } else if (input.isSitting) {
    targetBodyY = -0.22;
    targetLegL = -1.15;
    targetLegR = -1.15;
    targetArmL = -0.55;
    targetArmR = -0.55;
  } else if (input.moveSpeed > 0.1) {
    const s = Math.sin(input.walkPhase);
    const amp = Math.min(0.65, input.moveSpeed * 0.14);
    targetLegL = s * amp;
    targetLegR = -s * amp;
    targetArmL = -s * amp * 0.8;
    targetArmR = s * amp * 0.8;
  } else {
    const b = Math.sin(input.elapsed * 2.0 + 0.8);
    targetBodyY = b * 0.007;
    targetArmL = b * 0.02;
    targetArmR = -b * 0.02;
  }

  const rate = 14;
  rig.legL.rotation.x = THREE.MathUtils.damp(rig.legL.rotation.x, targetLegL, rate, dt);
  rig.legR.rotation.x = THREE.MathUtils.damp(rig.legR.rotation.x, targetLegR, rate, dt);
  rig.armL.rotation.x = THREE.MathUtils.damp(rig.armL.rotation.x, targetArmL, rate, dt);
  rig.armR.rotation.x = THREE.MathUtils.damp(rig.armR.rotation.x, targetArmR, rate, dt);
  rig.bodyRoot.position.y = THREE.MathUtils.damp(rig.bodyRoot.position.y, targetBodyY, rate, dt);
  rig.bodyRoot.rotation.x = THREE.MathUtils.damp(rig.bodyRoot.rotation.x, targetBodyXRot, rate, dt);
}
