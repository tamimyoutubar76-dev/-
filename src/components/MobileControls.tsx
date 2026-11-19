import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CarFront,
  Gauge,
  Hand,
  Map,
  MessageCircle,
  Pause,
  Zap,
} from 'lucide-react';
import { MobileControlInput } from '../engine/worldEngine';

interface MobileControlsProps {
  isDriving: boolean;
  hasPrompt: boolean;
  hasTalkNpc?: boolean;
  gear?: string;
  isReversing?: boolean;
  speedKmh?: number;
  onUpdateInput: (patch: Partial<MobileControlInput>) => void;
  onRotateCamera: (dyaw: number, dpitch: number) => void;
  onInteract: () => void;
  onTalkNpc?: () => void;
  onOpenMap: () => void;
  onPause: () => void;
}

export function MobileControls({
  isDriving,
  hasPrompt,
  hasTalkNpc = false,
  gear = 'P',
  isReversing = false,
  speedKmh = 0,
  onUpdateInput,
  onRotateCamera,
  onInteract,
  onTalkNpc,
  onOpenMap,
  onPause,
}: MobileControlsProps) {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [running, setRunning] = useState(false);
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const lookLast = useRef<{ x: number; y: number } | null>(null);

  const handleJoyStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    joyOrigin.current = { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joyOrigin.current) return;
    const dx = e.clientX - joyOrigin.current.x;
    const dy = e.clientY - joyOrigin.current.y;
    const maxR = 40;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxR);
    const ang = Math.atan2(dy, dx);
    const kx = Math.cos(ang) * clampedDist;
    const ky = Math.sin(ang) * clampedDist;
    setKnobPos({ x: kx, y: ky });

    const normX = kx / maxR;
    const normY = -ky / maxR;
    onUpdateInput({ moveX: normX, moveY: normY });
  };

  const handleJoyEnd = () => {
    joyOrigin.current = null;
    setKnobPos({ x: 0, y: 0 });
    onUpdateInput({ moveX: 0, moveY: 0 });
  };

  const handleLookStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    lookLast.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lookLast.current) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    onRotateCamera(-dx * 0.008, dy * 0.006);
  };

  const handleLookEnd = () => {
    lookLast.current = null;
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* Upper camera drag look touch zone */}
      <div
        onPointerDown={handleLookStart}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookEnd}
        onPointerCancel={handleLookEnd}
        className="pointer-events-auto absolute top-44 right-0 bottom-44 left-1/2 touch-none"
        aria-label="Touch camera look area"
      />

      {isDriving ? (
        /* ======================== DRIVING VEHICLE CONTROLS ======================== */
        <div data-testid="mobile-vehicle-controls" className="contents">
          {/* LEFT SIDE: Left Arrow & Right Arrow Steering Buttons */}
          <div className="pointer-events-auto absolute bottom-6 left-5 flex items-center gap-3">
            <button
              type="button"
              data-testid="veh-steer-left"
              aria-label="Steer Left"
              onPointerDown={() => onUpdateInput({ steer: -1 })}
              onPointerUp={() => onUpdateInput({ steer: 0 })}
              onPointerCancel={() => onUpdateInput({ steer: 0 })}
              onPointerLeave={() => onUpdateInput({ steer: 0 })}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white/30 bg-[#0e161d]/90 text-white shadow-xl active:scale-95 active:border-amber-300 active:bg-amber-400 active:text-[#0f172a]"
            >
              <ArrowLeft className="h-8 w-8" />
            </button>
            <button
              type="button"
              data-testid="veh-steer-right"
              aria-label="Steer Right"
              onPointerDown={() => onUpdateInput({ steer: 1 })}
              onPointerUp={() => onUpdateInput({ steer: 0 })}
              onPointerCancel={() => onUpdateInput({ steer: 0 })}
              onPointerLeave={() => onUpdateInput({ steer: 0 })}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white/30 bg-[#0e161d]/90 text-white shadow-xl active:scale-95 active:border-amber-300 active:bg-amber-400 active:text-[#0f172a]"
            >
              <ArrowRight className="h-8 w-8" />
            </button>
          </div>

          {/* RIGHT SIDE: Speed/Gear Mini Pill + Exit + Brake/Reverse + Accelerator */}
          <div className="pointer-events-auto absolute right-5 bottom-6 flex flex-col items-end gap-2.5">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-[#0e161d]/90 px-3 py-1.5 font-mono-tabular text-xs text-white shadow-lg">
                <Gauge className="h-4 w-4 text-amber-300" />
                <span className="font-bold">{speedKmh} km/h</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                    isReversing ? 'bg-red-500 text-white' : 'bg-white/15 text-amber-300'
                  }`}
                >
                  {gear}
                </span>
                {isReversing && (
                  <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                    REVERSE
                  </span>
                )}
              </div>
              <button
                type="button"
                data-testid="veh-exit-btn"
                onClick={onInteract}
                aria-label="Exit vehicle"
                className="flex h-10 items-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-400 px-3 text-xs font-bold text-[#0f172a] shadow-lg active:scale-95"
              >
                <CarFront className="h-4 w-4" />
                Exit
              </button>
            </div>

            <div className="flex items-end gap-3">
              <button
                type="button"
                data-testid="veh-brake-reverse"
                aria-label="Brake or Reverse"
                onPointerDown={() => onUpdateInput({ brake: true })}
                onPointerUp={() => onUpdateInput({ brake: false })}
                onPointerCancel={() => onUpdateInput({ brake: false })}
                onPointerLeave={() => onUpdateInput({ brake: false })}
                className={`flex h-16 w-20 flex-col items-center justify-center rounded-2xl border-2 text-xs font-bold text-white shadow-xl active:scale-95 ${
                  isReversing
                    ? 'border-amber-300 bg-red-600'
                    : 'border-red-400/60 bg-red-700/90'
                }`}
              >
                <ArrowDown className="h-5 w-5" />
                <span>BRAKE / R</span>
              </button>
              <button
                type="button"
                data-testid="veh-accelerator"
                aria-label="Accelerator"
                onPointerDown={() => onUpdateInput({ accelerate: true })}
                onPointerUp={() => onUpdateInput({ accelerate: false })}
                onPointerCancel={() => onUpdateInput({ accelerate: false })}
                onPointerLeave={() => onUpdateInput({ accelerate: false })}
                className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl border-2 border-emerald-300/70 bg-emerald-600/95 text-xs font-bold text-white shadow-xl active:scale-95"
              >
                <ArrowUp className="h-6 w-6" />
                <span>GAS</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ======================== WALKING / ON-FOOT CONTROLS ======================== */
        <div data-testid="mobile-walking-controls" className="contents">
          {/* Left Virtual Movement Joystick */}
          <div
            onPointerDown={handleJoyStart}
            onPointerMove={handleJoyMove}
            onPointerUp={handleJoyEnd}
            onPointerCancel={handleJoyEnd}
            className="pointer-events-auto absolute bottom-6 left-5 flex h-28 w-28 touch-none items-center justify-center rounded-full border border-white/25 bg-[#0e161d]/75"
            aria-label="Movement joystick"
          >
            <div
              className="h-11 w-11 rounded-full border border-amber-300/80 bg-amber-400/90 shadow-md"
              style={{ transform: `translate(${knobPos.x}px, ${knobPos.y}px)` }}
            />
          </div>

          {/* Right Walking Action Cluster */}
          <div className="pointer-events-auto absolute right-5 bottom-6 flex flex-col items-end gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenMap}
                aria-label="Open map"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#0e161d]/85 text-white active:scale-95"
              >
                <Map className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onPause}
                aria-label="Pause game"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#0e161d]/85 text-white active:scale-95"
              >
                <Pause className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              {hasTalkNpc && onTalkNpc && (
                <button
                  type="button"
                  onClick={onTalkNpc}
                  aria-label="Talk to nearby person"
                  className="flex h-12 items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-600 px-3 text-xs font-bold text-white active:scale-95"
                >
                  <MessageCircle className="h-4 w-4" />
                  Talk
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const next = !running;
                  setRunning(next);
                  onUpdateInput({ run: next });
                }}
                aria-label="Toggle run"
                className={`flex h-12 w-12 items-center justify-center rounded-full border text-xs font-bold active:scale-95 ${
                  running
                    ? 'border-amber-300 bg-amber-400 text-[#0f172a]'
                    : 'border-white/20 bg-[#0e161d]/85 text-white'
                }`}
              >
                <Zap className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onInteract}
                aria-label="Interact or board vehicle"
                className={`flex h-12 w-12 items-center justify-center rounded-full border active:scale-95 ${
                  hasPrompt
                    ? 'border-emerald-300 bg-emerald-600 text-white'
                    : 'border-white/20 bg-[#0e161d]/85 text-white'
                }`}
              >
                <Hand className="h-5 w-5" />
              </button>
              <button
                type="button"
                onPointerDown={() => onUpdateInput({ jump: true })}
                aria-label="Jump"
                className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-[#162330]/90 text-white active:scale-95"
              >
                <ArrowUp className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
