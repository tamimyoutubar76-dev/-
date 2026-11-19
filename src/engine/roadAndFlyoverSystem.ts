import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GIS_DATA } from '../gis/projection';
import { VERIFIED_BUS_STOPS } from '../gis/landmarks';
import { FLYOVER_SEGMENTS, getTerrainHeight } from '../sim/terrain';
import { getRoadWidth } from '../sim/roadGraph';
import { VERIFIED_SIGNAL_SPOTS } from '../sim/trafficRules';
import { WorldCollisionGrid } from '../sim/collision';
import { ROAD_BARRIERS, U_TURN_OPENINGS, ZEBRA_CROSSINGS } from '../sim/roadBarriers';
import { NEW_MARKET_CONNECTOR_ROADS } from '../sim/newMarketAndShops';
import { ProceduralTexturePack, createBengaliSignTexture } from './textures';

function subdivideRoadPts(pts: [number, number][], maxStep = 7.5): [number, number][] {
  if (pts.length < 2) return pts;
  const out: [number, number][] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[i + 1];
    const dist = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(1, Math.ceil(dist / maxStep));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]);
    }
  }
  return out;
}

function buildRibbonGeometry(
  rawPts: [number, number][],
  halfWidth: number,
  heightFn: (x: number, z: number, idx: number, tSeg: number) => number,
  yOffset = 0.08,
  tileU = 1
): THREE.BufferGeometry | null {
  const pts = subdivideRoadPts(rawPts, 7.5);
  if (pts.length < 2) return null;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let cumLen = 0;
  let vertIdx = 0;

  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    let dx = 0;
    let dz = 0;
    if (i === 0) {
      dx = pts[1][0] - x;
      dz = pts[1][1] - z;
    } else if (i === pts.length - 1) {
      dx = x - pts[i - 1][0];
      dz = z - pts[i - 1][1];
    } else {
      dx = pts[i + 1][0] - pts[i - 1][0];
      dz = pts[i + 1][1] - pts[i - 1][1];
    }
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;

    if (i > 0) {
      cumLen += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    }
    const yL = heightFn(x + nx * halfWidth, z + nz * halfWidth, i, 0);
    const yR = heightFn(x - nx * halfWidth, z - nz * halfWidth, i, 0);
    const yC = heightFn(x, z, i, 0);
    // Raise slightly above local cross-slope peak to prevent any hillside terrain clipping
    const ySurf = Math.max(yC, yL, yR) + yOffset;

    positions.push(x + nx * halfWidth, ySurf, z + nz * halfWidth);
    positions.push(x - nx * halfWidth, ySurf, z - nz * halfWidth);
    uvs.push(0, cumLen / (tileU === 1 ? halfWidth * 2 : 3.2));
    uvs.push(tileU, cumLen / (tileU === 1 ? halfWidth * 2 : 3.2));

    if (i > 0) {
      const b = vertIdx - 2;
      indices.push(b, b + 2, b + 1);
      indices.push(b + 1, b + 2, b + 3);
    }
    vertIdx += 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export interface TrafficLightBulbHandle {
  id: string;
  phaseOffsetSec: number;
  red: THREE.MeshStandardMaterial;
  green: THREE.MeshStandardMaterial;
}

export interface RoadAndFlyoverHandles {
  roadMaterials: THREE.MeshStandardMaterial[];
  trafficLightBulbs: TrafficLightBulbHandle[];
  groundSurfaceMeshes: THREE.Object3D[];
  dispose: () => void;
}

export function buildRoadAndFlyoverSystem(
  scene: THREE.Scene,
  textures: ProceduralTexturePack,
  collision: WorldCollisionGrid,
  maxAnisotropy: number
): RoadAndFlyoverHandles {
  const disposables: { dispose: () => void }[] = [];
  const groundSurfaceMeshes: THREE.Object3D[] = [];

  const majorGeos: THREE.BufferGeometry[] = [];
  const secondaryGeos: THREE.BufferGeometry[] = [];
  const alleyGeos: THREE.BufferGeometry[] = [];
  const footpathGeos: THREE.BufferGeometry[] = [];
  const sidewalkGeos: THREE.BufferGeometry[] = [];
  const junctionCapGeos: THREE.BufferGeometry[] = [];

  const allGroundRoads = [...GIS_DATA.roads, ...NEW_MARKET_CONNECTOR_ROADS];

  // 1. Continuous Ground OSM + New Market Road Network (subdivided + junction-capped for zero gaps)
  for (const r of allGroundRoads) {
    if (r.bridge || r.pts.length < 2) continue;
    const hw = r.hw;
    const w = getRoadWidth(hw);
    const halfW = w * 0.5;
    const isFoot = hw === 'footway' || hw === 'pedestrian' || hw === 'path' || hw === 'steps';
    const isMajor = hw === 'trunk' || hw === 'trunk_link' || hw === 'primary';
    const isSecondary = hw === 'secondary' || hw === 'secondary_link' || hw === 'tertiary';

    const yOff = isFoot ? 0.11 : isMajor ? 0.19 : isSecondary ? 0.16 : 0.13;
    const geo = buildRibbonGeometry(r.pts, halfW, (px, pz) => getTerrainHeight(px, pz), yOff);
    if (!geo) continue;

    if (isMajor) {
      majorGeos.push(geo);
      const swHalfW = halfW + 2.1;
      const swGeo = buildRibbonGeometry(r.pts, swHalfW, (px, pz) => getTerrainHeight(px, pz), 0.08, (swHalfW * 2) / 3.2);
      if (swGeo) sidewalkGeos.push(swGeo);
    } else if (isSecondary) {
      secondaryGeos.push(geo);
      const swHalfW = halfW + 1.4;
      const swGeo = buildRibbonGeometry(r.pts, swHalfW, (px, pz) => getTerrainHeight(px, pz), 0.07, (swHalfW * 2) / 3.2);
      if (swGeo) sidewalkGeos.push(swGeo);
    } else if (isFoot) {
      footpathGeos.push(geo);
    } else {
      alleyGeos.push(geo);
    }

    // Add seamless asphalt junction discs at endpoints and sharp bends of major/secondary roads
    if (isMajor || isSecondary) {
      const capSpots = [r.pts[0], r.pts[r.pts.length - 1]];
      for (const [cx, cz] of capSpots) {
        const cy = getTerrainHeight(cx, cz) + yOff - 0.01;
        const cap = new THREE.CylinderGeometry(halfW * 0.98, halfW * 0.98, 0.06, 12);
        cap.translate(cx, cy, cz);
        junctionCapGeos.push(cap);
      }
    }
  }

  // Paved Chattogram New Market Courtyard Plaza surface
  const nmPlazaY = getTerrainHeight(892, 540) + 0.08;
  const nmPlazaGeo = new THREE.BoxGeometry(116, 0.14, 186);
  nmPlazaGeo.translate(894, nmPlazaY - 0.04, 540);
  sidewalkGeos.push(nmPlazaGeo);

  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.asphaltMap,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.03,
    roughness: 0.84,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const secondaryRoadMat = new THREE.MeshStandardMaterial({
    color: 0xdedfde,
    map: textures.asphaltMap,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.025,
    roughness: 0.87,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const plainAsphaltMat = new THREE.MeshStandardMaterial({
    color: 0x2b2f34,
    roughness: 0.86,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const alleyMat = new THREE.MeshStandardMaterial({
    color: 0x767570,
    roughness: 0.92,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.sidewalkMap,
    roughness: 0.88,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: 0,
    polygonOffsetUnits: 0,
  });
  const footpathMat = new THREE.MeshStandardMaterial({
    color: 0xb29a7d,
    roughness: 0.94,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  disposables.push(asphaltMat, secondaryRoadMat, plainAsphaltMat, alleyMat, sidewalkMat, footpathMat);

  const addMerged = (
    geos: THREE.BufferGeometry[],
    mat: THREE.Material,
    castShadow = false,
    isGroundRoad = false
  ) => {
    if (geos.length === 0) return;
    const chunkSize = 700;
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
        if (isGroundRoad) groundSurfaceMeshes.push(mesh);
      }
    }
  };

  addMerged(sidewalkGeos, sidewalkMat, false, true);
  addMerged(alleyGeos, alleyMat, false, true);
  addMerged(footpathGeos, footpathMat, false, true);
  addMerged(secondaryGeos, secondaryRoadMat, false, true);
  addMerged(junctionCapGeos, plainAsphaltMat, false, true);
  addMerged(majorGeos, asphaltMat, false, true);

  // 1b. Zebra Crossings at key Lalkhan Bazar intersections & New Market Gate
  const zebraMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.zebraCrossingMap,
    roughness: 0.78,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  disposables.push(zebraMat);
  const zebraGeos: THREE.BufferGeometry[] = [];
  for (const zb of ZEBRA_CROSSINGS) {
    const zg = new THREE.PlaneGeometry(zb.width, zb.length);
    zg.rotateX(-Math.PI / 2);
    zg.rotateY(zb.yaw);
    zg.translate(zb.x, getTerrainHeight(zb.x, zb.z) + 0.22, zb.z);
    zebraGeos.push(zg);
  }
  addMerged(zebraGeos, zebraMat);

  // 1c. Physical Ground Center Dividers (Tall Concrete Jersey + Low Jumpable Metal Guardrails)
  const jerseyGeos: THREE.BufferGeometry[] = [];
  const lowRailGeos: THREE.BufferGeometry[] = [];
  const lowPostGeos: THREE.BufferGeometry[] = [];

  for (const bar of ROAD_BARRIERS.groundDividers) {
    const dx = bar.x2 - bar.x1;
    const dz = bar.z2 - bar.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.3) continue;
    const mx = (bar.x1 + bar.x2) * 0.5;
    const mz = (bar.z1 + bar.z2) * 0.5;
    const my = (bar.baseY1 + bar.baseY2) * 0.5 + 0.14;
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.atan2(bar.baseY2 - bar.baseY1, len);

    if (bar.kind === 'concrete_divider') {
      const g = new THREE.BoxGeometry(bar.halfWidth * 1.9, bar.height, len + 0.25);
      g.translate(0, bar.height * 0.5, 0);
      g.rotateX(-pitch);
      g.rotateY(yaw);
      g.translate(mx, my, mz);
      jerseyGeos.push(g);
    } else if (bar.kind === 'low_metal_barrier') {
      const rail = new THREE.BoxGeometry(0.18, 0.24, len + 0.1);
      rail.translate(0, bar.height - 0.12, 0);
      rail.rotateX(-pitch);
      rail.rotateY(yaw);
      rail.translate(mx, my, mz);
      lowRailGeos.push(rail);

      const post = new THREE.CylinderGeometry(0.06, 0.07, bar.height, 6);
      post.translate(0, bar.height * 0.5, 0);
      post.translate(bar.x1, bar.baseY1 + 0.14, bar.z1);
      lowPostGeos.push(post);
    }
  }

  const barrierConcreteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.barrierConcreteMap,
    roughness: 0.82,
    metalness: 0.08,
  });
  const lowRailMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.metalGuardrailMap,
    roughness: 0.42,
    metalness: 0.55,
  });
  const postSteelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.7,
  });
  disposables.push(barrierConcreteMat, lowRailMat, postSteelMat);

  addMerged(jerseyGeos, barrierConcreteMat, true);
  addMerged(lowRailGeos, lowRailMat, true);
  addMerged(lowPostGeos, postSteelMat, false);

  // 1d. Designated U-Turn Opening Signs & Curbed Bullnoses
  for (const ut of U_TURN_OPENINGS) {
    const uy = getTerrainHeight(ut.x, ut.z) + 0.15;
    const sg = new THREE.Group();
    sg.position.set(ut.x, uy, ut.z);
    sg.rotation.y = ut.yaw;

    const pGeo = new THREE.CylinderGeometry(0.07, 0.08, 3.2, 8);
    pGeo.translate(0, 1.6, 0);
    const bGeo = new THREE.BoxGeometry(1.75, 0.9, 0.1);
    const tex = createBengaliSignTexture('↶ ইউ-টার্ন', 'U-TURN BAY', '#0d543c', '#ffffff', '#facc15', maxAnisotropy);
    const bMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
    disposables.push(pGeo, bGeo, tex, bMat);

    const pMesh = new THREE.Mesh(pGeo, postSteelMat);
    pMesh.position.set(0, 0, ut.radius * 0.65);
    const bMesh = new THREE.Mesh(bGeo, bMat);
    bMesh.position.set(0, 3.0, ut.radius * 0.65);
    sg.add(pMesh, bMesh);
    scene.add(sg);
  }

  // 2. Elevated Flyover Viaducts, Side Crash Barriers, Center Divider & Ramps
  const deckGeos: THREE.BufferGeometry[] = [];
  const parapetGeos: THREE.BufferGeometry[] = [];
  const flyDividerGeos: THREE.BufferGeometry[] = [];
  const pierPositions: { x: number; yTop: number; yBot: number; z: number; angle: number }[] = [];
  const lampPositions: { x: number; y: number; z: number; angle: number }[] = [];

  for (let i = 0; i < FLYOVER_SEGMENTS.length; i++) {
    const s = FLYOVER_SEGMENTS[i];
    const dx = s.x2 - s.x1;
    const dz = s.z2 - s.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.4) continue;

    const midX = (s.x1 + s.x2) * 0.5;
    const midZ = (s.z1 + s.z2) * 0.5;
    const midY = (s.y1 + s.y2) * 0.5;
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.atan2(s.y2 - s.y1, len);

    // Overlap slightly along length (+0.55m) for 100% seamless zero-gap decks
    const deckGeo = new THREE.BoxGeometry(s.halfWidth * 2, 0.24, len + 0.55);
    deckGeo.rotateX(-pitch);
    deckGeo.rotateY(yaw);
    deckGeo.translate(midX, midY - 0.11, midZ);
    deckGeos.push(deckGeo);

    // Box-girder underside
    const girderGeo = new THREE.BoxGeometry(s.halfWidth * 1.48, 1.35, len + 0.45);
    girderGeo.rotateX(-pitch);
    girderGeo.rotateY(yaw);
    girderGeo.translate(midX, midY - 0.86, midZ);
    parapetGeos.push(girderGeo);

    // Tall Strong Left & Right Safety Barriers (1.25m high)
    const wallL = new THREE.BoxGeometry(0.52, 1.25, len + 0.45);
    wallL.translate(-s.halfWidth + 0.25, 0.62, 0);
    wallL.rotateX(-pitch);
    wallL.rotateY(yaw);
    wallL.translate(midX, midY, midZ);
    parapetGeos.push(wallL);

    const wallR = new THREE.BoxGeometry(0.52, 1.25, len + 0.45);
    wallR.translate(s.halfWidth - 0.25, 0.62, 0);
    wallR.rotateX(-pitch);
    wallR.rotateY(yaw);
    wallR.translate(midX, midY, midZ);
    parapetGeos.push(wallR);

    // Physical Center Concrete Divider separating opposite flyover traffic directions
    if (!s.isRamp && s.halfWidth >= 4.8) {
      const cDiv = new THREE.BoxGeometry(0.46, 1.05, len + 0.45);
      cDiv.translate(0, 0.52, 0);
      cDiv.rotateX(-pitch);
      cDiv.rotateY(yaw);
      cDiv.translate(midX, midY, midZ);
      flyDividerGeos.push(cDiv);
    }

    // Place concrete support piers every ~30m where clearance > 2.6m
    const gY = getTerrainHeight(midX, midZ);
    if (midY - gY > 2.6 && i % 3 === 0) {
      pierPositions.push({ x: midX, yTop: midY - 1.2, yBot: gY - 0.5, z: midZ, angle: yaw });
      collision.addPillar(midX, midZ, 1.15, midY - 1.0);
    }

    if (i % 5 === 0) {
      lampPositions.push({ x: midX, y: midY + 0.9, z: midZ, angle: yaw });
    }
  }

  const flyConcreteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.flyoverConcreteMap,
    roughness: 0.86,
    metalness: 0.05,
  });
  disposables.push(flyConcreteMat);

  addMerged(deckGeos, asphaltMat);
  addMerged(parapetGeos, flyConcreteMat);
  addMerged(flyDividerGeos, barrierConcreteMat);

  // Instanced Flyover Piers & Pier Caps
  if (pierPositions.length > 0) {
    const colGeo = new THREE.CylinderGeometry(0.95, 1.1, 1, 8);
    colGeo.translate(0, 0.5, 0);
    const capGeo = new THREE.BoxGeometry(7.2, 1.1, 2.2);
    disposables.push(colGeo, capGeo);

    const colInst = new THREE.InstancedMesh(colGeo, flyConcreteMat, pierPositions.length);
    const capInst = new THREE.InstancedMesh(capGeo, flyConcreteMat, pierPositions.length);
    colInst.castShadow = true;
    colInst.receiveShadow = true;
    capInst.castShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < pierPositions.length; i++) {
      const p = pierPositions[i];
      const h = Math.max(1.2, p.yTop - p.yBot);
      dummy.position.set(p.x, p.yBot, p.z);
      dummy.rotation.set(0, p.angle, 0);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      colInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, p.yTop, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      capInst.setMatrixAt(i, dummy.matrix);
    }
    colInst.instanceMatrix.needsUpdate = true;
    capInst.instanceMatrix.needsUpdate = true;
    colInst.computeBoundingSphere();
    capInst.computeBoundingSphere();
    scene.add(colInst, capInst);
  }

  // Instanced Highway Lamps on Flyover
  if (lampPositions.length > 0) {
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 6.2, 6);
    poleGeo.translate(0, 3.1, 0);
    const armGeo = new THREE.BoxGeometry(2.4, 0.14, 0.24);
    armGeo.translate(1.0, 6.15, 0);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3b444b, metalness: 0.72, roughness: 0.35 });
    const bulbGeo = new THREE.BoxGeometry(0.7, 0.12, 0.32);
    bulbGeo.translate(2.0, 6.06, 0);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffeed0,
      emissive: 0xffc864,
      emissiveIntensity: 0.9,
      roughness: 0.25,
    });
    disposables.push(poleGeo, armGeo, poleMat, bulbGeo, bulbMat);

    const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
    const arms = new THREE.InstancedMesh(armGeo, poleMat, lampPositions.length);
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampPositions.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < lampPositions.length; i++) {
      const l = lampPositions[i];
      dummy.position.set(l.x, l.y, l.z);
      dummy.rotation.set(0, l.angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      arms.setMatrixAt(i, dummy.matrix);
      bulbs.setMatrixAt(i, dummy.matrix);
    }
    poles.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;
    bulbs.instanceMatrix.needsUpdate = true;
    poles.computeBoundingSphere();
    arms.computeBoundingSphere();
    bulbs.computeBoundingSphere();
    scene.add(poles, arms, bulbs);
  }

  // 3. Ispahani Circle Central Monument Island & Roundabout
  const ispX = 268.7;
  const ispZ = 324.1;
  const ispY = getTerrainHeight(ispX, ispZ);
  const islandGroup = new THREE.Group();
  islandGroup.position.set(ispX, ispY, ispZ);

  const curbGeo = new THREE.CylinderGeometry(8.2, 8.6, 0.45, 24);
  curbGeo.translate(0, 0.22, 0);
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xe2ddd2, roughness: 0.82 });
  const lawnGeo = new THREE.CylinderGeometry(7.4, 7.6, 0.52, 24);
  lawnGeo.translate(0, 0.26, 0);
  const lawnMat = new THREE.MeshStandardMaterial({ color: 0x3b6c35, roughness: 0.9 });
  const plinthGeo = new THREE.CylinderGeometry(2.4, 3.0, 1.4, 12);
  plinthGeo.translate(0, 1.0, 0);
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0xc94f38, roughness: 0.7 });
  const spireGeo = new THREE.CylinderGeometry(0.35, 0.85, 5.2, 12);
  spireGeo.translate(0, 4.2, 0);
  const spireMat = new THREE.MeshStandardMaterial({ color: 0x1e6b52, roughness: 0.35, metalness: 0.4 });
  disposables.push(curbGeo, curbMat, lawnGeo, lawnMat, plinthGeo, plinthMat, spireGeo, spireMat);

  islandGroup.add(
    new THREE.Mesh(curbGeo, curbMat),
    new THREE.Mesh(lawnGeo, lawnMat),
    new THREE.Mesh(plinthGeo, plinthMat),
    new THREE.Mesh(spireGeo, spireMat)
  );
  scene.add(islandGroup);
  collision.addPillar(ispX, ispZ, 8.2, ispY + 6.0);

  // 4. Verified Bus Stop Shelters & Bengali Road Signs
  const shelterRoofMat = new THREE.MeshStandardMaterial({ color: 0x12664f, roughness: 0.45, metalness: 0.25 });
  const shelterPostMat = new THREE.MeshStandardMaterial({ color: 0x3d4750, roughness: 0.35, metalness: 0.7 });
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x9c6738, roughness: 0.78 });
  disposables.push(shelterRoofMat, shelterPostMat, benchMat);

  for (const bs of VERIFIED_BUS_STOPS) {
    const by = getTerrainHeight(bs.x, bs.z);
    const g = new THREE.Group();
    g.position.set(bs.x, by, bs.z);
    g.rotation.y = bs.id === 'bus_new_market' ? 1.5 : -0.42;

    const pGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8);
    pGeo.translate(0, 1.3, 0);
    const rGeo = new THREE.BoxGeometry(5.2, 0.16, 2.2);
    rGeo.translate(0, 2.65, 0);
    const bGeo = new THREE.BoxGeometry(3.8, 0.16, 0.6);
    bGeo.translate(0, 0.55, -0.4);
    const signGeo = new THREE.PlaneGeometry(4.6, 1.1);
    const signTex = createBengaliSignTexture(bs.bengaliName, bs.name, '#104f3d', '#ffffff', '#e8b948', maxAnisotropy);
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 });
    disposables.push(pGeo, rGeo, bGeo, signGeo, signTex, signMat);

    const p1 = new THREE.Mesh(pGeo, shelterPostMat);
    p1.position.set(-2.1, 0, -0.7);
    const p2 = new THREE.Mesh(pGeo, shelterPostMat);
    p2.position.set(2.1, 0, -0.7);
    const roof = new THREE.Mesh(rGeo, shelterRoofMat);
    const bench = new THREE.Mesh(bGeo, benchMat);
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 3.35, 0.95);

    g.add(p1, p2, roof, bench, sign);
    scene.add(g);
  }

  // 5. Authentic Bengali Highway Overhead Directional Signs (including New Market route!)
  const highwaySigns = [
    {
      x: 245,
      z: 360,
      yaw: -0.45,
      bn: '← পতেঙ্গা এক্সপ্রেসওয়ে  |  লালখান বাজার →',
      en: 'PATENGA EXPWY ←  |  CDA AVE →',
    },
    {
      x: 372,
      z: 214,
      yaw: -0.48,
      bn: '↑ মুরাদপুর ফ্লাইওভার  |  নিউ মার্কেট →',
      en: 'AKHTARUZZAMAN FLYOVER ↑  |  NEW MARKET →',
    },
    {
      x: 530,
      z: -110,
      yaw: 0.08,
      bn: '↑ জিইসি ও ২ নং গেট  |  লালখান বাজার ↓',
      en: 'GEC CIRCLE ↑  |  LALKHAN BAZAR ↓',
    },
    {
      x: 745,
      z: 388,
      yaw: 1.4,
      bn: 'নিউ মার্কেট (বিপণি বিতান) →',
      en: 'CHATTOGRAM NEW MARKET 120m →',
    },
  ];
  for (const hs of highwaySigns) {
    const sy = getTerrainHeight(hs.x, hs.z);
    const g = new THREE.Group();
    g.position.set(hs.x, sy, hs.z);
    g.rotation.y = hs.yaw;

    const postGeo = new THREE.CylinderGeometry(0.14, 0.16, 5.4, 8);
    postGeo.translate(0, 2.7, 0);
    const boardGeo = new THREE.BoxGeometry(6.8, 1.9, 0.18);
    const tex = createBengaliSignTexture(hs.bn, hs.en, '#0d543c', '#ffffff', '#f5f2ea', maxAnisotropy);
    const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 });
    disposables.push(postGeo, boardGeo, tex, boardMat);

    const postL = new THREE.Mesh(postGeo, shelterPostMat);
    postL.position.set(-2.9, 0, 0);
    const postR = new THREE.Mesh(postGeo, shelterPostMat);
    postR.position.set(2.9, 0, 0);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 5.1, 0);
    g.add(postL, postR, board);
    scene.add(g);
  }

  // 6. Traffic Signals at Ispahani Circle, Lalkhan Bazar Junction & WASA Mor
  const trafficLightBulbs: TrafficLightBulbHandle[] = [];
  for (const sp of VERIFIED_SIGNAL_SPOTS) {
    const sy = getTerrainHeight(sp.poleX, sp.poleZ);
    const g = new THREE.Group();
    g.position.set(sp.poleX, sy, sp.poleZ);
    g.rotation.y = sp.poleYaw;

    const pGeo = new THREE.CylinderGeometry(0.1, 0.12, 4.4, 8);
    pGeo.translate(0, 2.2, 0);
    const boxGeo = new THREE.BoxGeometry(0.55, 1.35, 0.45);
    const redGeo = new THREE.SphereGeometry(0.16, 10, 10);
    const greenGeo = new THREE.SphereGeometry(0.16, 10, 10);

    const boxMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.6, metalness: 0.4 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff2b2b, emissive: 0xff2b2b, emissiveIntensity: 0.2 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x1fe066, emissive: 0x1fe066, emissiveIntensity: 1.3 });
    disposables.push(pGeo, boxGeo, redGeo, greenGeo, boxMat, redMat, greenMat);

    const pole = new THREE.Mesh(pGeo, shelterPostMat);
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(0, 4.2, 0);
    const rBulb = new THREE.Mesh(redGeo, redMat);
    rBulb.position.set(0, 4.55, 0.22);
    const gBulb = new THREE.Mesh(greenGeo, greenMat);
    gBulb.position.set(0, 3.85, 0.22);
    g.add(pole, box, rBulb, gBulb);
    scene.add(g);
    trafficLightBulbs.push({
      id: sp.id,
      phaseOffsetSec: sp.phaseOffsetSec,
      red: redMat,
      green: greenMat,
    });
  }

  return {
    roadMaterials: [asphaltMat, secondaryRoadMat],
    trafficLightBulbs,
    groundSurfaceMeshes,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
