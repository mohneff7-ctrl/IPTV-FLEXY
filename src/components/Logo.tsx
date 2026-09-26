export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="flx-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4d5e" />
          <stop offset="1" stopColor="#b3001b" />
        </linearGradient>
        <linearGradient id="flx-s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#flx-g)" />
      <path d="M24 18.5v27a2 2 0 0 0 3 1.7l22-13.5a2 2 0 0 0 0-3.4l-22-13.5a2 2 0 0 0-3 1.7" fill="#fff" />
      <path d="M8 16a12 12 0 0 1 12-8h24a12 12 0 0 1 12 8z" fill="url(#flx-s)" />
    </svg>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="logo" dir="ltr">
      <LogoMark size={size} />
      <span className="logo-word" style={{ fontSize: size * 0.72 }}>
        FLE<span>X</span>Y
      </span>
    </span>
  );
}
