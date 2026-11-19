import { GIS_DATA } from '../gis/projection';
import { VERIFIED_LANDMARKS, LandmarkRecord } from '../gis/landmarks';
import { ROAD_BARRIERS, SegmentBarrierCollider, BarrierKind } from './roadBarriers';
import { ROADSIDE_AND_NEW_MARKET_SHOPS } from './newMarketAndShops';
import { AMEEN_CENTER_SPEC, isOverlappingAmeenCenterSite, resolveAmeenCenterInterior } from './ameenCenter';

export interface BoxCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
  isEnterableLandmark: boolean;
}

export interface OrientedBoxCollider {
  id: string;
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  cos: number;
  sin: number;
  height: number;
}

export interface CylinderCollider {
  x: number;
  z: number;
  radius: number;
  maxY: number;
}

export interface ResolveCircleOptions {
  actorAbsY?: number;
  isVehicle?: boolean;
  currentFloor?: number;
}

export interface ResolveCircleResult {
  x: number;
  z: number;
  hit: boolean;
  hitBarrierKind: BarrierKind | null;
}

const CELL_SIZE = 32;

function cellKey(cx: number, cz: number): number {
  return ((cx + 256) << 12) | (cz + 256);
}

export class WorldCollisionGrid {
  private boxCells = new Map<number, BoxCollider[]>();
  private pillarCells = new Map<number, CylinderCollider[]>();
  private barrierCells = new Map<number, SegmentBarrierCollider[]>();
  private shopBoxes: OrientedBoxCollider[] = [];
  private shopCells = new Map<number, OrientedBoxCollider[]>();
  private landmarkBoxes: { lm: LandmarkRecord; halfW: number; halfD: number; cos: number; sin: number }[] = [];

  constructor() {
    // 1. Register enterable landmarks as special doorway-aware boxes (skip open-air plazas like New Market courtyard)
    for (const lm of VERIFIED_LANDMARKS) {
      if (lm.isOpenPlaza) continue;
      this.landmarkBoxes.push({
        lm,
        halfW: lm.width * 0.5,
        halfD: lm.depth * 0.5,
        cos: Math.cos(lm.yaw),
        sin: Math.sin(lm.yaw),
      });
    }

    // 2. Register all non-landmark OSM building footprints into spatial hash
    for (const b of GIS_DATA.buildings) {
      const overlapsLandmark =
        isOverlappingAmeenCenterSite(b.cx, b.cz) ||
        VERIFIED_LANDMARKS.some(
          (lm) => !lm.isOpenPlaza && Math.hypot(b.cx - lm.x, b.cz - lm.z) < Math.max(lm.width, lm.depth) * 0.68
        );
      if (overlapsLandmark) continue;

      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const [px, pz] of b.poly) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (pz < minZ) minZ = pz;
        if (pz > maxZ) maxZ = pz;
      }
      const box: BoxCollider = {
        id: b.id,
        minX: minX + 0.25,
        maxX: maxX - 0.25,
        minZ: minZ + 0.25,
        maxZ: maxZ - 0.25,
        maxY: (b.levels || 2) * 3.2,
        isEnterableLandmark: false,
      };
      if (box.maxX <= box.minX || box.maxZ <= box.minZ) continue;

