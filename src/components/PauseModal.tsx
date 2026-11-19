import { Clock, CloudRain, RotateCcw, Sun, Users, X } from 'lucide-react';
import { CrowdDensity, WeatherMode, formatChattogramClock } from '../sim/worldState';

interface PauseModalProps {
  timeOfDay: number;
  weather: WeatherMode;
  weatherAuto: boolean;
  weatherLabel: string;
  clockSpeed: 1 | 10 | 60;
  crowdDensity: CrowdDensity;
  onResume: () => void;
  onSetTime: (h: number) => void;
  onSetWeather: (w: WeatherMode) => void;
  onSetWeatherAuto: (auto: boolean) => void;
  onSetClockSpeed: (speed: 1 | 10 | 60) => void;
  onSetCrowd: (d: CrowdDensity) => void;
  onOpenMap: () => void;
  onResetWorld: () => void;
  onReturnTitle: () => void;
}

export function PauseModal({
  timeOfDay,
  weather,
  weatherAuto,
  weatherLabel,
  clockSpeed,
  crowdDensity,
  onResume,
  onSetTime,
  onSetWeather,
  onSetWeatherAuto,
  onSetClockSpeed,
  onSetCrowd,
  onOpenMap,
  onResetWorld,
  onReturnTitle,
}: PauseModalProps) {
  const timePresets = [
    { label: 'Fajr (05:15)', h: 5.25 },
    { label: 'Morning (10:15)', h: 10.25 },
    { label: 'Cloudy (12:30)', h: 12.5 },
    { label: 'Squall (15:00)', h: 15.0 },
    { label: 'Monsoon (17:00)', h: 17.0 },
    { label: 'Night (20:30)', h: 20.5 },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#d6cfc2]/20 bg-[#101820] p-6 text-[#f4f1ea] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Simulation Paused</h2>
            <p className="font-mono-tabular text-xs text-[#9cb0c0]">
              Chattogram Clock: {formatChattogramClock(timeOfDay)} · {weatherLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onResume}
            aria-label="Resume game"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Time of Day & Simulation Clock Speed */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#b8c4cf]">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-300" />
              <span>Simulation Clock & Prayer Lighting</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-amber-300" />
              {([1, 10, 60] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onSetClockSpeed(spd)}
                  className={`rounded px-2 py-0.5 font-mono-tabular text-[11px] font-semibold ${
                    clockSpeed === spd
                      ? 'bg-amber-400 text-[#0f172a]'
                      : 'border border-white/15 bg-white/5 text-[#d7e0e8] hover:bg-white/15'
                  }`}
                >
                  {spd}×
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {timePresets.map((tp) => (
              <button
                key={tp.label}
                type="button"
                onClick={() => onSetTime(tp.h)}
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-medium text-[#e5ebf0] hover:bg-white/15"
              >
                {tp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Clock-Driven Weather + Manual Override */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#b8c4cf]">
            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-sky-300" />
              <span>Weather & Wet Roads</span>
            </div>
            <span className="font-mono-tabular text-[11px] text-sky-300">
              {weatherAuto ? 'Auto Clock Schedule' : 'Manual Override'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onSetWeatherAuto(true)}
              className={`rounded-md px-2.5 py-2 text-xs font-semibold ${
                weatherAuto
                  ? 'bg-sky-400 text-[#0f172a]'
                  : 'border border-white/10 bg-white/5 text-[#e5ebf0] hover:bg-white/15'
              }`}
            >
              Auto Cycle
            </button>
            {(['clear', 'overcast', 'rain'] as WeatherMode[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onSetWeather(w)}
                className={`rounded-md px-2.5 py-2 text-xs font-semibold capitalize ${
                  !weatherAuto && weather === w
                    ? 'bg-amber-400 text-[#0f172a]'
                    : 'border border-white/10 bg-white/5 text-[#e5ebf0] hover:bg-white/15'
                }`}
              >
                {w === 'rain' ? 'Monsoon Rain' : w}
              </button>
            ))}
          </div>
        </div>

        {/* NPC Crowd Density */}
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#b8c4cf]">
            <Users className="h-4 w-4 text-emerald-300" />
            <span>NPC Street Crowd Density</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'low', label: 'Low (70)' },
                { id: 'medium', label: 'Medium (140)' },
                { id: 'high', label: 'High (240)' },
              ] as { id: CrowdDensity; label: string }[]
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSetCrowd(c.id)}
                className={`rounded-md px-3 py-2 text-xs font-semibold ${
                  crowdDensity === c.id
                    ? 'bg-emerald-500 text-[#0f172a]'
                    : 'border border-white/10 bg-white/5 text-[#e5ebf0] hover:bg-white/15'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Actions */}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-[#0f172a] hover:bg-amber-300"
          >
            Resume Exploration
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onOpenMap}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
            >
              GIS Map [M]
            </button>
            <button
              type="button"
              onClick={onResetWorld}
              className="flex items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Spawn
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-[#d3dce4] hover:bg-white/15"
            >
              Title Screen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
