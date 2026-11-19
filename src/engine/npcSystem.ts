import * as THREE from 'three';
import { GIS_DATA } from '../gis/projection';
import { VERIFIED_BUS_STOPS, VERIFIED_LANDMARKS } from '../gis/landmarks';
import { getTerrainHeight } from '../sim/terrain';
import { CrowdDensity, getCrowdCountForDensity } from '../sim/worldState';
import { WorldCollisionGrid } from '../sim/collision';
import {
  ROADSIDE_AND_NEW_MARKET_SHOPS,
  VendorVoiceCandidate,
  findNearestVendorVoiceCandidate,
} from '../sim/newMarketAndShops';
import {
  NpcActivity,
  NpcGreetingEvent,
  findProximityGreetingCandidate,
  getNpcRoleLabel,
  selectChittagonianGreeting,
} from '../sim/npcGreetings';

export type NpcBehaviorRole = 'pedestrian' | 'vendor' | 'shopper';

interface NpcAgent {
  id: string;
  role: NpcBehaviorRole;
  group: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  walkPhase: number;
  activity: NpcActivity;
  waypoints: [number, number][];
  wpIdx: number;
  pauseTimer: number;
  greetCooldown: number;
  shopId?: string;
}

export interface VehicleObstacleProbe {
  x: number;
  y: number;
  z: number;
  speed: number;
}

export class NpcLifeSystem {
  private agents: NpcAgent[] = [];
  private maxAgents = 290;
  private activeCount = 180;
  private globalGreetCooldown = 0.2;
  private vendorCooldowns = new Map<string, number>();
  private globalVendorCooldown = 0.35;
  private lastGreetingId: string | null = null;
  private disposables: { dispose: () => void }[] = [];

