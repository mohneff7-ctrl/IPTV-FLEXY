import { useEffect, useMemo } from 'react';
import { APP_NAME } from '../lib/brand';
import { LogoMark } from './Logo';

const HOLD = 2500;
const OUT = 650;
const DEPTH_LAYERS = 12;

/** Whether to play the intro: once per app launch, and never for deep links into the player. */
export function shouldShowIntro(enabled: boolean): boolean {
  if (!enabled || location.hash.startsWith('#/play')) return false;
  try {
    if (sessionStorage.getItem('layan.intro')) return false;
    sessionStorage.setItem('layan.intro', '1');
  } catch {
    /* storage blocked: still show it */
  }
  return true;
}

/**
 * Animated 3D brand intro. The mark is a real extruded tile (stacked layers in
 * 3D space) that flies in, the white monogram floats in front of it, the
 * letters flip up, then the camera flies through into the app. Everything is
 * transform/opacity only, so it runs on the GPU compositor at a steady 60fps.
 * Tap to skip.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hold = reduced ? 600 : HOLD;
  useEffect(() => {
    const id = setTimeout(onDone, hold + OUT);
    return () => clearTimeout(id);
  }, [onDone, hold]);

  // Stable pseudo-random embers (same on every render).
  const embers = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i * 37 + 11) % 100}%`,
        delay: `${((i * 0.29) % 2).toFixed(2)}s`,
        dur: `${(3.2 + ((i * 0.53) % 2.4)).toFixed(2)}s`,
        size: 2 + (i % 3),
      })),
    [],
  );

  return (
    <div
      className="intro"
      role="img"
      aria-label={APP_NAME}
      onClick={onDone}
      style={{ '--intro-hold': `${hold}ms`, '--intro-out': `${OUT}ms` } as React.CSSProperties}
    >
      <div className="intro-rays" aria-hidden="true" />
      <div className="intro-glow" aria-hidden="true" />
      <div className="intro-embers" aria-hidden="true">
        {embers.map((e, i) => (
          <span key={i} style={{ left: e.left, animationDelay: e.delay, animationDuration: e.dur, width: e.size, height: e.size }} />
        ))}
      </div>

      <div className="intro-scene">
        <div className="intro-fly">
          <div className="intro-stage">
            <div className="intro-tilt">
              <div className="intro-tile">
                {Array.from({ length: DEPTH_LAYERS }, (_, i) => (
                  <span key={i} className="intro-depth" style={{ '--d': i + 1 } as React.CSSProperties} />
                ))}
                <div className="intro-face">
                  <span className="intro-shine" />
                </div>
                <div className="intro-glyph">
                  <LogoMark size={120} bare />
                </div>
              </div>
            </div>

            <div className="intro-word" aria-hidden="true">
              {APP_NAME.split('').map((c, i) => (
                <span key={i} style={{ '--i': i } as React.CSSProperties}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="intro-bar">
        <span />
      </div>
    </div>
  );
}
