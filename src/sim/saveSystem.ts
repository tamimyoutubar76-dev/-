import {
  DEFAULT_SPAWN,
  PlayerSaveData,
  createInitialSaveData,
} from './worldState';

const DB_NAME = 'chattogram_lalkhan_bazar_v1';
const STORE_NAME = 'saves';
const SAVE_KEY = 'primary_profile';
const LOCAL_MIRROR_KEY = 'chattogram_lalkhan_bazar_v2_mirror';

/**
 * Pure migration helper: upgrades pre-v3 saves to v3 while guaranteeing
 * character identity, companion fixed identity, permanent home integrity,
 * and initial Ameen Center front-entrance spawn for returning pre-v3 sessions.
 */
export function migrateSaveData(raw: Partial<PlayerSaveData> | null | undefined): PlayerSaveData {
  const base = createInitialSaveData();
  if (!raw || typeof raw !== 'object') return base;

  const isPreV3 = !raw.saveVersion || raw.saveVersion < 3;

  return {
    ...base,
    ...raw,
    saveVersion: 3,
    homeBuildingId: 'amin_centre',
    x: isPreV3 ? DEFAULT_SPAWN.x : typeof raw.x === 'number' ? raw.x : base.x,
    y: isPreV3 ? 0 : typeof raw.y === 'number' ? raw.y : base.y,
    z: isPreV3 ? DEFAULT_SPAWN.z : typeof raw.z === 'number' ? raw.z : base.z,
    yaw: isPreV3 ? DEFAULT_SPAWN.yaw : typeof raw.yaw === 'number' ? raw.yaw : base.yaw,
    insideLandmarkId: isPreV3 ? null : (raw.insideLandmarkId ?? null),
    currentFloor: isPreV3 ? 0 : (typeof raw.currentFloor === 'number' ? raw.currentFloor : 0),
    characterIdentity: base.characterIdentity, // Always keep fixed protagonist identity
    visitedLandmarks: Array.isArray(raw.visitedLandmarks) && raw.visitedLandmarks.length > 0
      ? Array.from(new Set([...raw.visitedLandmarks, 'amin_centre']))
      : base.visitedLandmarks,
    inventory: Array.isArray(raw.inventory) ? raw.inventory : base.inventory,
    ownedVehicles: Array.isArray(raw.ownedVehicles) ? raw.ownedVehicles : base.ownedVehicles,
    completedMissions: Array.isArray(raw.completedMissions) ? raw.completedMissions : base.completedMissions,
    apartmentState: {
      ...base.apartmentState,
      ...(raw.apartmentState || {}),
      storedItems: Array.isArray(raw.apartmentState?.storedItems)
        ? raw.apartmentState!.storedItems
        : base.apartmentState.storedItems,
    },
    companion: isPreV3
      ? {
          ...base.companion,
        }
      : {
          ...base.companion,
          ...(raw.companion || {}),
          // Companion identity & name remain permanently fixed
          id: base.companion.id,
          name: base.companion.name,
          bengaliName: base.companion.bengaliName,
        },
    settings: {
      ...base.settings,
      ...(raw.settings || {}),
    },
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function saveWorldProgressSyncMirror(data: PlayerSaveData): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_MIRROR_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function saveWorldProgress(data: PlayerSaveData): Promise<void> {
  const normalized = migrateSaveData(data);
  saveWorldProgressSyncMirror(normalized);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(normalized, SAVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Sync mirror in localStorage already written above
  }
}

export async function loadWorldProgress(): Promise<PlayerSaveData> {
  try {
    if (typeof localStorage !== 'undefined') {
      const mirrorRaw = localStorage.getItem(LOCAL_MIRROR_KEY);
      if (mirrorRaw) {
        const parsed = JSON.parse(mirrorRaw) as Partial<PlayerSaveData>;
        if (parsed && typeof parsed.x === 'number' && typeof parsed.z === 'number') {
          return migrateSaveData(parsed);
        }
      }
    }
  } catch {
    // Continue to IndexedDB fallback
  }

  try {
    const db = await openDb();
    const res = await new Promise<PlayerSaveData | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(SAVE_KEY);
      req.onsuccess = () => resolve(req.result as PlayerSaveData | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (res && typeof res.x === 'number' && typeof res.z === 'number') {
      return migrateSaveData(res);
    }
  } catch {
    // Ignore
  }

  return createInitialSaveData();
}

export async function resetWorldProgress(): Promise<PlayerSaveData> {
  const fresh = createInitialSaveData();
  await saveWorldProgress(fresh);
  return fresh;
}
