import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lang = 'ar' | 'en';
export type FitMode = 'contain' | 'cover' | 'fill';

export interface Settings {
  lang: Lang;
  autoplayNext: boolean;
  resumePlayback: boolean;
  subtitleLang: string;
  subtitleSize: number;
  subtitleBackground: boolean;
  preferredQuality: 'auto' | '4K' | '1080p' | '720p' | '480p';
  fitMode: FitMode;
  seekStep: number;
  showAdult: boolean;
  showMatchesHome: boolean;
  /** Android: native ExoPlayer (fast, hardware, MKV/HEVC) or the built-in web player. */
  playerEngine: 'native' | 'web';
  /** Always play the highest quality the stream offers. */
  maxQuality: boolean;
  streamingServer: string;
  corsProxy: string;
  profileName: string;
  set: (patch: Partial<Omit<Settings, 'set'>>) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      lang: 'ar',
      autoplayNext: true,
      resumePlayback: true,
      subtitleLang: 'ara',
      subtitleSize: 100,
      subtitleBackground: true,
      preferredQuality: 'auto',
      fitMode: 'contain',
      seekStep: 10,
      showAdult: false,
      showMatchesHome: true,
      playerEngine: 'native',
      maxQuality: true,
      streamingServer: '',
      corsProxy: '',
      profileName: '',
      set: (patch) => set(patch),
    }),
    { name: 'flexy.settings', version: 1 },
  ),
);
