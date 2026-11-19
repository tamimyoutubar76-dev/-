import * as THREE from 'three';
import { VERIFIED_BUS_STOPS } from '../gis/landmarks';
import { DriveableLane, getLaneLateralOffset } from '../sim/roadGraph';
import {
  TrafficIntersection,
  computeVehicleTargetSpeed,
  findUTurnTransferTarget,
  resolveVehiclePairCollision,
} from '../sim/trafficRules';
import { isInsideUTurnOpening } from '../sim/roadBarriers';
import { WorldCollisionGrid } from '../sim/collision';
import { resolveSupportSurfaceHeight, getTerrainHeight } from '../sim/terrain';
import { VehicleType } from '../sim/worldState';
import { ProceduralTexturePack } from './textures';

export interface WorldVehicle {
  id: string;
  type: VehicleType;
  label: string;
  bengaliLabel: string;
  group: THREE.Group;
  wheels: THREE.Mesh[];
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  maxSpeed: number;
  radius: number;
  isPlayerDriven: boolean;
  isParkedStart: boolean;
  lane: DriveableLane | null;
  segIdx: number;
  segT: number;
  forwardDir: 1 | -1;
  onFlyover: boolean;
  busStopTimer: number;
  lastStopId: string;
  uTurnCooldown: number;
}

function getVehicleRadius(type: VehicleType): number {
  switch (type) {
    case 'bus':
      return 2.05;
    case 'car':
      return 1.32;
    case 'cng':
      return 0.98;
    case 'rickshaw':
      return 0.85;
    case 'motorbike':
      return 0.72;
  }
}

function lerpAngle(current: number, target: number, alpha: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, alpha);
}

