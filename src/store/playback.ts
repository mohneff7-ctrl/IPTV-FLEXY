import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Meta, SourcedStream, Video } from '../lib/types';

/** What the player needs to know about the current session. */
export interface PlaybackSession {
  stream: SourcedStream;
  /** For IPTV channels there is no Stremio meta. */
  meta?: Meta;
  video?: Video;
  videoId: string;
  type: string;
  title: string;
  subtitle?: string;
  poster?: string;
}

interface PlaybackState {
  session: PlaybackSession | null;
  start: (s: PlaybackSession) => void;
}

export const usePlayback = create<PlaybackState>()(
  persist(
    (set) => ({
      session: null,
      start: (session) => set({ session }),
    }),
    { name: 'layan.playback', storage: createJSONStorage(() => sessionStorage) },
  ),
);
