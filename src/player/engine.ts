/**
 * Playback engines. Picks the fastest path for each URL and falls back
 * automatically: HLS (hls.js / native on Safari), MPEG-TS & FLV live streams
 * (mpegts.js, typical for IPTV), and native <video> for MP4/WebM/MKV.
 * The heavy libraries are loaded on demand so they never slow down the app.
 */

export type EngineKind = 'native' | 'hls' | 'mpegts';

export interface Level {
  index: number;
  height: number;
  bitrate: number;
}

export interface AudioTrack {
  index: number;
  name: string;
  lang?: string;
}

export interface Engine {
  kind: EngineKind;
  levels: Level[];
  audioTracks: AudioTrack[];
  getLevel(): number;
  setLevel(i: number): void;
  getAudioTrack(): number;
  setAudioTrack(i: number): void;
  destroy(): void;
}

export interface EngineEvents {
  onFatal: (reason: string) => void;
  onTracks: () => void;
}

export type QualityMode = 'max' | 'auto' | 'saver';

export interface EngineOptions {
  /** max: highest resolution the connection allows; auto: capped to the screen; saver: ≤480p. */
  quality: QualityMode;
  /** Preferred starting height (from the "preferred quality" setting), if any. */
  preferredHeight?: number;
}

const DEFAULT_OPTIONS: EngineOptions = { quality: 'max' };

export function guessKind(url: string): EngineKind {
  const path = url.split('?')[0].toLowerCase();
  if (/\.m3u8$|\/hls\/|format=m3u8|\.m3u8/.test(path) || /[?&](type|format)=(hls|m3u8)/i.test(url)) return 'hls';
  if (/\.(ts|flv)$/.test(path) || /\/live\/[^/]+\/[^/]+\/\d+$/.test(path)) return 'mpegts';
  return 'native';
}

/** Order in which engines are tried for a URL. */
export function engineOrder(url: string): EngineKind[] {
  const first = guessKind(url);
  const all: EngineKind[] = ['native', 'hls', 'mpegts'];
  return [first, ...all.filter((k) => k !== first)];
}

function nativeEngine(video: HTMLVideoElement, url: string, ev: EngineEvents): Engine {
  const onError = () => ev.onFatal(video.error?.message || `media error ${video.error?.code ?? ''}`);
  video.addEventListener('error', onError);
  video.src = url;
  video.load();
  return {
    kind: 'native',
    levels: [],
    audioTracks: [],
    getLevel: () => -1,
    setLevel: () => undefined,
    getAudioTrack: () => 0,
    setAudioTrack: () => undefined,
    destroy() {
      video.removeEventListener('error', onError);
      video.removeAttribute('src');
      video.load();
    },
  };
}

async function hlsEngine(video: HTMLVideoElement, url: string, ev: EngineEvents, opts: EngineOptions): Promise<Engine> {
  const { default: Hls } = await import('hls.js');
  if (!Hls.isSupported()) {
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      const e = nativeEngine(video, url, ev);
      return { ...e, kind: 'hls' };
    }
    throw new Error('hls-unsupported');
  }
  const max = opts.quality === 'max';
  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: false,
    startLevel: -1,
    // "Best" never caps to the player size: a 3x phone screen deserves the 1080p/4K rendition.
    capLevelToPlayerSize: !max,
    // Optimistic first estimate so playback starts in HD, then ABR adapts.
    abrEwmaDefaultEstimate: max ? 10_000_000 : opts.quality === 'saver' ? 1_200_000 : 4_000_000,
    abrBandWidthFactor: max ? 0.95 : 0.9,
    abrBandWidthUpFactor: max ? 0.85 : 0.7,
    maxBufferLength: max ? 60 : 40,
    maxMaxBufferLength: 180,
    backBufferLength: 60,
    startFragPrefetch: true,
    fragLoadingMaxRetry: 6,
    manifestLoadingMaxRetry: 4,
    levelLoadingMaxRetry: 4,
  });
  const engine: Engine = {
    kind: 'hls',
    levels: [],
    audioTracks: [],
    getLevel: () => (hls.autoLevelEnabled ? -1 : hls.currentLevel),
    setLevel: (i) => {
      hls.currentLevel = i;
    },
    getAudioTrack: () => hls.audioTrack,
    setAudioTrack: (i) => {
      hls.audioTrack = i;
    },
    destroy: () => hls.destroy(),
  };
  let mediaRecoveries = 0;
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    const heights = hls.levels.map((l) => l.height || 0);
    if (opts.quality === 'saver') {
      const cap = heights.reduce((best, h, i) => (h && h <= 480 && (best < 0 || h > heights[best]) ? i : best), -1);
      if (cap >= 0) hls.autoLevelCapping = cap;
    }
    if (opts.preferredHeight) {
      // Start on the best rendition at or below the preferred height; ABR stays on.
      const start = heights.reduce((best, h, i) => (h && h <= opts.preferredHeight! && (best < 0 || h > heights[best]) ? i : best), -1);
      if (start >= 0) hls.startLevel = start;
    }
    engine.levels = hls.levels
      .map((l, index) => ({ index, height: l.height, bitrate: l.bitrate }))
      .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);
    ev.onTracks();
  });
  hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
    engine.audioTracks = hls.audioTracks.map((a, index) => ({ index, name: a.name, lang: a.lang }));
    ev.onTracks();
  });
  hls.on(Hls.Events.ERROR, (_e, data) => {
    if (!data.fatal) return;
    if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
      mediaRecoveries += 1;
      hls.recoverMediaError();
    } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.details !== 'manifestLoadError' && data.details !== 'manifestParsingError') {
      hls.startLoad();
    } else {
      ev.onFatal(data.details);
    }
  });
  hls.loadSource(url);
  hls.attachMedia(video);
  return engine;
}

async function mpegtsEngine(video: HTMLVideoElement, url: string, ev: EngineEvents): Promise<Engine> {
  const mpegts = (await import('mpegts.js')).default;
  if (!mpegts.getFeatureList().mseLivePlayback) throw new Error('mse-unsupported');
  const isFlv = /\.flv(\?|$)/i.test(url);
  const player = mpegts.createPlayer(
    { type: isFlv ? 'flv' : 'mpegts', isLive: true, url },
    {
      enableWorker: true,
      lazyLoad: false,
      // Smaller initial stash = first frame sooner on live IPTV channels.
      stashInitialSize: 128 * 1024,
      liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: 6,
      liveBufferLatencyMinRemain: 1.5,
      autoCleanupSourceBuffer: true,
    },
  );
  player.on(mpegts.Events.ERROR, (type: string, detail: string) => ev.onFatal(`${type}: ${detail}`));
  player.attachMediaElement(video);
  player.load();
  return {
    kind: 'mpegts',
    levels: [],
    audioTracks: [],
    getLevel: () => -1,
    setLevel: () => undefined,
    getAudioTrack: () => 0,
    setAudioTrack: () => undefined,
    destroy() {
      try {
        player.pause();
        player.unload();
        player.detachMediaElement();
        player.destroy();
      } catch {
        /* already gone */
      }
    },
  };
}

export async function createEngine(
  kind: EngineKind,
  video: HTMLVideoElement,
  url: string,
  ev: EngineEvents,
  opts: EngineOptions = DEFAULT_OPTIONS,
): Promise<Engine> {
  if (kind === 'hls') return hlsEngine(video, url, ev, opts);
  if (kind === 'mpegts') return mpegtsEngine(video, url, ev);
  return nativeEngine(video, url, ev);
}
