export type VehicleGear = 'P' | 'N' | 'R' | '1' | '2' | '3' | '4' | '5';

export interface VehicleDriveInput {
  accelerate: boolean;
  brakeOrReverse: boolean;
  handbrake: boolean;
  steer: number; // -1 (right) .. +1 (left) matching world yaw += steer
}

export interface VehicleHudReadout {
  speedKmh: number;
  gear: VehicleGear;
  isReversing: boolean;
}

/**
 * Computes realistic mobile & desktop vehicle drive physics:
 * - Holding Accelerator moves forward smoothly up to +maxSpeed.
 * - Holding Brake/Reverse slows down forward speed cleanly to 0 FIRST;
 *   only once stopped (speed <= 0.15 m/s) does holding Brake/Reverse engage Reverse gear (down to -8 m/s).
 * - Releasing both coasts gently.
 */
export function stepVehicleDrivePhysics(
  currentSpeed: number,
  maxSpeed: number,
  input: VehicleDriveInput,
  dt: number
): number {
  let speed = currentSpeed;

  if (input.handbrake) {
    speed *= Math.max(0, 1 - dt * 7.2);
    if (Math.abs(speed) < 0.08) speed = 0;
    return speed;
  }

  if (input.accelerate && !input.brakeOrReverse) {
    if (speed < -0.15) {
      // Pressing gas while reversing brakes to stop smoothly first before accelerating forward
      speed = Math.min(0, speed + 16.5 * dt);
    } else {
      speed = Math.min(maxSpeed, speed + 11.8 * dt);
    }
  } else if (input.brakeOrReverse && !input.accelerate) {
    if (speed > 0.15) {
      // Pressing Brake while moving forward brakes smoothly to a standstill BEFORE reverse engages!
      speed = Math.max(0, speed - 18.0 * dt);
      if (speed < 0.05) speed = 0;
    } else {
      // Stopped or already reversing -> engage Reverse gear smoothly up to -8.0 m/s
      speed = Math.max(-8.0, speed - 7.8 * dt);
    }
  } else {
    // Coasting gently
    speed *= Math.max(0, 1 - dt * 1.85);
    if (Math.abs(speed) < 0.05) speed = 0;
  }

  return Math.max(-8.0, Math.min(maxSpeed, speed));
}

export function computeVehicleHudReadout(
  speedMps: number,
  isReversingCommand = false
): VehicleHudReadout {
  const speedKmh = Math.round(Math.abs(speedMps) * 3.6);
  const isReversing = speedMps < -0.2 || (Math.abs(speedMps) <= 0.2 && isReversingCommand);

  let gear: VehicleGear = 'N';
  if (isReversing) {
    gear = 'R';
  } else if (Math.abs(speedMps) < 0.15) {
    gear = 'P';
  } else if (speedKmh < 16) {
    gear = '1';
  } else if (speedKmh < 32) {
    gear = '2';
  } else if (speedKmh < 50) {
    gear = '3';
  } else if (speedKmh < 70) {
    gear = '4';
  } else {
    gear = '5';
  }

  return { speedKmh, gear, isReversing };
}
