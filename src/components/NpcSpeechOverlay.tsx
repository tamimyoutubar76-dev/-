import { MessageCircle } from 'lucide-react';
import { ScreenSpeechBubble } from '../sim/npcGreetings';

interface NpcSpeechOverlayProps {
  bubbles: ScreenSpeechBubble[];
}

export function NpcSpeechOverlay({ bubbles }: NpcSpeechOverlayProps) {
  if (!bubbles || bubbles.length === 0) return null;

  return (
    <div
      data-testid="npc-speech-bubbles-layer"
      className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
    >
      {bubbles.map((b) => {
        const borderTone =
          b.variant === 'companion'
            ? 'border-teal-300/60 bg-[#0b1f1c]/95'
            : b.variant === 'vendor'
              ? 'border-amber-300/60 bg-[#1d140a]/95'
              : 'border-emerald-300/60 bg-[#0d1924]/95';

        const labelColor =
          b.variant === 'companion'
            ? 'text-teal-300'
            : b.variant === 'vendor'
              ? 'text-amber-300'
              : 'text-emerald-300';

        return (
          <div
            key={b.id}
            data-testid={`speech-bubble-${b.variant}`}
            style={{
              left: `${b.screenX}px`,
              top: `${b.screenY}px`,
              transform: 'translate(-50%, -100%)',
            }}
            className={`absolute max-w-[260px] rounded-xl border px-3 py-2 text-center shadow-2xl ${borderTone}`}
          >
            <div className={`flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide ${labelColor}`}>
              <MessageCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">{b.speakerLabel}</span>
            </div>
            <div className="mt-0.5 text-sm font-bold leading-snug text-white">
              {b.bengaliText}
            </div>
            <div className="mt-0.5 text-[10px] italic text-[#cbd5e1]">
              “{b.romanized}”
            </div>
            {/* Downward speech notch pointing directly toward character head */}
            <div
              className="mx-auto -mb-3.5 mt-1 h-2.5 w-2.5 rotate-45 border-r border-b border-inherit bg-inherit"
            />
          </div>
        );
      })}
    </div>
  );
}
