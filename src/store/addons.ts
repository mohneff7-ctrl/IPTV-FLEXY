import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Addon } from '../lib/types';
import { fetchManifest } from '../lib/stremio';

/** Cinemeta powers catalogs and metadata out of the box, like in Stremio. */
export const DEFAULT_ADDON_URLS = [
  'https://v3-cinemeta.strem.io/manifest.json',
  'https://opensubtitles-v3.strem.io/manifest.json',
];

interface AddonsState {
  addons: Addon[];
  ready: boolean;
  install: (url: string) => Promise<Addon>;
  remove: (transportUrl: string) => void;
  move: (transportUrl: string, dir: -1 | 1) => void;
  refresh: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

export const useAddons = create<AddonsState>()(
  persist(
    (set, get) => ({
      addons: [],
      ready: false,
      install: async (url) => {
        const addon = await fetchManifest(url);
        set((s) => {
          const existing = s.addons.findIndex(
            (a) => a.transportUrl === addon.transportUrl || a.manifest.id === addon.manifest.id,
          );
          const next = [...s.addons];
          if (existing >= 0) next[existing] = { ...addon, protected: next[existing].protected };
          else next.push(addon);
          return { addons: next };
        });
        return addon;
      },
      remove: (transportUrl) => set((s) => ({ addons: s.addons.filter((a) => a.transportUrl !== transportUrl) })),
      move: (transportUrl, dir) =>
        set((s) => {
          const i = s.addons.findIndex((a) => a.transportUrl === transportUrl);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= s.addons.length) return s;
          const next = [...s.addons];
          [next[i], next[j]] = [next[j], next[i]];
          return { addons: next };
        }),
      refresh: async () => {
        const updated = await Promise.all(
          get().addons.map(async (a) => {
            try {
              const fresh = await fetchManifest(a.transportUrl);
              return { ...fresh, protected: a.protected };
            } catch {
              return a;
            }
          }),
        );
        set({ addons: updated });
      },
      bootstrap: async () => {
        if (get().addons.length) {
          set({ ready: true });
          get().refresh();
          return;
        }
        const installed = await Promise.allSettled(DEFAULT_ADDON_URLS.map((u) => fetchManifest(u)));
        set({
          addons: installed.flatMap((r, i) => (r.status === 'fulfilled' ? [{ ...r.value, protected: i === 0 }] : [])),
          ready: true,
        });
      },
    }),
    { name: 'layan.addons', version: 1, partialize: (s) => ({ addons: s.addons }) },
  ),
);