function createVehicleMesh(
  type: VehicleType,
  contactShadowTex: THREE.Texture,
  disposables: { dispose: () => void }[]
): { group: THREE.Group; wheels: THREE.Mesh[] } {
  const g = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.85, metalness: 0.1 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x263745, roughness: 0.15, metalness: 0.65 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff3c4,
    emissive: 0xffd570,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xd92626,
    emissive: 0xb51818,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.45,
  });
  disposables.push(wheelMat, glassMat, lampMat, tailMat, shadowMat);

  const addWheel = (wx: number, wy: number, wz: number, r: number, w: number) => {
    const wg = new THREE.CylinderGeometry(r, r, w, 12);
    wg.rotateZ(Math.PI / 2);
    disposables.push(wg);
    const wm = new THREE.Mesh(wg, wheelMat);
    wm.position.set(wx, wy, wz);
    g.add(wm);
    wheels.push(wm);
  };

  if (type === 'cng') {
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x117a48, roughness: 0.42, metalness: 0.35 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x202529, roughness: 0.82, metalness: 0.05 });
    const yellowTrim = new THREE.MeshStandardMaterial({ color: 0xe6b635, roughness: 0.5 });
    disposables.push(greenMat, canopyMat, yellowTrim);

    const bodyGeo = new THREE.BoxGeometry(1.38, 0.78, 2.35);
    const noseGeo = new THREE.BoxGeometry(1.12, 0.72, 0.75);
    const roofGeo = new THREE.BoxGeometry(1.36, 0.58, 2.15);
    const winGeo = new THREE.BoxGeometry(1.06, 0.48, 0.08);
    const lampGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const shGeo = new THREE.CircleGeometry(1.45, 16);
    shGeo.rotateX(-Math.PI / 2);
    disposables.push(bodyGeo, noseGeo, roofGeo, winGeo, lampGeo, shGeo);

    const body = new THREE.Mesh(bodyGeo, greenMat);
    body.position.set(0, 0.64, -0.15);
    body.castShadow = true;
    const nose = new THREE.Mesh(noseGeo, yellowTrim);
    nose.position.set(0, 0.62, 1.08);
    const roof = new THREE.Mesh(roofGeo, canopyMat);
    roof.position.set(0, 1.32, -0.1);
    const win = new THREE.Mesh(winGeo, glassMat);
    win.position.set(0, 1.18, 0.96);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(0, 0.68, 1.46);
    const sh = new THREE.Mesh(shGeo, shadowMat);
    sh.position.y = 0.02;

    addWheel(0, 0.24, 1.05, 0.24, 0.16);
    addWheel(-0.66, 0.24, -0.82, 0.24, 0.16);
    addWheel(0.66, 0.24, -0.82, 0.24, 0.16);
    g.add(sh, body, nose, roof, win, lamp);
  } else if (type === 'bus') {
    const busColors = [0xb82e2b, 0x1c698c, 0x247348];
    const bodyCol = busColors[Math.floor(Math.random() * busColors.length)];
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.48, metalness: 0.25 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf2ece1, roughness: 0.5 });
    disposables.push(bodyMat, stripeMat);

    const hullGeo = new THREE.BoxGeometry(2.45, 2.25, 8.2);
    const stripeGeo = new THREE.BoxGeometry(2.48, 0.45, 8.22);
    const glassBandGeo = new THREE.BoxGeometry(2.47, 0.68, 7.6);
    const frontWinGeo = new THREE.BoxGeometry(2.2, 0.85, 0.08);
    const rackGeo = new THREE.BoxGeometry(2.0, 0.22, 5.2);
    const headGeo = new THREE.BoxGeometry(0.32, 0.2, 0.1);
    const shGeo = new THREE.PlaneGeometry(3.2, 9.0);
    shGeo.rotateX(-Math.PI / 2);
    disposables.push(hullGeo, stripeGeo, glassBandGeo, frontWinGeo, rackGeo, headGeo, shGeo);

    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.position.set(0, 1.58, 0);
    hull.castShadow = true;
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 1.35, 0);
    const gBand = new THREE.Mesh(glassBandGeo, glassMat);
    gBand.position.set(0, 2.15, 0);
    const fWin = new THREE.Mesh(frontWinGeo, glassMat);
    fWin.position.set(0, 2.12, 4.11);
    const rack = new THREE.Mesh(rackGeo, stripeMat);
    rack.position.set(0, 2.82, -0.5);

    const hl1 = new THREE.Mesh(headGeo, lampMat);
    hl1.position.set(-0.85, 0.85, 4.11);
    const hl2 = new THREE.Mesh(headGeo, lampMat);
    hl2.position.set(0.85, 0.85, 4.11);
    const tl1 = new THREE.Mesh(headGeo, tailMat);
    tl1.position.set(-0.85, 0.9, -4.11);
    const tl2 = new THREE.Mesh(headGeo, tailMat);
    tl2.position.set(0.85, 0.9, -4.11);

    const sh = new THREE.Mesh(shGeo, shadowMat);
    sh.position.y = 0.02;

    addWheel(-1.12, 0.48, 2.55, 0.48, 0.3);
    addWheel(1.12, 0.48, 2.55, 0.48, 0.3);
    addWheel(-1.12, 0.48, -2.45, 0.48, 0.3);
    addWheel(1.12, 0.48, -2.45, 0.48, 0.3);
    g.add(sh, hull, stripe, gBand, fWin, rack, hl1, hl2, tl1, tl2);
  } else if (type === 'rickshaw') {
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0xc93250, roughness: 0.72 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e5c8a, roughness: 0.45, metalness: 0.4 });
    disposables.push(hoodMat, frameMat);

    const seatGeo = new THREE.BoxGeometry(1.02, 0.45, 0.95);
    const hoodGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.02, 10, 1, false, 0, Math.PI);
    hoodGeo.rotateZ(Math.PI / 2);
    const frameGeo = new THREE.BoxGeometry(0.18, 0.25, 1.6);
    const shGeo = new THREE.CircleGeometry(1.25, 14);
    shGeo.rotateX(-Math.PI / 2);
    disposables.push(seatGeo, hoodGeo, frameGeo, shGeo);

    const seat = new THREE.Mesh(seatGeo, frameMat);
    seat.position.set(0, 0.65, -0.45);
    const hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.set(0, 1.12, -0.48);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 0.55, 0.45);
    const sh = new THREE.Mesh(shGeo, shadowMat);
    sh.position.y = 0.02;

    addWheel(0, 0.34, 1.05, 0.34, 0.08);
    addWheel(-0.56, 0.34, -0.55, 0.34, 0.08);
    addWheel(0.56, 0.34, -0.55, 0.34, 0.08);
    g.add(sh, seat, hood, frame);
  } else if (type === 'motorbike') {
    const bikeColors = [0x21262c, 0x992323, 0x1e4c85];
    const bikeMat = new THREE.MeshStandardMaterial({
      color: bikeColors[Math.floor(Math.random() * bikeColors.length)],
      roughness: 0.32,
      metalness: 0.6,
    });
    disposables.push(bikeMat);

    const chassisGeo = new THREE.BoxGeometry(0.38, 0.48, 1.45);
    const tankGeo = new THREE.BoxGeometry(0.42, 0.3, 0.58);
    const barGeo = new THREE.BoxGeometry(0.76, 0.08, 0.12);
    const lampGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const shGeo = new THREE.CircleGeometry(0.95, 12);
    shGeo.rotateX(-Math.PI / 2);
    disposables.push(chassisGeo, tankGeo, barGeo, lampGeo, shGeo);

    const chassis = new THREE.Mesh(chassisGeo, bikeMat);
    chassis.position.set(0, 0.62, 0);
    const tank = new THREE.Mesh(tankGeo, bikeMat);
    tank.position.set(0, 0.92, 0.25);
    const bar = new THREE.Mesh(barGeo, wheelMat);
    bar.position.set(0, 1.08, 0.56);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(0, 0.95, 0.74);
    const sh = new THREE.Mesh(shGeo, shadowMat);
    sh.position.y = 0.02;

    addWheel(0, 0.32, 0.68, 0.32, 0.14);
    addWheel(0, 0.32, -0.68, 0.32, 0.14);
    g.add(sh, chassis, tank, bar, lamp);
  } else {
    const carColors = [0xe8ecee, 0x2b3642, 0x7b2d2d, 0x455a64, 0x9e8c6b];
    const paintMat = new THREE.MeshStandardMaterial({
      color: carColors[Math.floor(Math.random() * carColors.length)],
      roughness: 0.28,
      metalness: 0.55,
    });
    disposables.push(paintMat);

    const bodyGeo = new THREE.BoxGeometry(1.78, 0.68, 4.15);
    const cabinGeo = new THREE.BoxGeometry(1.56, 0.58, 2.05);
    const headGeo = new THREE.BoxGeometry(0.28, 0.16, 0.08);
    const shGeo = new THREE.PlaneGeometry(2.2, 4.6);
    shGeo.rotateX(-Math.PI / 2);
    disposables.push(bodyGeo, cabinGeo, headGeo, shGeo);

    const body = new THREE.Mesh(bodyGeo, paintMat);
    body.position.set(0, 0.6, 0);
    body.castShadow = true;
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.18, -0.15);
    const hl1 = new THREE.Mesh(headGeo, lampMat);
    hl1.position.set(-0.62, 0.68, 2.08);
    const hl2 = new THREE.Mesh(headGeo, lampMat);
    hl2.position.set(0.62, 0.68, 2.08);
    const tl1 = new THREE.Mesh(headGeo, tailMat);
    tl1.position.set(-0.62, 0.72, -2.08);
    const tl2 = new THREE.Mesh(headGeo, tailMat);
    tl2.position.set(0.62, 0.72, -2.08);
    const sh = new THREE.Mesh(shGeo, shadowMat);
    sh.position.y = 0.02;

    addWheel(-0.84, 0.32, 1.25, 0.32, 0.22);
    addWheel(0.84, 0.32, 1.25, 0.32, 0.22);
    addWheel(-0.84, 0.32, -1.25, 0.32, 0.22);
    addWheel(0.84, 0.32, -1.25, 0.32, 0.22);
    g.add(sh, body, cabin, hl1, hl2, tl1, tl2);
  }

  return { group: g, wheels };
}

