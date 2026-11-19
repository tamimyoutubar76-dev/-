import type { WeatherMode } from './worldState';

export interface WeatherEvaluation {
  state: WeatherMode;
  nextState: WeatherMode;
  isTransitioning: boolean;
  transitionProgress: number;
  cloudCover: number;
  rainIntensity: number;
  roadWetness: number;
  nextTransitionHour: number;
  label: string;
}

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function getWeatherDisplayName(mode: WeatherMode): string {
  switch (mode) {
    case 'clear':
      return 'Clear';
    case 'overcast':
      return 'Overcast';
    case 'rain':
      return 'Monsoon Rain';
  }
}

/**
 * Deterministic 24-hour dynamic Chattogram weather cycle driven by the internal simulation clock.
 *
 * Schedule (simulation hours 0..24):
 * - 00:00 - 11:00: Clear (crisp morning around default 10:15 AM spawn)
 * - 11:00 - 12:00: Transition Clear -> Overcast
 * - 12:00 - 14:30: Overcast
 * - 14:30 - 15:30: Transition Overcast -> Monsoon Rain
 * - 15:30 - 19:00: Monsoon Rain
 * - 19:00 - 20:00: Transition Monsoon Rain -> Overcast
 * - 20:00 - 21:30: Overcast (damp evening)
 * - 21:30 - 22:30: Transition Overcast -> Clear
 * - 22:30 - 24:00: Clear
 */
export function evaluateWeatherAtClock(clockHours: number): WeatherEvaluation {
  const h = ((clockHours % 24) + 24) % 24;

  // 00:00 - 11:00: Clear
  if (h < 11.0) {
    return {
      state: 'clear',
      nextState: 'overcast',
      isTransitioning: false,
      transitionProgress: 0,
      cloudCover: 0,
      rainIntensity: 0,
      roadWetness: 0,
      nextTransitionHour: 11.0,
      label: 'Clear',
    };
  }

  // 11:00 - 12:00: Clear -> Overcast
  if (h < 12.0) {
    const s = smoothstep01(h - 11.0);
    return {
      state: s < 0.5 ? 'clear' : 'overcast',
      nextState: 'overcast',
      isTransitioning: true,
      transitionProgress: s,
      cloudCover: s,
      rainIntensity: 0,
      roadWetness: 0.12 * s,
      nextTransitionHour: 12.0,
      label: 'Clear → Overcast',
    };
  }

  // 12:00 - 14:30: Overcast
  if (h < 14.5) {
    return {
      state: 'overcast',
      nextState: 'rain',
      isTransitioning: false,
      transitionProgress: 0,
      cloudCover: 1.0,
      rainIntensity: 0,
      roadWetness: 0.12,
      nextTransitionHour: 14.5,
      label: 'Overcast',
    };
  }

  // 14:30 - 15:30: Overcast -> Monsoon Rain
  if (h < 15.5) {
    const s = smoothstep01(h - 14.5);
    return {
      state: s < 0.5 ? 'overcast' : 'rain',
      nextState: 'rain',
      isTransitioning: true,
      transitionProgress: s,
      cloudCover: 1.0,
      rainIntensity: s,
      roadWetness: 0.12 + 0.88 * s,
      nextTransitionHour: 15.5,
      label: 'Overcast → Monsoon Rain',
    };
  }

  // 15:30 - 19:00: Monsoon Rain
  if (h < 19.0) {
    return {
      state: 'rain',
      nextState: 'overcast',
      isTransitioning: false,
      transitionProgress: 0,
      cloudCover: 1.0,
      rainIntensity: 1.0,
      roadWetness: 1.0,
      nextTransitionHour: 19.0,
      label: 'Monsoon Rain',
    };
  }

  // 19:00 - 20:00: Monsoon Rain -> Overcast
  if (h < 20.0) {
    const s = smoothstep01(h - 19.0);
    return {
      state: s < 0.5 ? 'rain' : 'overcast',
      nextState: 'overcast',
      isTransitioning: true,
      transitionProgress: s,
      cloudCover: 1.0 - 0.15 * s,
      rainIntensity: 1.0 - s,
      roadWetness: 1.0 - 0.35 * s,
      nextTransitionHour: 20.0,
      label: 'Monsoon Rain → Overcast',
    };
  }

  // 20:00 - 21:30: Overcast (Damp Evening)
  if (h < 21.5) {
    return {
      state: 'overcast',
      nextState: 'clear',
      isTransitioning: false,
      transitionProgress: 0,
      cloudCover: 0.85,
      rainIntensity: 0,
      roadWetness: 0.65,
      nextTransitionHour: 21.5,
      label: 'Overcast',
    };
  }

  // 21:30 - 22:30: Overcast -> Clear
  if (h < 22.5) {
    const s = smoothstep01(h - 21.5);
    return {
      state: s < 0.5 ? 'overcast' : 'clear',
      nextState: 'clear',
      isTransitioning: true,
      transitionProgress: s,
      cloudCover: 0.85 * (1 - s),
      rainIntensity: 0,
      roadWetness: 0.65 * (1 - s),
      nextTransitionHour: 22.5,
      label: 'Overcast → Clear',
    };
  }

  // 22:30 - 24:00: Clear
  return {
    state: 'clear',
    nextState: 'overcast',
    isTransitioning: false,
    transitionProgress: 0,
    cloudCover: 0,
    rainIntensity: 0,
    roadWetness: 0,
    nextTransitionHour: 11.0,
    label: 'Clear',
  };
}

export function evaluateManualWeather(mode: WeatherMode): WeatherEvaluation {
  if (mode === 'rain') {
    return {
      state: 'rain',
      nextState: 'rain',
      isTransitioning: false,
      transitionProgress: 0,
      cloudCover: 1.0,
      rainIntensity: 1.0,
      roadWetness: 1.0,
      nextTransitionHour: 0,
      label: 'Monsoon Rain',
    };
  }
  if (mode === 'overcast') {
    return {
      state: 'overcast',
      nextState: 'overcast',
      isTransitioning: false,
      transitionProgress: 0,
      cloudCover: 0.95,
      rainIntensity: 0,
      roadWetness: 0.15,
      nextTransitionHour: 0,
      label: 'Overcast',
    };
  }
  return {
    state: 'clear',
    nextState: 'clear',
    isTransitioning: false,
    transitionProgress: 0,
    cloudCover: 0,
    rainIntensity: 0,
    roadWetness: 0,
    nextTransitionHour: 0,
    label: 'Clear',
  };
}
