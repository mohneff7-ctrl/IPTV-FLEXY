import { useRef, useState, type PointerEvent } from 'react';

export const MIN_BRIGHTNESS = 0.15;
export const MAX_BRIGHTNESS = 1.5;

interface Options {
  enabled: boolean;
  getVolume: () => number;
  setVolume: (v: number) => void;
  getBrightness: () => number;
  setBrightness: (v: number) => void;
}

interface Hud {
  kind: 'brightness' | 'volume';
  value: number;
  max: number;
}

/** Travel (px) before a touch counts as a swipe rather than a tap. */
const SLOP = 12;
/** Fraction of the screen height that sweeps the full range. */
const TRAVEL = 0.65;

/**
 * MX-Player style swipes: vertical drag on the left half changes brightness,
 * on the right half volume. Touch only; the mouse keeps click-to-pause.
 */
export function useSwipeGestures(o: Options) {
  const [hud, setHud] = useState<Hud | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; h: number; side: 'l' | 'r'; start: number; active: boolean } | null>(null);
  const swipedAt = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!o.enabled || e.pointerType !== 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    const fy = (e.clientY - r.top) / r.height;
    // Leave the edges to the system (notification shade, home gesture).
    if (fy < 0.08 || fy > 0.92) return;
    const side = e.clientX - r.left < r.width / 2 ? 'l' : 'r';
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      h: r.height,
      side,
      start: side === 'l' ? o.getBrightness() : o.getVolume(),
      active: false,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = d.y - e.clientY;
    if (!d.active) {
      if (Math.abs(dy) < SLOP || Math.abs(dy) < Math.abs(dx) * 1.3) return;
      d.active = true;
      d.y = e.clientY; // start measuring from here so it doesn't jump
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      clearTimeout(hideTimer.current);
      return;
    }
    const delta = dy / (d.h * TRAVEL);
    if (d.side === 'l') {
      const range = MAX_BRIGHTNESS - MIN_BRIGHTNESS;
      const v = Math.max(MIN_BRIGHTNESS, Math.min(MAX_BRIGHTNESS, d.start + delta * range));
      o.setBrightness(v);
      setHud({ kind: 'brightness', value: v, max: MAX_BRIGHTNESS });
    } else {
      const v = Math.max(0, Math.min(1, d.start + delta));
      o.setVolume(v);
      setHud({ kind: 'volume', value: v, max: 1 });
    }
  };

  const end = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.active) return;
    swipedAt.current = Date.now();
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHud(null), 700);
  };

  return {
    hud,
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
    /** True for the click that follows a swipe, so it doesn't toggle the UI. */
    consumeClick() {
      const recent = Date.now() - swipedAt.current < 400;
      swipedAt.current = 0;
      return recent;
    },
  };
}