export class VehicleAndTrafficSystem {
  public vehicles: WorldVehicle[] = [];
  private intersections: TrafficIntersection[];
  private disposables: { dispose: () => void }[] = [];

  constructor(
    scene: THREE.Scene,
    lanes: DriveableLane[],
    textures: ProceduralTexturePack,
    intersections: TrafficIntersection[] = []
  ) {
    this.intersections = intersections;

    // 1. Parked driveable hero vehicles around Ispahani Circle, Lalkhan Bazar & New Market Entrance
    const parkedSpecs: { type: VehicleType; label: string; bn: string; x: number; z: number; yaw: number; maxSpd: number }[] = [
      { type: 'cng', label: 'Chattogram CNG Auto', bn: 'সিএনজি অটোরিকশা', x: 256, z: 334, yaw: -0.45, maxSpd: 18 },
      { type: 'car', label: 'Private Sedan', bn: 'প্রাইভেট কার', x: 274, z: 304, yaw: -0.5, maxSpd: 25 },
      { type: 'motorbike', label: 'City Motorbike', bn: 'মোটরসাইকেল', x: 268, z: 340, yaw: -0.55, maxSpd: 22 },
      { type: 'rickshaw', label: 'Cycle Rickshaw', bn: 'রিকশা', x: 252, z: 348, yaw: -0.4, maxSpd: 7.5 },
      { type: 'cng', label: 'Flyover Ramp CNG', bn: 'সিএনজি অটোরিকশা', x: 222, z: 374, yaw: -2.55, maxSpd: 18 },
      { type: 'cng', label: 'New Market CNG Auto', bn: 'নিউ মার্কেট সিএনজি', x: 838.8, z: 562, yaw: 0.0, maxSpd: 18 },
      { type: 'car', label: 'Biponi Bitan Sedan', bn: 'প্রাইভেট কার', x: 838.8, z: 514, yaw: Math.PI, maxSpd: 24 },
      { type: 'car', label: 'Ameen Center Private Car', bn: 'প্রাইভেট কার (বাসার গাড়ি)', x: 286.6, z: 262.4, yaw: -0.81, maxSpd: 25 },
    ];

    parkedSpecs.forEach((p, idx) => {
      const { group, wheels } = createVehicleMesh(p.type, textures.contactShadowTex, this.disposables);
      const y = getTerrainHeight(p.x, p.z);
      group.position.set(p.x, y, p.z);
      group.rotation.y = p.yaw;
      scene.add(group);
      this.vehicles.push({
        id: `parked_${idx}`,
        type: p.type,
        label: p.label,
        bengaliLabel: p.bn,
        group,
        wheels,
        x: p.x,
        y,
        z: p.z,
        yaw: p.yaw,
        speed: 0,
        maxSpeed: p.maxSpd,
        radius: getVehicleRadius(p.type),
        isPlayerDriven: false,
        isParkedStart: true,
        lane: null,
        segIdx: 0,
        segT: 0,
        forwardDir: 1,
        onFlyover: false,
        busStopTimer: 0,
        lastStopId: '',
        uTurnCooldown: 0,
      });
    });

    // 2. Live AI Traffic across ground arteries, New Market Ave, and divided flyover lanes
    const trafficDistribution: VehicleType[] = [
      'cng', 'cng', 'cng', 'car', 'car', 'bus', 'bus', 'motorbike', 'rickshaw',
      'cng', 'car', 'bus', 'cng', 'motorbike', 'car', 'bus', 'cng', 'car',
      'cng', 'bus', 'car', 'motorbike', 'cng', 'rickshaw', 'car', 'bus',
      'cng', 'car', 'motorbike', 'bus', 'cng', 'car', 'rickshaw', 'cng', 'car',
      'bus', 'motorbike', 'cng', 'car', 'cng', 'car', 'motorbike', 'bus', 'cng',
    ];

    const majorLanes = lanes.filter((l) => l.pts.length >= 2);
    if (majorLanes.length > 0) {
      trafficDistribution.forEach((vType, i) => {
        const eligibleLanes =
          vType === 'rickshaw' ? majorLanes.filter((l) => !l.bridge && l.hw !== 'trunk') : majorLanes;
        const lane = eligibleLanes[i % eligibleLanes.length] || majorLanes[0];
        const segIdx = Math.min(lane.pts.length - 2, Math.floor((i * 3) % Math.max(1, lane.pts.length - 1)));
        const segT = (i * 0.27) % 1;
        const forwardDir: 1 | -1 = !lane.oneway && i % 2 === 1 ? -1 : 1;

        const p0 = lane.pts[segIdx];
        const p1 = lane.pts[segIdx + 1];
        const sdx = p1[0] - p0[0];
        const sdz = p1[1] - p0[1];
        const sLen = Math.hypot(sdx, sdz) || 1;
        const rightX = -sdz / sLen;
        const rightZ = sdx / sLen;
        const latOff = getLaneLateralOffset(lane, forwardDir);

        const x = p0[0] + sdx * segT + rightX * latOff;
        const z = p0[1] + sdz * segT + rightZ * latOff;
        const yaw = Math.atan2(sdx * forwardDir, sdz * forwardDir);

        const sup = resolveSupportSurfaceHeight(x, z, lane.bridge ? getTerrainHeight(x, z) + 8.6 : getTerrainHeight(x, z));
        const { group, wheels } = createVehicleMesh(vType, textures.contactShadowTex, this.disposables);
        group.position.set(x, sup.y, z);
        group.rotation.y = yaw;
        scene.add(group);

        const maxSpd =
          vType === 'bus' ? 11.5 : vType === 'rickshaw' ? 4.8 : vType === 'cng' ? 13.5 : vType === 'motorbike' ? 15.0 : 14.5;

        this.vehicles.push({
          id: `ai_veh_${i}`,
          type: vType,
          label:
            vType === 'bus'
              ? 'Chattogram City Bus'
              : vType === 'cng'
                ? 'CNG Auto-Rickshaw'
                : vType === 'rickshaw'
                  ? 'Cycle Rickshaw'
                  : vType === 'motorbike'
                    ? 'Motorbike'
                    : 'Private Car',
          bengaliLabel:
            vType === 'bus'
              ? 'চট্টগ্রাম সিটি বাস'
              : vType === 'cng'
                ? 'সিএনজি অটোরিকশা'
                : vType === 'rickshaw'
                  ? 'রিকশা'
                  : vType === 'motorbike'
                    ? 'মোটরসাইকেল'
                    : 'প্রাইভেট কার',
          group,
          wheels,
          x,
          y: sup.y,
          z,
          yaw,
          speed: maxSpd * 0.7,
          maxSpeed: maxSpd,
          radius: getVehicleRadius(vType),
          isPlayerDriven: false,
          isParkedStart: false,
          lane,
          segIdx,
          segT,
          forwardDir,
          onFlyover: lane.bridge,
          busStopTimer: 0,
          lastStopId: '',
          uTurnCooldown: (i % 5) * 3.0,
        });
      });
    }
  }

