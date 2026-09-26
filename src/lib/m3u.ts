export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group: string;
}

const attr = (line: string, key: string) => new RegExp(`${key}="([^"]*)"`, 'i').exec(line)?.[1];

/** Parses an extended M3U playlist (IPTV). */
export function parseM3U(text: string): Channel[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: Channel[] = [];
  let info: string | null = null;
  let group: string | undefined;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      info = line;
      group = undefined;
    } else if (line.startsWith('#EXTGRP:')) {
      group = line.slice(8).trim();
    } else if (!line.startsWith('#') && info) {
      const name = info.slice(info.lastIndexOf(',') + 1).trim() || attr(info, 'tvg-name') || 'Channel';
      out.push({
        id: `m3u:${out.length}:${name}`,
        name,
        url: line,
        logo: attr(info, 'tvg-logo') || undefined,
        group: attr(info, 'group-title') || group || 'Other',
      });
      info = null;
    }
  }
  return out;
}
