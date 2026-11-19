export type SleepPhase =
  | 'idle'
  | 'walking_to_bed'
  | 'lying_down'
  | 'fading_out'
  | 'sleeping_screen'
  | 'fading_in'
  | 'waking_up';

export interface SleepSequenceState {
  phase: SleepPhase;
  phaseTimer: number;
  fadeOpacity: number; // 0..1 black screen
  loadingProgress: number; // 0..100 for "Sleeping..." loading UI
  sleepDurationHours: number;
  timeApplied: boolean;
  startX: number;
  startZ: number;
  bedSideX: number;
  bedSideZ: number;
  mattressX: number;
  mattressZ: number;
  bedSurfaceY: number;
  floorStandingY: number;
}

export function createIdleSleepState(): SleepSequenceState {
  return {
    phase: 'idle',
    phaseTimer: 0,
    fadeOpacity: 0,
    loadingProgress: 0,
    sleepDurationHours: 7.5,
    timeApplied: false,
    startX: 0,
    startZ: 0,
    bedSideX: 0,
    bedSideZ: 0,
    mattressX: 0,
    mattressZ: 0,
    bedSurfaceY: 0,
    floorStandingY: 0,
  };
}

export function startSleepSequence(
  opts: {
    startX: number;
    startZ: number;
    bedSideX: number;
    bedSideZ: number;
    mattressX: number;
    mattressZ: number;
    bedSurfaceY: number;
    floorStandingY: number;
    sleepDurationHours?: number;
  }
): SleepSequenceState {
  return {
    phase: 'walking_to_bed',
    phaseTimer: 0,
    fadeOpacity: 0,
    loadingProgress: 0,
    sleepDurationHours: opts.sleepDurationHours ?? 7.5,
    timeApplied: false,
    startX: opts.startX,
    startZ: opts.startZ,
    bedSideX: opts.bedSideX,
    bedSideZ: opts.bedSideZ,
    mattressX: opts.mattressX,
    mattressZ: opts.mattressZ,
    bedSurfaceY: opts.bedSurfaceY,
    floorStandingY: opts.floorStandingY,
  };
}

export interface SleepStepOutput {
  state: SleepSequenceState;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerYaw: number;
  lieAmount: number; // 0 = standing, 1 = lying flat on bed
  isMoving: boolean;
  applyRestNow: boolean; // true on exact transition frame when time/energy advance
  justWokeUp: boolean;
}

export function stepSleepSequence(
  cur: SleepSequenceState,
  dt: number,
  bedFacingYaw: number
): SleepStepOutput {
  if (cur.phase === 'idle') {
    return {
      state: cur,
      playerX: cur.bedSideX,
      playerY: cur.floorStandingY,
      playerZ: cur.bedSideZ,
      playerYaw: bedFacingYaw,
      lieAmount: 0,
      isMoving: false,
      applyRestNow: false,
      justWokeUp: false,
    };
  }

  const next: SleepSequenceState = { ...cur, phaseTimer: cur.phaseTimer + dt };
  let playerX = cur.mattressX;
  let playerY = cur.floorStandingY;
  let playerZ = cur.mattressZ;
  let playerYaw = bedFacingYaw;
  let lieAmount = 0;
  let isMoving = false;
  let applyRestNow = false;
  let justWokeUp = false;

  if (next.phase === 'walking_to_bed') {
    const dur = 0.75;
    const t = Math.min(1, next.phaseTimer / dur);
    playerX = cur.startX + (cur.bedSideX - cur.startX) * t;
    playerZ = cur.startZ + (cur.bedSideZ - cur.startZ) * t;
    playerY = cur.floorStandingY;
    playerYaw = Math.atan2(cur.bedSideX - cur.startX, cur.bedSideZ - cur.startZ);
    if (Math.hypot(cur.bedSideX - cur.startX, cur.bedSideZ - cur.startZ) < 0.08) {
      playerYaw = bedFacingYaw;
    }
    isMoving = t < 0.96;
    if (t >= 1) {
      next.phase = 'lying_down';
      next.phaseTimer = 0;
    }
  } else if (next.phase === 'lying_down') {
    const dur = 0.85;
    const t = Math.min(1, next.phaseTimer / dur);
    const smooth = t * t * (3 - 2 * t);
    playerX = cur.bedSideX + (cur.mattressX - cur.bedSideX) * smooth;
    playerZ = cur.bedSideZ + (cur.mattressZ - cur.bedSideZ) * smooth;
    playerY = cur.floorStandingY + (cur.bedSurfaceY - cur.floorStandingY) * smooth;
    playerYaw = bedFacingYaw;
    lieAmount = smooth;
    if (t >= 1) {
      next.phase = 'fading_out';
      next.phaseTimer = 0;
    }
  } else if (next.phase === 'fading_out') {
    const dur = 0.55;
    const t = Math.min(1, next.phaseTimer / dur);
    next.fadeOpacity = t;
    playerX = cur.mattressX;
    playerZ = cur.mattressZ;
    playerY = cur.bedSurfaceY;
    lieAmount = 1;
    if (t >= 1) {
      next.phase = 'sleeping_screen';
      next.phaseTimer = 0;
      next.fadeOpacity = 1;
      next.loadingProgress = 5;
    }
  } else if (next.phase === 'sleeping_screen') {
    const dur = 1.65;
    const t = Math.min(1, next.phaseTimer / dur);
    next.fadeOpacity = 1;
    next.loadingProgress = Math.round(t * 100);
    playerX = cur.mattressX;
    playerZ = cur.mattressZ;
    playerY = cur.bedSurfaceY;
    lieAmount = 1;
    if (!next.timeApplied && t >= 0.45) {
      next.timeApplied = true;
      applyRestNow = true;
    }
    if (t >= 1) {
      next.phase = 'fading_in';
      next.phaseTimer = 0;
      next.loadingProgress = 100;
    }
  } else if (next.phase === 'fading_in') {
    const dur = 0.55;
    const t = Math.min(1, next.phaseTimer / dur);
    next.fadeOpacity = 1 - t;
    playerX = cur.mattressX;
    playerZ = cur.mattressZ;
    playerY = cur.bedSurfaceY;
    lieAmount = 1;
    if (t >= 1) {
      next.phase = 'waking_up';
      next.phaseTimer = 0;
      next.fadeOpacity = 0;
    }
  } else if (next.phase === 'waking_up') {
    const dur = 0.85;
    const t = Math.min(1, next.phaseTimer / dur);
    const smooth = t * t * (3 - 2 * t);
    playerX = cur.mattressX + (cur.bedSideX - cur.mattressX) * smooth;
    playerZ = cur.mattressZ + (cur.bedSideZ - cur.mattressZ) * smooth;
    playerY = cur.bedSurfaceY + (cur.floorStandingY - cur.bedSurfaceY) * smooth;
    playerYaw = bedFacingYaw;
    lieAmount = 1 - smooth;
    if (t >= 1) {
      next.phase = 'idle';
      next.phaseTimer = 0;
      next.loadingProgress = 0;
      justWokeUp = true;
    }
  }

  return {
    state: next,
    playerX,
    playerY,
    playerZ,
    playerYaw,
    lieAmount,
    isMoving,
    applyRestNow,
    justWokeUp,
  };
}
