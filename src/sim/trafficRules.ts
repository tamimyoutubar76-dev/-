import { RoadGraph } from './roadGraph';

export type TrafficAxis = 'NS' | 'EW';
export type SignalLightState = 'green' | 'red';

export interface TrafficIntersection {
  id: string;
  name: string;
  x: number;
  z: number;
  cycleSec: number;
  phaseOffsetSec: number;
  hasPhysicalPole: boolean;
}

export interface SignalEvaluation {
  nsState: SignalLightState;
  ewState: SignalLightState;
  allRedClearance: boolean;
}

export const VERIFIED_SIGNAL_SPOTS: {
  id: string;
  name: string;
  x: number;
  z: number;
  poleX: number;
  poleZ: number;
  poleYaw: number;
  phaseOffsetSec: number;
}[] = [
  {
    id: 'sig_ispahani',
    name: 'Ispahani Circle',
    x: 268.7,
    z: 324.1,
    poleX: 280,
    poleZ: 312,
    poleYaw: 0.3,
    phaseOffsetSec: 0,
  },
  {
    id: 'sig_lalkhan',
    name: 'Lalkhan Bazar Junction',
    x: 415.5,
    z: 167.3,
    poleX: 406,
    poleZ: 176,
    poleYaw: -0.45,
    phaseOffsetSec: 4.5,
  },
  {
    id: 'sig_wasa',
    name: 'WASA Square',
    x: 540.0,
    z: -145.0,
    poleX: 525,
    poleZ: -135,
    poleYaw: 0.0,
    phaseOffsetSec: 7.0,
  },
];

/**
 * Extracts key ground road intersections from the real Lalkhan Bazar OSM road graph
 * (nodes with degree >= 3 on major roads, merged within 45m) combined with verified signalized junctions.
 */
export function buildTrafficIntersections(roadGraph: RoadGraph): TrafficIntersection[] {
  const result: TrafficIntersection[] = VERIFIED_SIGNAL_SPOTS.map((s) => ({
    id: s.id,
    name: s.name,
    x: s.x,
    z: s.z,
    cycleSec: 14,
    phaseOffsetSec: s.phaseOffsetSec,
    hasPhysicalPole: true,
  }));

  let idx = 0;
  for (const node of roadGraph.nodes.values()) {
    const groundMajorNeighbors = node.neighbors.filter(
      (n) =>
        !n.bridge &&
        (n.hw === 'trunk' ||
          n.hw === 'trunk_link' ||
          n.hw === 'primary' ||
          n.hw === 'secondary' ||
          n.hw === 'tertiary')
    );
    if (groundMajorNeighbors.length < 3) continue;

    // Avoid clustering intersections closer than 52m
    const tooClose = result.some((ex) => Math.hypot(ex.x - node.x, ex.z - node.z) < 52);
    if (tooClose) continue;

    result.push({
      id: `jx_${idx++}`,
      name: `Junction ${idx}`,
      x: node.x,
      z: node.z,
      cycleSec: 14,
      phaseOffsetSec: (idx * 3.1) % 14,
      hasPhysicalPole: false,
    });
  }

  return result;
}

/**
 * Deterministic 2-phase orthogonal stop-and-go traffic signal cycle:
 * - [0, 6.2s): N-S Green, E-W Red
 * - [6.2, 7.0s): All-Red clearance
 * - [7.0, 13.2s): E-W Green, N-S Red
 * - [13.2, 14.0s): All-Red clearance
 */
export function evaluateIntersectionSignal(
  simTimeSec: number,
  cycleSec = 14,
  phaseOffsetSec = 0
): SignalEvaluation {
  const t = (((simTimeSec + phaseOffsetSec) % cycleSec) + cycleSec) % cycleSec;
  const half = cycleSec * 0.5;
  const greenWindow = half - 0.8;

  if (t < greenWindow) {
    return { nsState: 'green', ewState: 'red', allRedClearance: false };
  }
  if (t < half) {
    return { nsState: 'red', ewState: 'red', allRedClearance: true };
  }
  if (t < half + greenWindow) {
    return { nsState: 'red', ewState: 'green', allRedClearance: false };
  }
  return { nsState: 'red', ewState: 'red', allRedClearance: true };
}

export function getVehicleAxis(yaw: number): TrafficAxis {
  const dirX = Math.sin(yaw);
  const dirZ = Math.cos(yaw);
  return Math.abs(dirZ) >= Math.abs(dirX) ? 'NS' : 'EW';
}

export interface VehicleTrafficProbe {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  maxSpeed: number;
  onFlyover: boolean;
}

/**
 * Computes the target cruise/stop speed (m/s) for an autonomous AI vehicle by enforcing:
 * 1) Intersection stop-and-go rules (stop outside inner junction box on red signal, proceed on green/flyover).
 * 2) Lead-vehicle car-following spacing so vehicles queue cleanly without overlapping.
 */
