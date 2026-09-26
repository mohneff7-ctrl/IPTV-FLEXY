import { withProxy } from './stremio';
import { isNative, nativeGetText } from './native';

export interface Cue {
  start: number;
  end: number;
  text: string;
}

const TS = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

function toSeconds(s: string): number {
  const m = TS.exec(s);
  if (!m) return NaN;
  return (Number(m[1] ?? 0) * 3600) + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000;
}

/** Parses SRT or WebVTT into cues (tolerant of the many broken files in the wild). */
export function parseCues(raw: string): Cue[] {
  const blocks = raw
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const idx = lines.findIndex((l) => l.includes('-->'));
    if (idx < 0) continue;
    const [a, b] = lines[idx].split('-->');
    const start = toSeconds(a);
    const end = toSeconds(b);
    if (isNaN(start) || isNaN(end)) continue;
    const text = lines
      .slice(idx + 1)
      .join('\n')
      .replace(/\{\\[^}]*\}/g, '') // ASS override tags
      .replace(/<(?!\/?(i|b|u)>)[^>]+>/gi, '') // keep only <i>, <b>, <u>
      .trim();
    if (text) cues.push({ start, end, text });
  }
  return cues.sort((x, y) => x.start - y.start);
}

function decode(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  // Many Arabic subtitles are CP1256 encoded; replacement chars reveal that.
  if ((utf8.match(/�/g) ?? []).length > 5) {
    try {
      return new TextDecoder('windows-1256').decode(buf);
    } catch {
      /* fall through */
    }
  }
  return utf8;
}

/** Downloads and parses a subtitle file. */
export async function loadSubtitle(url: string): Promise<Cue[]> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    if (isNative()) return parseCues(await nativeGetText(url));
    const proxied = withProxy(url);
    if (!proxied) throw err;
    res = await fetch(proxied);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCues(decode(await res.arrayBuffer()));
}

/** Binary search for the cues visible at time `t`. */
export function activeCues(cues: Cue[], t: number): Cue[] {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) lo = mid + 1;
    else hi = mid - 1;
  }
  const out: Cue[] = [];
  for (let i = hi; i >= 0 && i > hi - 8; i--) if (cues[i].end > t) out.unshift(cues[i]);
  return out;
}

const LANGS: Record<string, [string, string]> = {
  ara: ['العربية', 'Arabic'],
  ar: ['العربية', 'Arabic'],
  eng: ['الإنجليزية', 'English'],
  en: ['الإنجليزية', 'English'],
  fre: ['الفرنسية', 'French'],
  fra: ['الفرنسية', 'French'],
  fr: ['الفرنسية', 'French'],
  spa: ['الإسبانية', 'Spanish'],
  es: ['الإسبانية', 'Spanish'],
  ger: ['الألمانية', 'German'],
  deu: ['الألمانية', 'German'],
  tur: ['التركية', 'Turkish'],
  tr: ['التركية', 'Turkish'],
  ita: ['الإيطالية', 'Italian'],
  por: ['البرتغالية', 'Portuguese'],
  pob: ['البرتغالية (البرازيل)', 'Portuguese (BR)'],
  rus: ['الروسية', 'Russian'],
  per: ['الفارسية', 'Persian'],
  fas: ['الفارسية', 'Persian'],
  urd: ['الأردية', 'Urdu'],
  hin: ['الهندية', 'Hindi'],
  jpn: ['اليابانية', 'Japanese'],
  kor: ['الكورية', 'Korean'],
  chi: ['الصينية', 'Chinese'],
  zho: ['الصينية', 'Chinese'],
  dut: ['الهولندية', 'Dutch'],
  nld: ['الهولندية', 'Dutch'],
  heb: ['العبرية', 'Hebrew'],
  ind: ['الإندونيسية', 'Indonesian'],
  may: ['الملايو', 'Malay'],
};

export function langName(code: string, lang: 'ar' | 'en'): string {
  const hit = LANGS[code?.toLowerCase()];
  return hit ? hit[lang === 'ar' ? 0 : 1] : code?.toUpperCase() || '?';
}

export const SUB_LANG_OPTIONS = ['ara', 'eng', 'fre', 'spa', 'tur', 'ger', 'ita', 'por', 'rus', 'per', 'urd', 'hin'];
