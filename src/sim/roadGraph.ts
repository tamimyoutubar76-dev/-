import { GIS_DATA, GisRoad } from '../gis/projection';
import { NEW_MARKET_CONNECTOR_ROADS } from './newMarketAndShops';

export interface RoadNode {
  id: string;
  x: number;
  z: number;
  neighbors: { toId: string; roadId: string; dist: number; hw: string; bridge: boolean; oneway: boolean }[];
}

export interface DriveableLane {
  roadId: string;
  name: string;
  hw: string;
  bridge: boolean;
  oneway: boolean;
  pts: [number, number][];
  totalLength: number;
}

export function getLaneLateralOffset(lane: Pick<DriveableLane, 'hw' | 'bridge' | 'oneway'>, forwardDir: 1 | -1): number {
  if (lane.bridge) {
    // Wide flyover decks have a solid center divider -> strictly separate opposite lanes by ±2.45m
    return lane.hw === 'trunk_link' ? 0 : 2.45 * forwardDir;
  }
  if (lane.oneway) {
    // One-way CDA dual-carriageway lanes already run along separate physical centerlines
    return 0;
  }
  if (lane.hw === 'secondary' || lane.hw === 'tertiary' || lane.hw === 'trunk') {
    return 1.9 * forwardDir;
  }
  return 0.9 * forwardDir;
}

export function getRoadWidth(hw: string): number {
  switch (hw) {
    case 'trunk':
      return 12.5;
    case 'primary':
      return 10.5;
    case 'trunk_link':
    case 'secondary':
      return 9.2;
    case 'secondary_link':
    case 'tertiary':
      return 7.6;
    case 'unclassified':
    case 'residential':
      return 5.6;
    case 'living_street':
    case 'service':
      return 4.4;
    case 'pedestrian':
    case 'footway':
      return 2.6;
    case 'steps':
    case 'path':
      return 2.0;
    default:
      return 4.5;
  }
}

export function isDriveableHighway(hw: string): boolean {
  return (
    hw === 'trunk' ||
    hw === 'trunk_link' ||
    hw === 'primary' ||
    hw === 'secondary' ||
    hw === 'secondary_link' ||
    hw === 'tertiary' ||
    hw === 'unclassified' ||
    hw === 'residential' ||
    hw === 'living_street' ||
    hw === 'service'
  );
}

export function isMajorArtery(hw: string): boolean {
  return hw === 'trunk' || hw === 'trunk_link' || hw === 'primary' || hw === 'secondary' || hw === 'tertiary';
}

export interface RoadGraph {
  nodes: Map<string, RoadNode>;
  driveableLanes: DriveableLane[];
  connectedComponents: number;
  largestComponentNodes: number;
}

function snapKey(x: number, z: number): string {
  return `${Math.round(x * 2) / 2},${Math.round(z * 2) / 2}`;
}

export function buildRoadGraph(roads: GisRoad[] = [...GIS_DATA.roads, ...NEW_MARKET_CONNECTOR_ROADS]): RoadGraph {
  const nodes = new Map<string, RoadNode>();
  const driveableLanes: DriveableLane[] = [];

  const getOrCreate = (x: number, z: number, layer: number): RoadNode => {
    const key = `${snapKey(x, z)}|${layer > 0 ? 1 : 0}`;
    let n = nodes.get(key);
    if (!n) {
      n = { id: key, x, z, neighbors: [] };
      nodes.set(key, n);
    }
    return n;
  };

  for (const r of roads) {
    if (r.pts.length < 2) continue;
    let totalLen = 0;
    const layerKey = r.bridge ? 1 : 0;

    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, z1] = r.pts[i];
      const [x2, z2] = r.pts[i + 1];
      const d = Math.hypot(x2 - x1, z2 - z1);
      totalLen += d;

      const n1 = getOrCreate(x1, z1, layerKey);
      const n2 = getOrCreate(x2, z2, layerKey);
      if (n1.id !== n2.id) {
        n1.neighbors.push({ toId: n2.id, roadId: r.id, dist: d, hw: r.hw, bridge: r.bridge, oneway: r.oneway });
        if (!r.oneway) {
          n2.neighbors.push({ toId: n1.id, roadId: r.id, dist: d, hw: r.hw, bridge: r.bridge, oneway: false });
        }
      }
    }

    if (isMajorArtery(r.hw) && totalLen >= 25) {
      driveableLanes.push({
        roadId: r.id,
        name: r.name || r.hw,
        hw: r.hw,
        bridge: r.bridge,
        oneway: r.oneway,
        pts: r.pts,
        totalLength: totalLen,
      });
    }
  }

  const visited = new Set<string>();
  const adj = new Map<string, string[]>();
  for (const [id, node] of nodes) {
    if (!adj.has(id)) adj.set(id, []);
    for (const e of node.neighbors) {
      adj.get(id)!.push(e.toId);
      if (!adj.has(e.toId)) adj.set(e.toId, []);
      adj.get(e.toId)!.push(id);
    }
  }

  let connectedComponents = 0;
  let largestComponentNodes = 0;
  for (const id of nodes.keys()) {
    if (visited.has(id)) continue;
    connectedComponents++;
    const queue = [id];
    visited.add(id);
    let size = 0;
    while (queue.length > 0) {
      const cur = queue.pop()!;
      size++;
      for (const nxt of adj.get(cur) || []) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          queue.push(nxt);
        }
      }
    }
    if (size > largestComponentNodes) largestComponentNodes = size;
  }

  return { nodes, driveableLanes, connectedComponents, largestComponentNodes };
}

const ALL_NAMED_ROADS: GisRoad[] = [...GIS_DATA.roads, ...NEW_MARKET_CONNECTOR_ROADS];

export function findNearestRoadName(x: number, z: number, roads: GisRoad[] = ALL_NAMED_ROADS): string {
  let bestDist = Infinity;
  let bestName = '';
  for (const r of roads) {
    if (!r.name) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, z1] = r.pts[i];
      const [x2, z2] = r.pts[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const lenSq = dx * dx + dz * dz;
      const t = lenSq > 0 ? Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / lenSq)) : 0;
      const d = Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz));
      if (d < bestDist) {
        bestDist = d;
        bestName = r.name;
      }
    }
  }
  return bestDist < 38 ? bestName : '';
}
