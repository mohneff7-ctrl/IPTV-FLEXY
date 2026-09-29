import { useId } from 'react';
import { APP_NAME } from '../lib/brand';

/** Glyph paths of the LAYAN monogram: an "L" cradling a play triangle. */
export const LOGO_L = 'M15 13.5a2.5 2.5 0 0 1 2.5-2.5h3.5a2.5 2.5 0 0 1 2.5 2.5V43h24a2.5 2.5 0 0 1 2.5 2.5V49a2.5 2.5 0 0 1-2.5 2.5h-30A2.5 2.5 0 0 1 15 49z';
export const LOGO_PLAY = 'M29 15.2v20.6a1.8 1.8 0 0 0 2.7 1.5l16.6-10.3a1.8 1.8 0 0 0 0-3L31.7 13.7a1.8 1.8 0 0 0-2.7 1.5z';

/** App icon: white monogram on a deep crimson tile. `bare` drops the tile. */
export function LogoMark({ size = 40, bare = false }: { size?: number; bare?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      {!bare && (
        <>
          <defs>
            <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c3102b" />
              <stop offset=".55" stopColor="#7a0718" />
              <stop offset="1" stopColor="#2b0309" />
            </linearGradient>
            <radialGradient id={`${id}h`} cx=".25" cy=".15" r=".9">
              <stop offset="0" stopColor="#fff" stopOpacity=".22" />
              <stop offset=".6" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="64" height="64" rx="16" fill={`url(#${id}g)`} />
          <rect width="64" height="64" rx="16" fill={`url(#${id}h)`} />
        </>
      )}
      <g transform="translate(-1 .75)" fill="#fff">
        <path d={LOGO_L} />
        <path d={LOGO_PLAY} />
      </g>
    </svg>
  );
}

/** Full lockup: mark + white wordmark. */
export function Logo({ size = 34, markless = false }: { size?: number; markless?: boolean }) {
  return (
    <span className="logo" dir="ltr" aria-label={APP_NAME}>
      {!markless && <LogoMark size={size} />}
      <span className="logo-word" style={{ fontSize: size * 0.62 }}>
        {APP_NAME}
      </span>
    </span>
  );
}
