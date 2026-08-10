import React, { useLayoutEffect, useState } from 'react';
import { TutorialStep } from '../services/tutorial';

// The coachmark overlay that renders one guided-tutorial step at a time. It is
// pure presentation: App owns the step index and the auto-advance logic; this
// component only finds the element named by `step.anchor` (via a
// `data-tutorial` attribute), spotlights it, and floats a bubble with the
// instruction plus Next / Skip controls beside it.
//
// The whole overlay is `pointer-events-none` except the bubble, so the player
// can still click the real board and HUD underneath to perform the action a
// step is waiting for. When the anchor cannot be found (nothing matches yet),
// it dims the screen and centres the bubble rather than pointing at nothing.

interface TutorialCoachmarkProps {
  step: TutorialStep;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const BUBBLE_WIDTH = 320;

export default function TutorialCoachmark({
  step, index, total, onNext, onSkip,
}: TutorialCoachmarkProps) {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  // Re-measure the anchor on every step change, and keep it in sync while the
  // board scrolls, resizes, or a token moves (cheap poll — the DOM query is
  // trivial and this only runs during the tutorial).
  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tutorial="${step.anchor}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const id = window.setInterval(measure, 200);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step.anchor]);

  const isLast = index === total - 1;

  // Place the bubble below the anchor when there is room, otherwise above it,
  // clamped into the viewport. Centre it when there is no anchor.
  const bubbleStyle: React.CSSProperties = (() => {
    if (!rect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    const below = rect.top + rect.height + 14;
    const roomBelow = window.innerHeight - below;
    const top = roomBelow > 190 ? below : Math.max(12, rect.top - 200);
    let left = rect.left + rect.width / 2 - BUBBLE_WIDTH / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - BUBBLE_WIDTH - 12));
    return { top, left };
  })();

  return (
    <div className="fixed inset-0 z-[150] pointer-events-none" data-testid="tutorial-coachmark">
      {/* Spotlight: a ring around the anchor whose huge outer box-shadow dims
          everything else. When there is no anchor, dim the whole screen. */}
      {rect ? (
        <div
          className="absolute rounded-md ring-4 ring-sky-400/80 transition-all duration-200"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}

      <div
        className="absolute pointer-events-auto bg-stone-900 border-2 border-sky-500/60 rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200"
        style={{ width: BUBBLE_WIDTH, maxWidth: '90vw', ...bubbleStyle }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-sky-300 font-bold">
            Tutorial · Step {index + 1}/{total}
          </span>
          <button
            onClick={onSkip}
            data-testid="tutorial-skip"
            className="text-[11px] text-stone-400 hover:text-stone-200 underline"
          >
            Skip
          </button>
        </div>
        <p className="text-sm text-stone-100 leading-snug mb-4">{step.text}</p>
        <div className="flex justify-end">
          <button
            onClick={onNext}
            data-testid="tutorial-next"
            className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold uppercase tracking-widest"
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
