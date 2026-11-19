import * as THREE from 'three';
import { GIS_DATA } from '../gis/projection';
import { getTerrainHeight, sampleElevationASL } from '../sim/terrain';

export function buildTerrainAndVegetation(scene: THREE.Scene): { dispose: () => void } {
  const disposables: { dispose: () => void }[] = [];

  const bounds = GIS_DATA.meta.boundsMetric;
  const width = bounds.maxX - bounds.minX; // 1540m
  const depth = bounds.maxZ - bounds.minZ; // 1440m
  const cx = (bounds.minX + bounds.maxX) * 0.5;
  const cz = (bounds.minZ + bounds.maxZ) * 0.5;

  // Extended terrain skirt (+450m beyond playable perimeter so outdoor horizon never ends in void)
  const fullW = width + 900;
  const fullD = depth + 900;
  const segX = 140;
  const segZ = 140;

  const geo = new THREE.PlaneGeometry(fullW, fullD, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cTmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + cx;
    const wz = pos.getZ(i) + cz;
    pos.setX(i, wx);
    pos.setZ(i, wz);

    // Real SRTM terrain inside bounds; natural rolling Chattogram hills outside (keep New Market SE terrace level)
    let y = getTerrainHeight(wx, wz);
    const inNewMarketRange = wx >= 760 && wx <= 1020 && wz >= 340 && wz <= 680;
    if (!inNewMarketRange && (wx < bounds.minX || wx > bounds.maxX || wz < bounds.minZ || wz > bounds.maxZ)) {
      const distOut = Math.max(
        bounds.minX - wx,
        wx - bounds.maxX,
        bounds.minZ - wz,
        wz - bounds.maxZ,
        0
      );
      const bataliBoost =
        wx < -200 && wz > 100 ? Math.min(28, distOut * 0.08) : Math.sin(wx * 0.01) * Math.cos(wz * 0.01) * 4;
      y += bataliBoost;
    }
    pos.setY(i, y);

    // Color terrain naturally by elevation ASL and east/west urban vs hill zone:
    const asl = sampleElevationASL(wx, wz);
    if ((asl < 23 && wx > 180) || inNewMarketRange) {
      // Urban valley soil / sidewalk base
      cTmp.setHex(0x6e7068);
    } else if (asl < 32) {
      cTmp.setHex(0x526b41);
    } else if (asl < 45) {
      // Reddish Chattogram hill laterite + lush grass
      cTmp.setHex(0x695a3d).lerp(new THREE.Color(0x406834), 0.55);
    } else {
      // Upper hill crests (Batali Hill / Motijharna summit)
      cTmp.setHex(0x3a642f);
    }
    colors[i * 3] = cTmp.r;
    colors[i * 3 + 1] = cTmp.g;
    colors[i * 3 + 2] = cTmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  disposables.push(geo);

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  disposables.push(terrainMat);

  const terrainMesh = new THREE.Mesh(geo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // Tropical Chattogram Hill & Roadside Vegetation (InstancedMesh: trunks + multi-lobe canopies)
  // Place trees on hilly slopes (Motijharna, Tankir Pahar, Batali Hill), CRB/Chittagong Club greenery, and roadside boulevards
  const treeCoords: { x: number; y: number; z: number; scale: number; tint: number }[] = [];
  let seed = 4219;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Sample candidate positions outside buildings & roads
  for (let i = 0; i < 620; i++) {
    const tx = bounds.minX + 30 + rand() * (width - 60);
    const tz = bounds.minZ + 30 + rand() * (depth - 60);
    const asl = sampleElevationASL(tx, tz);
    // Favor hills (asl > 26) and Chittagong Club / Jamiatul Falah / Police Lines green pockets
    const isGreenPocket = tx > 390 && tx < 740 && tz > -20 && tz < 420;
    if (asl < 25 && !isGreenPocket && rand() > 0.18) continue;

    // Avoid spawning right on top of a building footprint
    let insideBldg = false;
    for (let bIdx = 0; bIdx < GIS_DATA.buildings.length; bIdx += 3) {
      const b = GIS_DATA.buildings[bIdx];
      if (Math.abs(b.cx - tx) < 12 && Math.abs(b.cz - tz) < 12) {
        insideBldg = true;
        break;
      }
    }
    if (insideBldg) continue;

    // Avoid major road centerlines
    let onRoad = false;
    for (const r of GIS_DATA.roads) {
      if (r.hw === 'footway' || r.hw === 'path') continue;
      for (let k = 0; k < r.pts.length - 1; k++) {
        const [x1, z1] = r.pts[k];
        const [x2, z2] = r.pts[k + 1];
        const dx = x2 - x1;
        const dz = z2 - z1;
        const l2 = dx * dx + dz * dz;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((tx - x1) * dx + (tz - z1) * dz) / l2)) : 0;
        if (Math.hypot(tx - (x1 + t * dx), tz - (z1 + t * dz)) < 7.5) {
          onRoad = true;
          break;
        }
      }
      if (onRoad) break;
    }
    if (onRoad) continue;

    treeCoords.push({
      x: tx,
      y: getTerrainHeight(tx, tz),
      z: tz,
      scale: 0.8 + rand() * 0.65,
      tint: rand(),
    });
  }

  if (treeCoords.length > 0) {
    // Trunk geometry (tapered cylinder pivoted at bottom-center)
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 3.2, 7);
    trunkGeo.translate(0, 1.6, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x574132, roughness: 0.92, metalness: 0.0 });

    // Multi-lobe tropical canopy (primary + secondary crown merged via overlapping spheres/icosahedrons)
    const crownGeo = new THREE.DodecahedronGeometry(2.3, 1);
    crownGeo.translate(0, 4.4, 0);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0.02 });

    const crownUpperGeo = new THREE.DodecahedronGeometry(1.65, 1);
    crownUpperGeo.translate(0.6, 5.5, 0.4);

    disposables.push(trunkGeo, trunkMat, crownGeo, crownUpperGeo, crownMat);

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCoords.length);
    const crownsTop = new THREE.InstancedMesh(crownUpperGeo, crownMat, treeCoords.length);
    crowns.castShadow = true;
    crowns.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const cLeaf = new THREE.Color();
    for (let i = 0; i < treeCoords.length; i++) {
      const t = treeCoords[i];
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, t.tint * Math.PI * 2, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      crowns.setMatrixAt(i, dummy.matrix);
      crownsTop.setMatrixAt(i, dummy.matrix);

      cLeaf.setHSL(0.28 + (t.tint - 0.5) * 0.05, 0.45, 0.26 + t.tint * 0.1);
      crowns.setColorAt(i, cLeaf);
      cLeaf.offsetHSL(0, 0, 0.05);
      crownsTop.setColorAt(i, cLeaf);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    crownsTop.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    if (crownsTop.instanceColor) crownsTop.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    crownsTop.computeBoundingSphere();

    scene.add(trunks, crowns, crownsTop);
  }

  return {
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