      const cMinX = Math.floor(box.minX / CELL_SIZE);
      const cMaxX = Math.floor(box.maxX / CELL_SIZE);
      const cMinZ = Math.floor(box.minZ / CELL_SIZE);
      const cMaxZ = Math.floor(box.maxZ / CELL_SIZE);
      for (let gx = cMinX; gx <= cMaxX; gx++) {
        for (let gz = cMinZ; gz <= cMaxZ; gz++) {
          const k = cellKey(gx, gz);
          let arr = this.boxCells.get(k);
          if (!arr) {
            arr = [];
            this.boxCells.set(k, arr);
          }
          arr.push(box);
        }
      }
    }

    // 3. Register all Bangladeshi roadside shops & New Market stalls/wings as solid oriented colliders
    for (const s of ROADSIDE_AND_NEW_MARKET_SHOPS) {
      const ob: OrientedBoxCollider = {
        id: s.id,
        x: s.x,
        z: s.z,
        halfW: s.width * 0.5,
        halfD: s.depth * 0.5,
        cos: Math.cos(s.yaw),
        sin: Math.sin(s.yaw),
        height: s.height,
      };
      this.shopBoxes.push(ob);
      const reach = Math.hypot(ob.halfW, ob.halfD) + 2;
      const cMinX = Math.floor((s.x - reach) / CELL_SIZE);
      const cMaxX = Math.floor((s.x + reach) / CELL_SIZE);
      const cMinZ = Math.floor((s.z - reach) / CELL_SIZE);
      const cMaxZ = Math.floor((s.z + reach) / CELL_SIZE);
      for (let gx = cMinX; gx <= cMaxX; gx++) {
        for (let gz = cMinZ; gz <= cMaxZ; gz++) {
          const k = cellKey(gx, gz);
          let arr = this.shopCells.get(k);
          if (!arr) {
            arr = [];
            this.shopCells.set(k, arr);
          }
          arr.push(ob);
        }
      }
    }

    // 4. Register all physical road dividers, low jumpable pedestrian barriers, and flyover walls
    for (const bar of ROAD_BARRIERS.allBarriers) {
      const pad = bar.halfWidth + 2.5;
      const cMinX = Math.floor((Math.min(bar.x1, bar.x2) - pad) / CELL_SIZE);
      const cMaxX = Math.floor((Math.max(bar.x1, bar.x2) + pad) / CELL_SIZE);
      const cMinZ = Math.floor((Math.min(bar.z1, bar.z2) - pad) / CELL_SIZE);
      const cMaxZ = Math.floor((Math.max(bar.z1, bar.z2) + pad) / CELL_SIZE);
      for (let gx = cMinX; gx <= cMaxX; gx++) {
        for (let gz = cMinZ; gz <= cMaxZ; gz++) {
          const k = cellKey(gx, gz);
          let arr = this.barrierCells.get(k);
          if (!arr) {
            arr = [];
            this.barrierCells.set(k, arr);
          }
          arr.push(bar);
        }
      }
    }
  }

  public addPillar(x: number, z: number, radius: number, maxY: number) {
    const p: CylinderCollider = { x, z, radius, maxY };
    const gx = Math.floor(x / CELL_SIZE);
    const gz = Math.floor(z / CELL_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const k = cellKey(gx + dx, gz + dz);
        let arr = this.pillarCells.get(k);
        if (!arr) {
          arr = [];
          this.pillarCells.set(k, arr);
        }
        arr.push(p);
      }
    }
  }

  /**
   * Resolve circle collision in XZ against buildings, shops/stalls, road/flyover barriers,
   * flyover piers, and enterable landmark perimeter walls.
   */
  public resolveCircle(
    x: number,
    z: number,
    radius: number,
    actorRelY = 0,
    insideBuildingId: string | null = null,
    options: ResolveCircleOptions = {}
  ): ResolveCircleResult {
    let rx = x;
    let rz = z;
    let hit = false;
    let hitBarrierKind: BarrierKind | null = null;
    const isVehicle = Boolean(options.isVehicle);
    const actorAbsY = options.actorAbsY;

    const gx = Math.floor(rx / CELL_SIZE);
    const gz = Math.floor(rz / CELL_SIZE);

    // 1. Check OSM building boxes
    const checked = new Set<string>();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.boxCells.get(cellKey(gx + dx, gz + dz));
        if (!list) continue;
        for (const b of list) {
          if (checked.has(b.id)) continue;
          checked.add(b.id);
          if (actorRelY > b.maxY + 0.5) continue;
          const cx = Math.max(b.minX, Math.min(rx, b.maxX));
          const cz = Math.max(b.minZ, Math.min(rz, b.maxZ));
          const vx = rx - cx;
          const vz = rz - cz;
          const dSq = vx * vx + vz * vz;
          if (dSq < radius * radius) {
            hit = true;
            const d = Math.sqrt(dSq);
            if (d > 0.0001) {
              const push = radius - d;
              rx += (vx / d) * push;
              rz += (vz / d) * push;
            } else {
              const dLeft = Math.abs(rx - b.minX);
              const dRight = Math.abs(b.maxX - rx);
              const dTop = Math.abs(rz - b.minZ);
              const dBot = Math.abs(b.maxZ - rz);
              const m = Math.min(dLeft, dRight, dTop, dBot);
              if (m === dLeft) rx = b.minX - radius;
              else if (m === dRight) rx = b.maxX + radius;
              else if (m === dTop) rz = b.minZ - radius;
              else rz = b.maxZ + radius;
            }
          }
        }
      }
    }

    // 2. Check Roadside Bangladeshi Shops & New Market Stalls / Arcade Wings
    const checkedShops = new Set<string>();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const sList = this.shopCells.get(cellKey(gx + dx, gz + dz));
        if (!sList) continue;
        for (const sb of sList) {
          if (checkedShops.has(sb.id)) continue;
          checkedShops.add(sb.id);
          if (actorRelY > sb.height + 0.4) continue;

          const sdx = rx - sb.x;
          const sdz = rz - sb.z;
          const lx = sdx * sb.cos - sdz * sb.sin;
          const lz = sdx * sb.sin + sdz * sb.cos;

          const cx = Math.max(-sb.halfW, Math.min(lx, sb.halfW));
          const cz = Math.max(-sb.halfD, Math.min(lz, sb.halfD));
          const vx = lx - cx;
          const vz = lz - cz;
          const dSq = vx * vx + vz * vz;
          if (dSq < radius * radius) {
            hit = true;
            let nlx = lx;
            let nlz = lz;
            const d = Math.sqrt(dSq);
            if (d > 0.0001) {
              const push = radius - d;
              nlx += (vx / d) * push;
              nlz += (vz / d) * push;
            } else {
              const penX = sb.halfW + radius - Math.abs(lx);
              const penZ = sb.halfD + radius - Math.abs(lz);
              if (penX < penZ) nlx = lx >= 0 ? sb.halfW + radius : -(sb.halfW + radius);
              else nlz = lz >= 0 ? sb.halfD + radius : -(sb.halfD + radius);
            }
            rx = sb.x + (nlx * sb.cos + nlz * sb.sin);
            rz = sb.z + (-nlx * sb.sin + nlz * sb.cos);
          }
        }
      }
    }

    // 3. Check Road Center Dividers, Low Jumpable Barriers & Flyover Side/Center Walls
    const checkedBarriers = new Set<string>();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bList = this.barrierCells.get(cellKey(gx + dx, gz + dz));
        if (!bList) continue;
        for (const bar of bList) {
          if (checkedBarriers.has(bar.id)) continue;
          checkedBarriers.add(bar.id);

          const sdx = bar.x2 - bar.x1;
          const sdz = bar.z2 - bar.z1;
          const lenSq = sdx * sdx + sdz * sdz;
          if (lenSq < 0.0001) continue;
          const t = Math.max(0, Math.min(1, ((rx - bar.x1) * sdx + (rz - bar.z1) * sdz) / lenSq));
          const px = bar.x1 + t * sdx;
          const pz = bar.z1 + t * sdz;
          const barBaseY = bar.baseY1 + t * (bar.baseY2 - bar.baseY1);

          // Elevation gate: flyover barriers only apply when actor is at flyover deck elevation;
          // ground dividers only apply when actor is near ground elevation (not 8m overhead on flyover!)
          if (actorAbsY !== undefined) {
            if (bar.onFlyoverOnly) {
              if (actorAbsY < barBaseY - 1.35 || actorAbsY > barBaseY + bar.height + 1.6) continue;
            } else {
              if (actorAbsY > barBaseY + bar.height + 2.2) continue;
            }
          } else {
            // If caller didn't pass actorAbsY, treat flyover walls as inactive at ground relY < 3
            if (bar.onFlyoverOnly) continue;
          }

          // Jump check: pedestrians (never vehicles) can jump cleanly over designated low barriers
          const heightAboveBar = actorAbsY !== undefined ? actorAbsY - barBaseY : actorRelY;
          if (!isVehicle && bar.jumpable && heightAboveBar >= bar.height - 0.16) {
            continue;
          }

          const vx = rx - px;
          const vz = rz - pz;
          const minDist = radius + bar.halfWidth;
          const dSq = vx * vx + vz * vz;
          if (dSq < minDist * minDist) {
            hit = true;
            hitBarrierKind = bar.kind;
            const d = Math.sqrt(dSq);
            if (d > 0.0001) {
              const push = minDist - d;
              rx += (vx / d) * push;
              rz += (vz / d) * push;
            } else {
              // Exactly on centerline: push perpendicular to segment
              const len = Math.sqrt(lenSq) || 1;
              rx += (-sdz / len) * minDist;
              rz += (sdx / len) * minDist;
            }
          }
        }
      }
    }

    // 4. Check flyover piers (only if actor is below deck height)
    if (actorRelY < 8.0) {
      const pList = this.pillarCells.get(cellKey(gx, gz));
      if (pList) {
        for (const p of pList) {
          const vx = rx - p.x;
          const vz = rz - p.z;
          const minDist = radius + p.radius;
          const dSq = vx * vx + vz * vz;
          if (dSq < minDist * minDist) {
            hit = true;
            const d = Math.sqrt(dSq) || 0.001;
            const push = minDist - d;
            rx += (vx / d) * push;
            rz += (vz / d) * push;
          }
        }
      }
    }

    // 5. Enterable landmarks: solid side/back walls with open front doorway
    for (const lb of this.landmarkBoxes) {
      const { lm, halfW, halfD, cos, sin } = lb;
      const dx = rx - lm.x;
      const dz = rz - lm.z;
      const distApprox = Math.hypot(dx, dz);
      if (distApprox > Math.max(halfW, halfD) + radius + 2) continue;

      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;

      const isInsideThis = insideBuildingId === lm.id;
      const wallThick = 0.45;
      const doorHalfW = lm.id === AMEEN_CENTER_SPEC.id ? AMEEN_CENTER_SPEC.doorHalfWidth : 2.1;

      if (isInsideThis) {
        if (lm.id === AMEEN_CENTER_SPEC.id) {
          const inner = resolveAmeenCenterInterior(lx, lz, radius, options.currentFloor ?? 0);
          if (inner.hit || inner.lx !== lx || inner.lz !== lz) {
            hit = true;
            rx = lm.x + (inner.lx * cos + inner.lz * sin);
            rz = lm.z + (-inner.lx * sin + inner.lz * cos);
          }
          continue;
        }
        const inDoorX = Math.abs(lx) < doorHalfW;
        const clampedX = Math.max(-halfW + wallThick + radius, Math.min(halfW - wallThick - radius, lx));
        let clampedZ = lz;
        if (lz < -halfD + wallThick + radius) clampedZ = -halfD + wallThick + radius;
        if (lz > halfD - wallThick - radius && !inDoorX) clampedZ = halfD - wallThick - radius;

        if (clampedX !== lx || clampedZ !== lz) {
          hit = true;
          rx = lm.x + (clampedX * cos + clampedZ * sin);
          rz = lm.z + (-clampedX * sin + clampedZ * cos);
        }
      } else {
        const inDoorOpening = !isVehicle && Math.abs(lx) < doorHalfW && lz > halfD - 3.5;
        if (!inDoorOpening && Math.abs(lx) < halfW + radius && Math.abs(lz) < halfD + radius) {
          const penX = halfW + radius - Math.abs(lx);
          const penZ = halfD + radius - Math.abs(lz);
          let nlx = lx;
          let nlz = lz;
          if (penX < penZ) {
            nlx = lx >= 0 ? halfW + radius : -(halfW + radius);
          } else {
            nlz = lz >= 0 ? halfD + radius : -(halfD + radius);
          }
          hit = true;
          rx = lm.x + (nlx * cos + nlz * sin);
          rz = lm.z + (-nlx * sin + nlz * cos);
        }
      }
    }

    return { x: rx, z: rz, hit, hitBarrierKind };
  }
}
