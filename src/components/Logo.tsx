import { useId } from 'react';

/** Rounded play button outline (drawn with a round-joined stroke). */
export const MARK_PLAY = 'M20 12 L20 88 L86 50 Z';
/** The "F" carved out of the play button. */
export const MARK_F = 'M31 35h29a4.5 4.5 0 0 1 0 9H41v6h14a4 4 0 0 1 0 8H41v10a5 5 0 0 1-10 0V40a5 5 0 0 1 5-5z';

/**
 * FLEXY mark: a rounded play button with a bold "F" carved out of it.
 * It reads as "play" and as the brand initial at any size.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id={`g${id}`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#ff5a6e" />
          <stop offset="0.5" stopColor="#e3072f" />
          <stop offset="1" stopColor="#8f0019" />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`m${id}`}>
          <path d={MARK_PLAY} fill="#fff" stroke="#fff" strokeWidth="14" strokeLinejoin="round" />
          <path d={MARK_F} fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#m${id})`}>
        <rect width="100" height="100" fill={`url(#g${id})`} />
        <rect width="100" height="100" fill={`url(#s${id})`} />
      </g>
    </svg>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="logo" dir="ltr">
      <LogoMark size={size} />
      <span className="logo-word" style={{ fontSize: size * 0.7 }}>
        FLE<span>X</span>Y
      </span>
    </span>
  );
}
