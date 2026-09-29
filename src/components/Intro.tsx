import { useEffect } from 'react';
import { APP_NAME } from '../lib/brand';
import { LogoMark } from './Logo';

const HOLD = 2200;
const OUT = 550;

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

/** Animated brand intro. Picks up from the native splash (same layout) and fades into the app. Tap to skip. */
export function Intro({ onDone }: { onDone: () => void }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hold = reduced ? 600 : HOLD;
  useEffect(() => {
    const id = setTimeout(onDone, hold + OUT);
    return () => clearTimeout(id);
  }, [onDone, hold]);
  return (
    <div
      className="intro"
      role="img"
      aria-label={APP_NAME}
      onClick={onDone}
      style={{ '--intro-hold': `${hold}ms` } as React.CSSProperties}
    >
      <div className="intro-glow" />
      <div className="intro-mark">
        <LogoMark size={112} />
      </div>
      <div className="intro-word" aria-hidden="true">
        {APP_NAME.split('').map((c, i) => (
          <span key={i} style={{ '--i': i } as React.CSSProperties}>
            {c}
          </span>
        ))}
      </div>
      <div className="intro-bar">
        <span />
      </div>
    </div>
  );
}
