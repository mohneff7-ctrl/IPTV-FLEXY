import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QualityMode } from '../player/engine';

export type Lang = 'ar' | 'en';
export type FitMode = 'contain' | 'cover' | 'fill';
export type SubtitleFont = 'cairo' | 'tajawal' | 'naskh' | 'lalezar' | 'system' | 'serif' | 'mono';
export type SubtitleEdge = 'shadow' | 'outline' | 'none';

export interface Settings {
  lang: Lang;
  autoplayNext: boolean;
  resumePlayback: boolean;
  subtitleLang: string;
  subtitleSize: number;
  subtitleFont: SubtitleFont;
  subtitleBold: boolean;
  subtitleColor: string;
  subtitleBgColor: string;
  /** 0 = no box behind the text. */
  subtitleBgOpacity: number;
  subtitleEdge: SubtitleEdge;
  swipeGestures: boolean;
  showIntro: boolean;
  preferredQuality: 'auto' | '4K' | '1080p' | '720p' | '480p';
  streamQuality: QualityMode;
  fitMode: FitMode;
  seekStep: number;
  showAdult: boolean;
  streamingServer: string;
  corsProxy: string;
  profileName: string;
  set: (patch: Partial<Omit<Settings, 'set'>>) => void;
}

export const SUBTITLE_DEFAULTS = {
  subtitleSize: 100,
  subtitleFont: 'cairo' as SubtitleFont,
  subtitleBold: true,
  subtitleColor: '#ffffff',
  subtitleBgColor: '#000000',
  subtitleBgOpacity: 60,
  subtitleEdge: 'shadow' as SubtitleEdge,
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      lang: 'ar',
      autoplayNext: true,
      resumePlayback: true,
      subtitleLang: 'ara',
      ...SUBTITLE_DEFAULTS,
      swipeGestures: true,
      showIntro: true,
      preferredQuality: 'auto',
      streamQuality: 'max',
      fitMode: 'contain',
      seekStep: 10,
      showAdult: false,
      streamingServer: '',
      corsProxy: '',
      profileName: '',
      set: (patch) => set(patch),
    }),
    {
      name: 'layan.settings',
      version: 2,
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        // v1 had a simple on/off subtitle box.
        if (version < 2 && s.subtitleBackground === false) s.subtitleBgOpacity = 0;
        delete s.subtitleBackground;
        return s as unknown as Settings;
      },
    },
  ),
);
