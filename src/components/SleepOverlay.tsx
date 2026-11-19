import { BedDouble, Moon } from 'lucide-react';
import { SleepPhase } from '../sim/sleepSystem';

interface SleepOverlayProps {
  active: boolean;
  fadeOpacity: number;
  progress: number;
  phase: SleepPhase;
  hours: number;
}

export function SleepOverlay({
  active,
  fadeOpacity,
  progress,
  phase,
  hours,
}: SleepOverlayProps) {
  if (!active && fadeOpacity <= 0.01) return null;

  const showCard = phase === 'sleeping_screen';

  return (
    <div
      data-testid="sleep-overlay"
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#04070c] transition-opacity duration-75"
      style={{ opacity: fadeOpacity }}
    >
      {showCard && (
        <div
          data-testid="sleeping-loading-card"
          className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-amber-300/25 bg-[#0c141d] px-7 py-6 text-center text-[#f4f1ea] shadow-2xl"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/35 bg-amber-400/15 text-amber-300">
            {progress >= 75 ? <BedDouble className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
          </div>
          <div className="font-display text-2xl font-bold tracking-tight text-amber-200">
            Sleeping...
          </div>
          <div className="mt-1 text-sm font-semibold text-emerald-300">
            ঘুমাচ্ছেন · আমিন সেন্টার বাসা
          </div>
          <p className="mt-2 font-mono-tabular text-xs text-[#9cb0c0]">
            Resting {hours.toFixed(1)} hrs · Restoring 100% Energy & Saving Progress
          </p>

          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-100"
              style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
            />
          </div>
          <span className="mt-2 font-mono-tabular text-xs font-bold text-amber-300">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}
