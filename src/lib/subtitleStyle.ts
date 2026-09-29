import type { CSSProperties } from 'react';
import type { Settings, SubtitleEdge, SubtitleFont } from '../store/settings';

export const SUBTITLE_FONTS: { id: SubtitleFont; label: string; family: string }[] = [
  { id: 'cairo', label: 'Cairo', family: "'Cairo Variable', 'Cairo', system-ui, sans-serif" },
  { id: 'tajawal', label: 'Tajawal', family: "'Tajawal', 'Cairo Variable', system-ui, sans-serif" },
  { id: 'naskh', label: 'Noto Naskh', family: "'Noto Naskh Arabic Variable', 'Noto Naskh Arabic', serif" },
  { id: 'lalezar', label: 'Lalezar', family: "'Lalezar', 'Cairo Variable', sans-serif" },
  { id: 'system', label: 'System', family: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" },
  { id: 'serif', label: 'Serif', family: "Georgia, 'Times New Roman', serif" },
  { id: 'mono', label: 'Mono', family: "ui-monospace, 'Courier New', monospace" },
];

export const SUBTITLE_COLORS = ['#ffffff', '#fff200', '#ffd54a', '#7cf6ff', '#8dff9e', '#ff9ad5', '#ff5a5f', '#000000'];
export const SUBTITLE_BG_COLORS = ['#000000', '#1a0306', '#3a0710', '#12203a', '#ffffff', '#5b0010'];

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const n = parseInt(full.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Dark text needs a light edge and vice versa. */
function edgeColor(color: string) {
  const n = parseInt(color.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 110 ? '#000' : '#fff';
}

function textShadow(edge: SubtitleEdge, color: string) {
  const c = edgeColor(color);
  if (edge === 'none') return 'none';
  if (edge === 'outline')
    return [`-2px -2px 0 ${c}`, `2px -2px 0 ${c}`, `-2px 2px 0 ${c}`, `2px 2px 0 ${c}`, `0 2px 0 ${c}`, `0 -2px 0 ${c}`, `2px 0 0 ${c}`, `-2px 0 0 ${c}`].join(',');
  return `0 0 3px ${c}, 0 0 3px ${c}, 0 2px 5px ${c}`;
}

type SubtitleSettings = Pick<
  Settings,
  'subtitleSize' | 'subtitleFont' | 'subtitleBold' | 'subtitleColor' | 'subtitleBgColor' | 'subtitleBgOpacity' | 'subtitleEdge'
>;

/** CSS custom properties consumed by `.p-subs` (player) and the settings preview. */
export function subtitleVars(s: SubtitleSettings): CSSProperties {
  const boxed = s.subtitleBgOpacity > 0;
  return {
    '--sub-scale': s.subtitleSize / 100,
    '--sub-font': (SUBTITLE_FONTS.find((f) => f.id === s.subtitleFont) ?? SUBTITLE_FONTS[0]).family,
    '--sub-weight': s.subtitleBold ? 700 : 500,
    '--sub-color': s.subtitleColor,
    '--sub-bg': boxed ? hexToRgba(s.subtitleBgColor, s.subtitleBgOpacity / 100) : 'transparent',
    '--sub-pad': boxed ? '2px 12px' : '0',
    // A solid box already gives contrast; keep a soft edge only when the box is faint.
    '--sub-shadow': boxed && s.subtitleBgOpacity >= 55 ? 'none' : textShadow(s.subtitleEdge, s.subtitleColor),
  } as CSSProperties;
}
