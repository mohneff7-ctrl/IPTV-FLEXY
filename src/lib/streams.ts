import type { SourcedStream, Stream } from './types';
import { useSettings } from '../store/settings';

export type Quality = '4K' | '1080p' | '720p' | '480p' | '360p' | 'multi';
export const QUALITY_ORDER: Quality[] = ['4K', '1080p', '720p', '480p', '360p', 'multi'];

const text = (s: Stream) => `${s.name ?? ''} ${s.title ?? ''} ${s.description ?? ''} ${s.behaviorHints?.filename ?? ''}`;

export function qualityOf(s: Stream): Quality {
  const t = text(s);
  if (/\b(2160p|4k|uhd)\b/i.test(t)) return '4K';
  if (/\b1080[pi]?\b|full ?hd|fhd/i.test(t)) return '1080p';
  if (/\b720p?\b|\bhd\b/i.test(t)) return '720p';
  if (/\b(480p?|sd|dvdrip)\b/i.test(t)) return '480p';
  if (/\b(360p?|240p?|cam|ts)\b/i.test(t)) return '360p';
  return 'multi';
}

export function streamKind(s: Stream): 'direct' | 'torrent' | 'youtube' | 'external' {
  if (s.url) return 'direct';
  if (s.infoHash) return 'torrent';
  if (s.ytId) return 'youtube';
  return 'external';
}

export function formatBytes(n: number): string {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i >= 3 ? 2 : 0)} ${u[i]}`;
}

/** Short badges extracted from the (free-form) stream title. */
export function streamTags(s: Stream): string[] {
  const t = text(s);
  const tags: string[] = [];
  const src = /\b(BluRay|Blu-Ray|BDRip|BRRip|REMUX|WEB-?DL|WEB-?Rip|HDTV|DVDRip|HDRip|CAM|HDCAM|TeleSync)\b/i.exec(t);
  if (src) tags.push(src[1].replace(/blu-?ray/i, 'BluRay').replace(/web-?dl/i, 'WEB-DL'));
  if (/\bHDR10\+?|\bHDR\b/i.test(t)) tags.push('HDR');
  if (/\b(DV|Dolby ?Vision)\b/i.test(t)) tags.push('DV');
  if (/\b(x265|HEVC|H\.?265)\b/i.test(t)) tags.push('HEVC');
  if (/\b(Atmos|DDP?5\.1|DTS(-HD)?|TrueHD|7\.1)\b/i.test(t)) tags.push(/atmos/i.test(t) ? 'Atmos' : '5.1');
  const size = /💾\s*([\d.]+\s*[GM]B)/i.exec(t) ?? /\b([\d.]+\s*(GB|MB))\b/i.exec(t);
  if (size) tags.push(size[1].replace(/\s+/, ' '));
  else if (s.behaviorHints?.videoSize) tags.push(formatBytes(s.behaviorHints.videoSize));
  const seeds = /👤\s*(\d+)/.exec(t);
  if (seeds) tags.push(`👤 ${seeds[1]}`);
  return tags;
}

/** First line of the name is typically the provider; the title holds the release name. */
export function streamLabel(s: SourcedStream): { title: string; subtitle: string } {
  const name = (s.name ?? s.addonName).replace(/\n+/g, ' ').trim();
  const title = (s.title ?? s.description ?? '').split('\n')[0].trim();
  return { title: name || s.addonName, subtitle: title };
}

export function sortByQuality<T extends Stream>(streams: T[]): T[] {
  return [...streams].sort((a, b) => QUALITY_ORDER.indexOf(qualityOf(a)) - QUALITY_ORDER.indexOf(qualityOf(b)));
}

/**
 * Resolves the URL the player should load. Torrents go through a Stremio
 * streaming server (the official one, or any compatible instance).
 */
export function playableUrl(s: Stream): string | null {
  if (s.url) return s.url;
  if (s.infoHash) {
    const server = useSettings.getState().streamingServer.trim().replace(/\/+$/, '');
    if (!server) return null;
    const trackers = (s.sources ?? [])
      .filter((x) => x.startsWith('tracker:'))
      .map((x) => `tr=${encodeURIComponent(x.slice(8))}`)
      .join('&');
    return `${server}/${s.infoHash}/${s.fileIdx ?? -1}${trackers ? '?' + trackers : ''}`;
  }
  return null;
}

/** Android intent URL so the stream can be handed to VLC / MX Player / Just Player. */
export function externalPlayerUrl(url: string): string {
  if (/android/i.test(navigator.userAgent)) {
    const u = new URL(url);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};type=video/*;end`;
  }
  return url;
}