export function computeVehicleTargetSpeed(
  self: VehicleTrafficProbe,
  allVehicles: readonly VehicleTrafficProbe[],
  intersections: readonly TrafficIntersection[],
  simTimeSec: number,
  busStopTimer: number
): { targetSpeed: number; stoppedBySignal: boolean; stoppedByTraffic: boolean } {
  if (busStopTimer > 0) {
    return { targetSpeed: 0, stoppedBySignal: false, stoppedByTraffic: false };
  }

  let targetSpeed = self.maxSpeed * 0.78;
  let stoppedBySignal = false;
  let stoppedByTraffic = false;

  const fwdX = Math.sin(self.yaw);
  const fwdZ = Math.cos(self.yaw);

  // 1. Ground intersection stop-and-go signal check
  if (!self.onFlyover) {
    const axis = getVehicleAxis(self.yaw);
    for (const jx of intersections) {
      const dx = jx.x - self.x;
      const dz = jx.z - self.z;
      const dist = Math.hypot(dx, dz);
      // Only check stop zone ahead of the vehicle (between 7.5m and 19m from intersection center)
      if (dist > 19.0 || dist < 7.5) continue;
      const dotAhead = (dx / dist) * fwdX + (dz / dist) * fwdZ;
      if (dotAhead < 0.55) continue;

      const sig = evaluateIntersectionSignal(simTimeSec, jx.cycleSec, jx.phaseOffsetSec);
      const myLight = axis === 'NS' ? sig.nsState : sig.ewState;
      if (myLight === 'red') {
        targetSpeed = 0;
        stoppedBySignal = true;
        break;
      }
    }
  }

  // 2. Lead-vehicle safe following distance check (queue cleanly behind stopped/slower vehicles)
  if (targetSpeed > 0) {
    for (const other of allVehicles) {
      if (other.id === self.id) continue;
      if (Math.abs(other.y - self.y) > 2.8) continue;

      const dx = other.x - self.x;
      const dz = other.z - self.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.1 || dist > 15.0) continue;

      const dotAhead = (dx / dist) * fwdX + (dz / dist) * fwdZ;
      if (dotAhead < 0.84) continue; // Only yield to vehicles directly in front lane

      // Check roughly similar direction of travel (don't stop for oncoming traffic in opposite lane)
      const oFwdX = Math.sin(other.yaw);
      const oFwdZ = Math.cos(other.yaw);
      const sameDirDot = fwdX * oFwdX + fwdZ * oFwdZ;
      if (sameDirDot < 0.45) continue;

      if (dist < 7.8) {
        targetSpeed = 0;
        stoppedByTraffic = true;
        break;
      } else if (dist < 14.0) {
        const cap = Math.max(0, other.speed * ((dist - 7.0) / 7.0));
        if (cap < targetSpeed) {
          targetSpeed = cap;
          stoppedByTraffic = true;
        }
      }
    }
  }

  return { targetSpeed, stoppedBySignal, stoppedByTraffic };
}

export interface LaneTransferCandidate {
  laneIndex: number;
  segIdx: number;
  segT: number;
  forwardDir: 1 | -1;
}

/**
 * Evaluates whether a vehicle positioned inside a designated U-turn opening can safely switch
 * to an opposing lane (or reverse direction on a divided two-way road).
 */
export function findUTurnTransferTarget(
  x: number,
  z: number,
  currentYaw: number,
  currentLaneRoadId: string,
  lanes: readonly { roadId: string; bridge: boolean; oneway: boolean; pts: [number, number][] }[],
  insideUTurn: { x: number; z: number; radius: number } | null
): LaneTransferCandidate | null {
  if (!insideUTurn) return null;
  const fwdX = Math.sin(currentYaw);
  const fwdZ = Math.cos(currentYaw);

  let best: LaneTransferCandidate | null = null;
  let bestDist = insideUTurn.radius + 10;

  for (let lIdx = 0; lIdx < lanes.length; lIdx++) {
    const lane = lanes[lIdx];
    if (lane.bridge) continue;
    for (let s = 0; s < lane.pts.length - 1; s++) {
      const [x1, z1] = lane.pts[s];
      const [x2, z2] = lane.pts[s + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const lenSq = dx * dx + dz * dz;
      if (lenSq < 0.1) continue;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / lenSq));
      const px = x1 + t * dx;
      const pz = z1 + t * dz;
      const d = Math.hypot(px - insideUTurn.x, pz - insideUTurn.z);
      if (d > bestDist) continue;

      const len = Math.sqrt(lenSq);
      const lx = dx / len;
      const lz = dz / len;
      const dot = fwdX * lx + fwdZ * lz;

      // Pick opposite direction lane!
      if (dot < -0.55) {
        bestDist = d;
        best = { laneIndex: lIdx, segIdx: s, segT: t, forwardDir: 1 };
      } else if (!lane.oneway && lane.roadId === currentLaneRoadId && dot > 0.55) {
        bestDist = d;
        best = { laneIndex: lIdx, segIdx: s, segT: t, forwardDir: -1 };
      }
    }
  }
  return best;
}

/**
 * Resolves solid physical vehicle-to-vehicle circle separation on the same vertical level.
 */
export function resolveVehiclePairCollision(
  ax: number,
  ay: number,
  az: number,
  aRadius: number,
  others: readonly { id: string; x: number; y: number; z: number; radius: number }[],
  selfId: string
): { x: number; z: number; hitVehicle: boolean } {
  let rx = ax;
  let rz = az;
  let hitVehicle = false;
  for (const o of others) {
    if (o.id === selfId) continue;
    if (Math.abs(o.y - ay) > 2.4) continue;
    const dx = rx - o.x;
    const dz = rz - o.z;
    const minDist = aRadius + o.radius;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDist * minDist) {
      hitVehicle = true;
      const d = Math.sqrt(dSq) || 0.01;
      const push = minDist - d;
      rx += (dx / d) * push;
      rz += (dz / d) * push;
    }
  }
  return { x: rx, z: rz, hitVehicle };
}
