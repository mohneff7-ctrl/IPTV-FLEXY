import { useEffect, useState } from 'react';
import { LogoMark, MARK_PLAY } from './Logo';

const SEEN_KEY = 'flexy.intro';
const DURATION_MS = 2600;

/**
 * Brand intro shown once per app launch: the play shape draws itself, the
 * mark drops in with a light sweep, the letters rise, then it fades into the
 * app. Tap to skip. The app loads underneath meanwhile.
 */
export function Intro() {
  const [phase, setPhase] = useState<'show' | 'leave' | 'done'>(() => {
    try {
      return sessionStorage.getItem(SEEN_KEY) ? 'done' : 'show';
    } catch {
      return 'show';
    }
  });

  useEffect(() => {
    if (phase !== 'show') return;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* private mode */
    }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setPhase('leave'), reduce ? 600 : DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leave') return;
    const t = setTimeout(() => setPhase('done'), 450);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'done') return null;
  return (
    <div className={`intro ${phase === 'leave' ? 'leave' : ''}`} onClick={() => setPhase('leave')} aria-hidden="true">
      <div className="intro-glow" />
      <div className="intro-stage">
        <svg className="intro-outline" viewBox="0 0 100 100">
          <path d={MARK_PLAY} pathLength={1} fill="none" stroke="#ff2d46" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
        <div className="intro-mark">
          <LogoMark size={132} />
          <span className="intro-sweep-clip">
            <span className="intro-sweep" />
          </span>
        </div>
      </div>
      <div className="intro-word" dir="ltr">
        {'FLEXY'.split('').map((ch, i) => (
          <span key={i} className={ch === 'X' ? 'x' : ''} style={{ animationDelay: `${1.05 + i * 0.07}s` }}>
            {ch}
          </span>
        ))}
      </div>
      <div className="intro-bar">
        <span />
      </div>
    </div>
  );
}