  constructor(scene: THREE.Scene, density: CrowdDensity) {
    this.activeCount = Math.min(this.maxAgents, getCrowdCountForDensity(density) + 45);

    const headGeo = new THREE.SphereGeometry(0.17, 10, 8);
    const capGeo = new THREE.CylinderGeometry(0.16, 0.175, 0.09, 10);
    const torsoGeo = new THREE.BoxGeometry(0.46, 0.62, 0.25);
    const limbGeo = new THREE.BoxGeometry(0.14, 0.54, 0.14);
    limbGeo.translate(0, -0.27, 0);

    const skinColors = [0xb67e56, 0x9b6642, 0xc7926a, 0x8a5738];
    const shirtColors = [
      0xf2f0eb, 0x246854, 0x2c5680, 0xa83c38, 0xd49c3d,
      0x624d78, 0x3b444b, 0x16806c, 0xc2410c, 0x881337,
    ];
    const pantColors = [0x222831, 0x374151, 0x524539, 0x1b3650, 0x3e2723];

    const skinMats = skinColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78 }));
    const shirtMats = shirtColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
    const pantMats = pantColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.85 });

    this.disposables.push(headGeo, capGeo, torsoGeo, limbGeo, capMat, ...skinMats, ...shirtMats, ...pantMats);

    const buildAgentRig = (idx: number, isVendor: boolean) => {
      const g = new THREE.Group();
      const sMat = skinMats[idx % skinMats.length];
      const tMat = shirtMats[(idx * 3 + (isVendor ? 4 : 0)) % shirtMats.length];
      const pMat = pantMats[(idx * 5) % pantMats.length];

      const head = new THREE.Mesh(headGeo, sMat);
      head.position.set(0, 1.58, 0);
      const torso = new THREE.Mesh(torsoGeo, tMat);
      torso.position.set(0, 1.12, 0);
      const legL = new THREE.Mesh(limbGeo, pMat);
      legL.position.set(-0.12, 0.78, 0);
      const legR = new THREE.Mesh(limbGeo, pMat);
      legR.position.set(0.12, 0.78, 0);
      const armL = new THREE.Mesh(limbGeo, tMat);
      armL.position.set(-0.31, 1.38, 0);
      const armR = new THREE.Mesh(limbGeo, tMat);
      armR.position.set(0.31, 1.38, 0);

      g.add(head, torso, legL, legR, armL, armR);
      if (idx % 4 === 0 || isVendor) {
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(0, 1.72, 0);
        g.add(cap);
      }

      const scaleY = 0.92 + (idx % 5) * 0.035;
      const scaleXZ = 0.94 + (idx % 4) * 0.035;
      g.scale.set(scaleXZ, scaleY, scaleXZ);
      return { g, legL, legR, armL, armR };
    };

    // 1. Stationary/Animated Shopkeepers & Vendors outside all Roadside & New Market Shops (always active!)
    const vendorShops = ROADSIDE_AND_NEW_MARKET_SHOPS.filter((s) => s.hasVendor);
    vendorShops.forEach((shop, idx) => {
      const { g, legL, legR, armL, armR } = buildAgentRig(idx + 50, true);
      const vx = shop.x + Math.sin(shop.yaw) * (shop.depth * 0.5 + 1.05);
      const vz = shop.z + Math.cos(shop.yaw) * (shop.depth * 0.5 + 1.05);
      const vy = getTerrainHeight(vx, vz);
      g.position.set(vx, vy, vz);
      g.rotation.y = shop.yaw;
      scene.add(g);

      this.agents.push({
        id: `vendor_${shop.id}`,
        role: 'vendor',
        group: g,
        legL,
        legR,
        armL,
        armR,
        x: vx,
        y: vy,
        z: vz,
        yaw: shop.yaw,
        speed: 0,
        walkPhase: idx * 1.1,
        activity: 'tea_stall',
        waypoints: [[vx, vz]],
        wpIdx: 0,
        pauseTimer: 0,
        greetCooldown: 0,
        shopId: shop.id,
      });
    });

    // 2. Bustling New Market Shoppers walking between stalls, browsing & bargaining (always visible near market!)
    const nmShops = ROADSIDE_AND_NEW_MARKET_SHOPS.filter((s) => s.isNewMarket);
    const shopperCount = 34;
    for (let s = 0; s < shopperCount; s++) {
      const { g, legL, legR, armL, armR } = buildAgentRig(s + 90, false);
      const sA = nmShops[s % nmShops.length];
      const sB = nmShops[(s * 3 + 2) % nmShops.length];
      const ptA: [number, number] = [
        sA.x + Math.sin(sA.yaw) * (sA.depth * 0.5 + 2.6) + ((s % 3) - 1) * 1.4,
        sA.z + Math.cos(sA.yaw) * (sA.depth * 0.5 + 2.6),
      ];
      const ptMid: [number, number] = [884 + ((s % 5) - 2) * 3.2, 540 + ((s % 7) - 3) * 6.5];
      const ptB: [number, number] = [
        sB.x + Math.sin(sB.yaw) * (sB.depth * 0.5 + 2.6),
        sB.z + Math.cos(sB.yaw) * (sB.depth * 0.5 + 2.6) + ((s % 3) - 1) * 1.2,
      ];
      const startPt = s % 2 === 0 ? ptA : ptMid;
      const sy = getTerrainHeight(startPt[0], startPt[1]);
      g.position.set(startPt[0], sy, startPt[1]);
      scene.add(g);

      this.agents.push({
        id: `nm_shopper_${s}`,
        role: 'shopper',
        group: g,
        legL,
        legR,
        armL,
        armR,
        x: startPt[0],
        y: sy,
        z: startPt[1],
        yaw: 0,
        speed: 1.05 + (s % 4) * 0.16,
        walkPhase: s * 0.85,
        activity: 'walking',
        waypoints: [ptA, ptMid, ptB],
        wpIdx: 1,
        pauseTimer: (s % 4) * 1.3,
        greetCooldown: 0,
      });
    }

    // 3. Lalkhan Bazar OSM Pedestrians, Bus Commuters, Hill Walkers & Mosque Visitors
    const walkableWays = GIS_DATA.roads.filter((r) => !r.bridge && r.pts.length >= 2);
    const mosques = VERIFIED_LANDMARKS.filter((l) => l.isMosque);

    const remainingSlots = this.maxAgents - this.agents.length;
    for (let i = 0; i < remainingSlots; i++) {
      const { g, legL, legR, armL, armR } = buildAgentRig(i, false);
      g.visible = this.agents.length < this.activeCount;
      scene.add(g);

      let activity: NpcActivity = 'walking';
      let waypoints: [number, number][] = [];

      if (i === 0) {
        activity = 'walking';
        waypoints = [
          [279.0, 255.8],
          [285.5, 251.5],
          [276.0, 263.5],
        ];
      } else if (i === 1) {
        activity = 'shop';
        waypoints = [
          [284.2, 261.2],
          [276.5, 265.2],
        ];
      } else if (i === 2) {
        activity = 'waiting_bus';
        waypoints = [
          [265.5, 336.0],
          [262.8, 340.5],
          [270.0, 326.0],
        ];
      } else if (i % 9 === 0) {
        activity = 'waiting_bus';
        const bs = VERIFIED_BUS_STOPS[i % VERIFIED_BUS_STOPS.length];
        const ox = ((i % 5) - 2) * 1.1;
        const oz = ((i % 3) - 1) * 0.9;
        waypoints = [
          [bs.x + ox, bs.z + oz],
          [bs.x + ox + 1.5, bs.z + oz - 0.5],
        ];
      } else if (i % 11 === 0) {
        activity = 'tea_stall';
        const spot = VERIFIED_LANDMARKS.find((l) => l.id === 'lalkhan_tea_stall')!;
        waypoints = [
          [spot.x + ((i % 4) - 1.5) * 1.8, spot.z + 4.0],
          [spot.x + ((i % 3) - 1) * 1.4, spot.z + 5.2],
        ];
      } else if (i % 13 === 0 && mosques.length > 0) {
        activity = 'mosque';
        const mq = mosques[i % mosques.length];
        waypoints = [
          [mq.x + ((i % 3) - 1) * 2.0, mq.z + mq.depth * 0.5 + 3.0],
          [mq.x, mq.z + 1.0],
        ];
      } else {
        const w = walkableWays[(i * 7) % walkableWays.length];
        waypoints = w.pts;
        activity = w.hw === 'footway' || w.hw === 'steps' || w.hw === 'path' ? 'hill_walk' : 'walking';
      }

      const startPt = waypoints[0] || [262, 344];
      const sy = getTerrainHeight(startPt[0], startPt[1]);
      g.position.set(startPt[0], sy, startPt[1]);

      this.agents.push({
        id: `npc_${i}`,
        role: 'pedestrian',
        group: g,
        legL,
        legR,
        armL,
        armR,
        x: startPt[0],
        y: sy,
        z: startPt[1],
        yaw: 0,
        speed: activity === 'waiting_bus' || activity === 'tea_stall' ? 0.55 : 1.3 + (i % 5) * 0.14,
        walkPhase: i * 0.7,
        activity,
        waypoints,
        wpIdx: waypoints.length > 1 ? 1 : 0,
        pauseTimer: i < 2 ? 0.4 : (i % 4) * 1.2,
        greetCooldown: 0,
      });
    }
  }

  public setDensity(density: CrowdDensity) {
    this.activeCount = Math.min(this.maxAgents, getCrowdCountForDensity(density) + 45);
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      a.group.visible = a.role !== 'pedestrian' || i < this.activeCount;
    }
  }

  public update(
    dt: number,
    playerX: number,
    playerZ: number,
    collision: WorldCollisionGrid,
    vehicles: readonly VehicleObstacleProbe[] = []
  ) {
    if (this.globalGreetCooldown > 0) {
      this.globalGreetCooldown = Math.max(0, this.globalGreetCooldown - dt);
    }
    if (this.globalVendorCooldown > 0) {
      this.globalVendorCooldown = Math.max(0, this.globalVendorCooldown - dt);
    }
    for (const [k, cd] of this.vendorCooldowns) {
      if (cd - dt <= 0) this.vendorCooldowns.delete(k);
      else this.vendorCooldowns.set(k, cd - dt);
    }

    const limit = Math.min(this.agents.length, this.activeCount);
    for (let i = 0; i < limit; i++) {
      const a = this.agents[i];
      if (a.greetCooldown > 0) {
        a.greetCooldown = Math.max(0, a.greetCooldown - dt);
      }

      const distPlayer = Math.hypot(a.x - playerX, a.z - playerZ);
      if (distPlayer > 280) {
        a.group.visible = false;
        continue;
      }
      a.group.visible = true;

      // Shopkeepers animate welcoming beckoning gestures toward passersby
      if (a.role === 'vendor') {
        a.walkPhase += dt * 3.4;
        if (distPlayer < 20) {
          const targetYaw = Math.atan2(playerX - a.x, playerZ - a.z);
          let diff = targetYaw - a.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          a.yaw += diff * Math.min(1, dt * 4);
          a.group.rotation.y = a.yaw;
          a.armR.rotation.x = -0.65 + Math.sin(a.walkPhase * 1.4) * 0.35;
          a.armL.rotation.x = Math.sin(a.walkPhase * 0.9) * 0.18;
        } else {
          a.armR.rotation.x *= 0.9;
          a.armL.rotation.x *= 0.9;
        }
        continue;
      }

      if (a.pauseTimer > 0) {
        a.pauseTimer -= dt;
        a.legL.rotation.x *= 0.85;
        a.legR.rotation.x *= 0.85;
        if (a.role === 'shopper' && distPlayer < 120) {
          // Bargaining / talking gesture while stopped at stalls
          a.walkPhase += dt * 4.5;
          a.armR.rotation.x = -0.35 + Math.sin(a.walkPhase) * 0.25;
          a.armL.rotation.x = -0.2 + Math.cos(a.walkPhase * 0.9) * 0.2;
        } else {
          a.armL.rotation.x *= 0.85;
          a.armR.rotation.x *= 0.85;
        }
        continue;
      }

      const target = a.waypoints[a.wpIdx];
      if (!target) continue;
      const dx = target[0] - a.x;
      const dz = target[1] - a.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.85) {
        a.wpIdx = (a.wpIdx + 1) % a.waypoints.length;
        if (a.role === 'shopper') {
          a.pauseTimer = 3.2 + (i % 5) * 1.1;
        } else if (a.activity === 'waiting_bus' || a.activity === 'tea_stall' || a.activity === 'mosque') {
          a.pauseTimer = 3.5 + (i % 5);
        }
        continue;
      }

      // Pedestrian vehicle collision avoidance: yield/sidestep if a moving vehicle is close ahead
      let moveScale = 1.0;
      if (distPlayer < 130 && vehicles.length > 0) {
        const dirX = dx / dist;
        const dirZ = dz / dist;
        for (const v of vehicles) {
          if (Math.abs(v.y - a.y) > 2.2) continue;
          const vx = v.x - a.x;
          const vz = v.z - a.z;
          const vd = Math.hypot(vx, vz);
          if (vd < 5.2 && (vx * dirX + vz * dirZ) > 0.35 && v.speed > 1.0) {
            moveScale = 0.05;
            break;
          }
        }
      }

      const step = Math.min(dist, a.speed * moveScale * dt);
      const nx = a.x + (dx / dist) * step;
      const nz = a.z + (dz / dist) * step;

      if (distPlayer < 120) {
        const res = collision.resolveCircle(nx, nz, 0.35, 0, null, { actorAbsY: a.y });
        a.x = res.x;
        a.z = res.z;
      } else {
        a.x = nx;
        a.z = nz;
      }

      a.y = getTerrainHeight(a.x, a.z);
      a.yaw = Math.atan2(dx, dz);
      a.walkPhase += step * 3.1;

      a.group.position.set(a.x, a.y, a.z);
      a.group.rotation.y = a.yaw;

      if (distPlayer < 130) {
        const swing = moveScale < 0.2 ? 0 : Math.sin(a.walkPhase) * 0.52;
        a.legL.rotation.x = swing;
        a.legR.rotation.x = -swing;
        a.armL.rotation.x = -swing * 0.7;
        a.armR.rotation.x = swing * 0.7;
      }
    }
  }

  public evaluateProximityVendorVoice(
    playerX: number,
    playerZ: number,
    isDriving: boolean
  ): VendorVoiceCandidate | null {
    if (isDriving || this.globalVendorCooldown > 0) return null;
    const match = findNearestVendorVoiceCandidate(playerX, playerZ, this.vendorCooldowns, 22);
    if (!match) return null;

    this.vendorCooldowns.set(match.shopId, 14.0);
    this.globalVendorCooldown = 5.2;
    return match;
  }

  public findNearbyTalkNpc(playerX: number, playerZ: number, radiusM = 6.5): { id: string; roleLabel: string; distanceM: number } | null {
    let best: NpcAgent | null = null;
    let bestDist = radiusM;
    const limit = Math.min(this.activeCount, this.agents.length);
    for (let i = 0; i < limit; i++) {
      const a = this.agents[i];
      if (!a.group.visible) continue;
      const d = Math.hypot(a.x - playerX, a.z - playerZ);
      if (d <= bestDist) {
        bestDist = d;
        best = a;
      }
    }
    if (!best) return null;
    return {
      id: best.id,
      roleLabel: getNpcRoleLabel(best.activity),
      distanceM: Math.round(bestDist * 10) / 10,
    };
  }

  public evaluateProximityGreeting(
    playerX: number,
    playerZ: number,
    isDriving: boolean,
    radiusM = 6.5
  ): NpcGreetingEvent | null {
    if (isDriving || this.globalGreetCooldown > 0) return null;

    const match = findProximityGreetingCandidate(this.agents, this.activeCount, playerX, playerZ, radiusM);
    if (!match) return null;

    const a = match.agent;
    a.greetCooldown = 18;
    a.pauseTimer = 1.6;
    a.yaw = Math.atan2(playerX - a.x, playerZ - a.z);
    a.group.rotation.y = a.yaw;
    this.globalGreetCooldown = 3.4;

    const sample = selectChittagonianGreeting(a.activity, Math.random(), this.lastGreetingId);
    this.lastGreetingId = sample.id;

    return {
      npcId: a.id,
      npcX: a.x,
      npcY: a.y,
      npcZ: a.z,
      roleLabel: getNpcRoleLabel(a.activity),
      bengaliText: sample.bengaliText,
      romanized: sample.romanized,
      englishMeaning: sample.englishMeaning,
      distanceM: match.distanceM,
      isManual: false,
    };
  }

  public triggerManualGreeting(playerX: number, playerZ: number): NpcGreetingEvent | null {
    let best: NpcAgent | null = null;
    let bestDist = 11.5;
    const limit = Math.min(this.activeCount, this.agents.length);
    for (let i = 0; i < limit; i++) {
      const a = this.agents[i];
      const d = Math.hypot(a.x - playerX, a.z - playerZ);
      if (d <= bestDist) {
        bestDist = d;
        best = a;
      }
    }
    if (!best) return null;

    best.greetCooldown = 12;
    best.pauseTimer = 2.0;
    best.yaw = Math.atan2(playerX - best.x, playerZ - best.z);
    best.group.rotation.y = best.yaw;
    this.globalGreetCooldown = 2.0;

    const act = best.role === 'vendor' ? 'shop' : best.activity;
    const sample = selectChittagonianGreeting(act, Math.random(), this.lastGreetingId);
    this.lastGreetingId = sample.id;

    return {
      npcId: best.id,
      npcX: best.x,
      npcY: best.y,
      npcZ: best.z,
      roleLabel: getNpcRoleLabel(act),
      bengaliText: sample.bengaliText,
      romanized: sample.romanized,
      englishMeaning: sample.englishMeaning,
      distanceM: Math.round(bestDist * 10) / 10,
      isManual: true,
    };
  }

  public getAgentWorldPosition(npcId: string): { x: number; y: number; z: number } | null {
    const found = this.agents.find((a) => a.id === npcId);
    if (!found) return null;
    return { x: found.x, y: found.y, z: found.z };
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