  public update(
    dt: number,
    simTimeSec = 0,
    collision?: WorldCollisionGrid,
    lanes: readonly DriveableLane[] = []
  ) {
    for (let idx = 0; idx < this.vehicles.length; idx++) {
      const v = this.vehicles[idx];
      if (v.isPlayerDriven || v.isParkedStart || !v.lane) continue;

      if (v.uTurnCooldown > 0) {
        v.uTurnCooldown = Math.max(0, v.uTurnCooldown - dt);
      }

      if (v.type === 'bus' && !v.onFlyover) {
        if (v.busStopTimer > 0) {
          v.busStopTimer -= dt;
          v.speed = 0;
          continue;
        }
        for (const bs of VERIFIED_BUS_STOPS) {
          if (v.lastStopId !== bs.id && Math.hypot(v.x - bs.x, v.z - bs.z) < 16) {
            v.busStopTimer = 3.5;
            v.lastStopId = bs.id;
            v.speed = 0;
            break;
          }
        }
        if (v.busStopTimer > 0) continue;
      }

      // Check designated U-turn bay transitions on ground roads
      if (!v.onFlyover && v.uTurnCooldown <= 0 && lanes.length > 0 && idx % 4 === 0) {
        const ut = isInsideUTurnOpening(v.x, v.z);
        if (ut) {
          const transfer = findUTurnTransferTarget(v.x, v.z, v.yaw, v.lane.roadId, lanes, ut);
          if (transfer) {
            v.lane = lanes[transfer.laneIndex];
            v.segIdx = transfer.segIdx;
            v.segT = transfer.segT;
            v.forwardDir = transfer.forwardDir;
            v.uTurnCooldown = 28.0;
            v.speed = Math.min(v.speed, 5.2);
          }
        }
      }

      const { targetSpeed } = computeVehicleTargetSpeed(
        v,
        this.vehicles,
        this.intersections,
        simTimeSec,
        v.busStopTimer
      );
      if (targetSpeed < v.speed) {
        v.speed = Math.max(targetSpeed, v.speed - 12.5 * dt);
      } else {
        v.speed = Math.min(targetSpeed, v.speed + 7.5 * dt);
      }

      if (v.speed < 0.05) {
        v.speed = 0;
        continue;
      }

      const pts = v.lane.pts;
      let p0 = pts[v.segIdx];
      let p1 = pts[v.segIdx + 1];
      const segLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      v.segT += ((v.speed * dt) / segLen) * v.forwardDir;

      if (v.segT >= 1) {
        if (v.segIdx < pts.length - 2) {
          v.segIdx++;
          v.segT = 0;
        } else if (!v.lane.oneway) {
          v.forwardDir = -1;
          v.segT = 1;
          v.lastStopId = '';
        } else {
          v.segIdx = 0;
          v.segT = 0;
          v.lastStopId = '';
        }
      } else if (v.segT < 0) {
        if (v.segIdx > 0) {
          v.segIdx--;
          v.segT = 1;
        } else {
          v.forwardDir = 1;
          v.segT = 0;
          v.lastStopId = '';
        }
      }

      p0 = pts[v.segIdx];
      p1 = pts[v.segIdx + 1];
      const sdx = p1[0] - p0[0];
      const sdz = p1[1] - p0[1];
      const curLen = Math.hypot(sdx, sdz) || 1;
      const rightX = -sdz / curLen;
      const rightZ = sdx / curLen;
      const latOff = getLaneLateralOffset(v.lane, v.forwardDir);

      let nx = p0[0] + sdx * v.segT + rightX * latOff;
      let nz = p0[1] + sdz * v.segT + rightZ * latOff;

      // Enforce physical center dividers, flyover walls, buildings, and vehicle-to-vehicle separation
      if (collision) {
        const relY = v.y - getTerrainHeight(nx, nz);
        const col = collision.resolveCircle(nx, nz, v.radius * 0.88, relY, null, {
          actorAbsY: v.y,
          isVehicle: true,
        });
        nx = col.x;
        nz = col.z;
      }

      const vCol = resolveVehiclePairCollision(nx, v.y, nz, v.radius, this.vehicles, v.id);
      v.x = vCol.x;
      v.z = vCol.z;

      const targetYaw = Math.atan2(sdx * v.forwardDir, sdz * v.forwardDir);
      v.yaw = lerpAngle(v.yaw, targetYaw, dt * 8.5);

      const sup = resolveSupportSurfaceHeight(
        v.x,
        v.z,
        v.lane.bridge ? getTerrainHeight(v.x, v.z) + 8.6 : getTerrainHeight(v.x, v.z)
      );
      v.y = sup.y;
      v.onFlyover = sup.onFlyover;

      v.group.position.set(v.x, v.y, v.z);
      v.group.rotation.y = v.yaw;

      const spin = v.speed * dt * 2.4;
      for (const w of v.wheels) {
        w.rotation.x += spin;
      }
    }
  }

  public findNearestInteractableVehicle(px: number, py: number, pz: number, maxDist = 4.6): WorldVehicle | null {
    let best: WorldVehicle | null = null;
    let bestD = maxDist;
    for (const v of this.vehicles) {
      if (v.isPlayerDriven) continue;
      if (Math.abs(v.y - py) > 3.2) continue;
      const d = Math.hypot(v.x - px, v.z - pz);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
