import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const make = (path: React.ReactNode, viewBox = '0 0 24 24') =>
  function Icon({ size = 24, ...rest }: P) {
    return (
      <svg width={size} height={size} viewBox={viewBox} fill="currentColor" aria-hidden="true" {...rest}>
        {path}
      </svg>
    );
  };

const stroke = (path: React.ReactNode) =>
  function Icon({ size = 24, ...rest }: P) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {path}
      </svg>
    );
  };

export const IconHome = make(<path d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3z" />);
export const IconSeries = make(
  <>
    <path d="M4 6H2v14a2 2 0 0 0 2 2h14v-2H4z" />
    <path d="M20 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2m-8 12.5v-9l6 4.5z" />
  </>,
);
export const IconMovie = make(
  <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4z" />,
);
export const IconTv = make(
  <path d="M21 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5v2h8v-2h5a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m0 14H3V5h18zM16 11l-7 4V7z" />,
);
export const IconMask = make(
  <path d="M12 7c-3.5 0-5-2-9.5-2C1.6 5 1 5.8 1 7v2.5C1 14 4 17 7.5 17c2.3 0 3.3-1.7 4.5-1.7s2.2 1.7 4.5 1.7C20 17 23 14 23 9.5V7c0-1.2-.6-2-1.5-2C17 5 15.5 7 12 7m-4.8 6c-1.6 0-2.7-1.1-2.7-2 0-.6.7-.8 1.6-.8 1.7 0 3.4.9 3.4 1.6 0 .7-.9 1.2-2.3 1.2m9.6 0c-1.4 0-2.3-.5-2.3-1.2 0-.7 1.7-1.6 3.4-1.6.9 0 1.6.2 1.6.8 0 .9-1.1 2-2.7 2" />,
);
export const IconPuzzle = make(
  <path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5" />,
);
export const IconSearch = stroke(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);
export const IconHeart = stroke(
  <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6" />,
);
export const IconHeartFill = make(
  <path d="M12 21.4 10.6 20C5.4 15.4 2 12.3 2 8.5A5.4 5.4 0 0 1 7.5 3c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 3 5.4 5.4 0 0 1 22 8.5c0 3.8-3.4 6.9-8.6 11.5z" />,
);
export const IconBell = stroke(
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
  </>,
);
export const IconGear = make(
  <path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.4l-.4 2.7a7.6 7.6 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.8 7.8 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1a7.3 7.3 0 0 0 1.7 1l.4 2.6c0 .3.2.5.5.5h4c.3 0 .5-.2.5-.4l.4-2.7a7.6 7.6 0 0 0 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7" />,
);
export const IconMenu = stroke(<path d="M4 6h16M4 12h16M4 18h16" />);
export const IconClose = stroke(<path d="M18 6 6 18M6 6l12 12" />);
export const IconBack = stroke(<path d="M5 12h14M13 6l6 6-6 6" />);
export const IconChevron = stroke(<path d="m15 18-6-6 6-6" />);
export const IconChevronDown = stroke(<path d="m6 9 6 6 6-6" />);
export const IconPlay = make(<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5" />);
export const IconPause = make(<path d="M6 4h4v16H6zM14 4h4v16h-4z" />);
export const IconStar = make(
  <path d="m12 17.3 6.2 3.7-1.7-7L22 9.2l-7.2-.6L12 2 9.2 8.6 2 9.2 7.5 14l-1.7 7z" />,
);
export const IconDownload = make(<path d="M5 20h14v-2H5zm14-11h-4V3H9v6H5l7 7z" />);
export const IconShare = make(
  <path d="M18 16a3 3 0 0 0-2 .8l-7.1-4.2a3 3 0 0 0 0-1.5L16 7.2A3 3 0 1 0 15 5a3 3 0 0 0 .1.7L8 9.8a3 3 0 1 0 0 4.4l7.1 4.2a3 3 0 1 0 2.9-2.4" />,
);
export const IconInfo = make(
  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m1 15h-2v-6h2zm0-8h-2V7h2z" />,
);
export const IconClapper = make(
  <path d="m18 3-2 3h3l2-3h1a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1L1 6h3l2-3h3L7 6h3l2-3h3l-2 3h3l2-3z" />,
);
export const IconCheck = stroke(<path d="M20 6 9 17l-5-5" />);
export const IconSort = stroke(<path d="M3 6h12M3 12h8M3 18h5M18 20V8m0 0-3 3m3-3 3 3" />);
export const IconPlus = stroke(<path d="M12 5v14M5 12h14" />);
export const IconTrash = stroke(
  <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />,
);
export const IconArrowUp = stroke(<path d="m18 15-6-6-6 6" />);
export const IconLink = stroke(
  <>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </>,
);
export const IconExternal = stroke(
  <>
    <path d="M15 3h6v6M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </>,
);
export const IconCopy = stroke(
  <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>,
);
export const IconRefresh = stroke(
  <>
    <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
    <path d="M21 3v5h-5" />
  </>,
);
export const IconUser = make(<path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10m0 2c-5.3 0-9 2.7-9 6v2h18v-2c0-3.3-3.7-6-9-6" />);
export const IconGlobe = stroke(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" />
  </>,
);
export const IconCC = make(
  <path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1z" />,
);
export const IconSpeed = stroke(
  <>
    <path d="M12 14l4-4" />
    <path d="M3.3 19a10 10 0 1 1 17.4 0" />
  </>,
);
export const IconFullscreen = stroke(<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />);
export const IconFullscreenExit = stroke(<path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />);
export const IconPip = stroke(
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" />
  </>,
);
export const IconVolume = make(
  <path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4M14 3.2v2a7 7 0 0 1 0 13.6v2a9 9 0 0 0 0-17.6" />,
);
export const IconMute = make(
  <path d="M16.5 12A4.5 4.5 0 0 0 14 8v2.2l2.5 2.5zM19 12a7 7 0 0 1-.5 2.6l1.5 1.5A9 9 0 0 0 14 3.2v2A7 7 0 0 1 19 12M4.3 3 3 4.3 7.7 9H3v6h4l5 5v-6.7l4.3 4.3a7 7 0 0 1-2.3 1.2v2a9 9 0 0 0 3.7-1.8l2 2 1.3-1.3zM12 4 9.9 6.1 12 8.2z" />,
);
export const IconReplay = make(
  <path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8m-1.1 11H10v-3.3L9 13v-.7l1.8-.6h.1zm4.3-1.8c0 .3 0 .6-.1.8l-.3.6s-.3.3-.4.3-.4.1-.6.1-.4 0-.6-.1-.3-.2-.4-.3-.2-.3-.3-.6-.1-.5-.1-.8v-.7c0-.3 0-.6.1-.8l.3-.6s.3-.3.4-.3.4-.1.6-.1.4 0 .6.1.3.2.4.3.2.3.3.6.1.5.1.8zm-.9-.8v-.5s-.1-.2-.1-.3-.1-.1-.2-.2-.2-.1-.3-.1-.2 0-.3.1l-.2.2s-.1.2-.1.3v2s.1.2.1.3.1.1.2.2.2.1.3.1.2 0 .3-.1l.2-.2s.1-.2.1-.3v-1.5z" />,
);
export const IconForward = make(
  <path d="M18 13a6 6 0 1 1-6-6v4l5-5-5-5v4a8 8 0 1 0 8 8zm-7.1 3H10v-3.3L9 13v-.7l1.8-.6h.1zm4.3-1.8c0 .3 0 .6-.1.8l-.3.6s-.3.3-.4.3-.4.1-.6.1-.4 0-.6-.1-.3-.2-.4-.3-.2-.3-.3-.6-.1-.5-.1-.8v-.7c0-.3 0-.6.1-.8l.3-.6s.3-.3.4-.3.4-.1.6-.1.4 0 .6.1.3.2.4.3.2.3.3.6.1.5.1.8zm-.9-.8v-.5s-.1-.2-.1-.3-.1-.1-.2-.2-.2-.1-.3-.1-.2 0-.3.1l-.2.2s-.1.2-.1.3v2s.1.2.1.3.1.1.2.2.2.1.3.1.2 0 .3-.1l.2-.2s.1-.2.1-.3v-1.5z" />,
);
export const IconNext = make(<path d="M6 18l8.5-6L6 6zm10-12v12h2V6z" />);
export const IconLayers = stroke(
  <>
    <path d="m12 2 10 5-10 5L2 7z" />
    <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
  </>,
);
export const IconAspect = stroke(
  <>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M7 9H5v2M17 15h2v-2" />
  </>,
);
export const IconBolt = make(<path d="M13 2 3 14h9l-1 8 10-12h-9z" />);
export const IconFlame = make(
  <path d="M13.5.7s.7 2.6.7 4.8c0 2-1.3 3.7-3.4 3.7S7.3 7.5 7.3 5.5l.1-.4A13.8 13.8 0 0 0 4 14a8 8 0 0 0 16 0c0-5.4-2.6-10.2-6.5-13.3M11.7 19a3.1 3.1 0 0 1-3.2-3c0-1.6 1-2.8 2.9-3.1 1.8-.4 3.7-1.3 4.7-2.7.4 1.3.6 2.7.6 4 0 2.7-2.2 4.8-5 4.8" />,
);
export const IconLive = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M7.8 7.8a6 6 0 0 0 0 8.4l-1.4 1.4a8 8 0 0 1 0-11.2zm8.4 0 1.4-1.4a8 8 0 0 1 0 11.2l-1.4-1.4a6 6 0 0 0 0-8.4M5 5a10 10 0 0 0 0 14l-1.4 1.4a12 12 0 0 1 0-16.8zm14 0 1.4-1.4a12 12 0 0 1 0 16.8L19 19a10 10 0 0 0 0-14" />
  </>,
);
export const IconLock = make(
  <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2m-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4m3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0z" />,
);
export const IconMoon = stroke(<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11" />);
export const IconSun = stroke(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>,
);
export const IconWave = stroke(<path d="M2 12h2M6 8v8M10 4v16M14 7v10M18 10v4M22 12h-2" />);
export const IconType = stroke(<path d="M4 7V5h16v2M9 19h6M12 5v14" />);
export const IconPalette = stroke(
  <>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10" cy="7" r="1" fill="currentColor" />
    <circle cx="15" cy="7" r="1" fill="currentColor" />
  </>,
);
export const IconHand = stroke(
  <path d="M8 13V4.5a1.5 1.5 0 0 1 3 0V12m0-1.5v-2a1.5 1.5 0 0 1 3 0V12m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.2-3L3.5 14a1.6 1.6 0 0 1 2.6-1.8L8 14.5" />,
);
