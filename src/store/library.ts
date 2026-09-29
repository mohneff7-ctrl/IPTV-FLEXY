import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MetaPreview } from '../lib/types';

export interface LibraryItem {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  year?: string;
  imdbRating?: string;
  addedAt: number;
}

export interface Progress {
  videoId: string;
  metaId: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  thumbnail?: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  time: number;
  duration: number;
  updatedAt: number;
}

interface LibraryState {
  favorites: Record<string, LibraryItem>;
  progress: Record<string, Progress>;
  searches: string[];
  toggleFavorite: (m: MetaPreview) => boolean;
  saveProgress: (p: Omit<Progress, 'updatedAt'>) => void;
  markWatched: (p: Omit<Progress, 'updatedAt' | 'time' | 'duration'>, watched: boolean) => void;
  removeProgress: (metaId: string) => void;
  clearHistory: () => void;
  addSearch: (q: string) => void;
  clearSearches: () => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      favorites: {},
      progress: {},
      searches: [],
      toggleFavorite: (m) => {
        const favorites = { ...get().favorites };
        const on = !favorites[m.id];
        if (on) {
          favorites[m.id] = {
            id: m.id,
            type: m.type,
            name: m.name,
            poster: m.poster,
            background: m.background,
            year: m.releaseInfo ?? m.year,
            imdbRating: m.imdbRating,
            addedAt: Date.now(),
          };
        } else delete favorites[m.id];
        set({ favorites });
        return on;
      },
      saveProgress: (p) => set((s) => ({ progress: { ...s.progress, [p.videoId]: { ...p, updatedAt: Date.now() } } })),
      markWatched: (p, watched) =>
        set((s) => {
          const progress = { ...s.progress };
          if (watched) progress[p.videoId] = { ...p, time: 1, duration: 1, updatedAt: Date.now() };
          else delete progress[p.videoId];
          return { progress };
        }),
      removeProgress: (metaId) =>
        set((s) => ({
          progress: Object.fromEntries(Object.entries(s.progress).filter(([, p]) => p.metaId !== metaId)),
        })),
      clearHistory: () => set({ progress: {} }),
      addSearch: (q) => set((s) => ({ searches: [q, ...s.searches.filter((x) => x !== q)].slice(0, 12) })),
      clearSearches: () => set({ searches: [] }),
    }),
    { name: 'layan.library', version: 1 },
  ),
);

export const isWatched = (p?: Progress) => !!p && p.duration > 0 && p.time / p.duration >= 0.9;

/** Latest unfinished item per title — the "Continue watching" row. */
export function continueWatching(progress: Record<string, Progress>): Progress[] {
  const byMeta = new Map<string, Progress>();
  Object.values(progress)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((p) => {
      if (!byMeta.has(p.metaId)) byMeta.set(p.metaId, p);
    });
  return [...byMeta.values()].filter((p) => !isWatched(p) && p.time > 5).slice(0, 20);
}
