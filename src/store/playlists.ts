import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseM3U, type Channel } from '../lib/m3u';
import { withProxy } from '../lib/stremio';
import { isNative, nativeGetText } from '../lib/native';

export interface Playlist {
  id: string;
  name: string;
  url: string;
  channels: Channel[];
  updatedAt: number;
}

async function download(url: string): Promise<string> {
  if (isNative()) return nativeGetText(url, 30000);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    const proxied = withProxy(url);
    if (!proxied) throw err;
    const res = await fetch(proxied);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }
}

interface PlaylistState {
  playlists: Playlist[];
  add: (name: string, url: string) => Promise<Playlist>;
  reload: (id: string) => Promise<void>;
  remove: (id: string) => void;
}

export const usePlaylists = create<PlaylistState>()(
  persist(
    (set, get) => ({
      playlists: [],
      add: async (name, url) => {
        const channels = parseM3U(await download(url));
        if (!channels.length) throw new Error('empty-playlist');
        const pl: Playlist = { id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `pl-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: name || new URL(url).hostname, url, channels, updatedAt: Date.now() };
        set((s) => ({ playlists: [...s.playlists, pl] }));
        return pl;
      },
      reload: async (id) => {
        const pl = get().playlists.find((p) => p.id === id);
        if (!pl) return;
        const channels = parseM3U(await download(pl.url));
        set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, channels, updatedAt: Date.now() } : p)) }));
      },
      remove: (id) => set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
    }),
    { name: 'flexy.playlists', version: 1 },
  ),
);
