import { useRef, useState } from 'react';
import { formatTime } from '../lib/format';

/** Pointer-driven seek bar with buffer indicator and a hover/scrub time bubble. */
export function SeekBar({
  value,
  max,
  buffered,
  onSeek,
  onScrub,
}: {
  value: number;
  max: number;
  buffered: number;
  onSeek: (t: number) => void;
  onScrub?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const safeMax = max > 0 && isFinite(max) ? max : 0;

  const posToTime = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * safeMax;
  };

  const shown = drag ?? value;
  const pct = safeMax ? (shown / safeMax) * 100 : 0;
  const bufPct = safeMax ? Math.min(100, (buffered / safeMax) * 100) : 0;
  const bubble = drag ?? hover;

  return (
    <div
      ref={ref}
      className={`seekbar${drag != null ? ' dragging' : ''}`}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={(e) => {
        if (!safeMax) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(posToTime(e.clientX));
        onScrub?.();
      }}
      onPointerMove={(e) => {
        if (!safeMax) return;
        const t = posToTime(e.clientX);
        if (drag != null) {
          setDrag(t);
          onScrub?.();
        } else setHover(t);
      }}
      onPointerUp={(e) => {
        if (drag != null) onSeek(posToTime(e.clientX));
        setDrag(null);
      }}
      onPointerLeave={() => setHover(null)}
      onPointerCancel={() => setDrag(null)}
    >
      <div className="seek-track">
        <div className="seek-buffer" style={{ width: `${bufPct}%` }} />
        <div className="seek-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="seek-thumb" style={{ left: `${pct}%` }} />
      {bubble != null && safeMax > 0 && (
        <div className="seek-bubble" style={{ left: `${(bubble / safeMax) * 100}%` }}>
          {formatTime(bubble)}
        </div>
      )}
    </div>
  );
}
