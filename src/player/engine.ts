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
  /** Start at, and keep preferring, the highest rendition. */
  highest?: boolean;
}

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

async function hlsEngine(video: HTMLVideoElement, url: string, ev: EngineEvents): Promise<Engine> {
  const { default: Hls } = await import('hls.js');
  if (!Hls.isSupported()) {
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      const e = nativeEngine(video, url, ev);
      return { ...e, kind: 'hls' };
    }
    throw new Error('hls-unsupported');
  }
  const top = !!ev.highest;
  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: false,
    startLevel: -1,
    // Highest-quality mode: never cap to the screen size, assume a fast line,
    // and let ABR climb eagerly; otherwise stay bandwidth-friendly.
    capLevelToPlayerSize: !top,
    abrEwmaDefaultEstimate: top ? 25_000_000 : 4_000_000,
    abrBandWidthFactor: top ? 0.98 : 0.95,
    abrBandWidthUpFactor: top ? 0.9 : 0.7,
    maxBufferLength: 60,
    maxMaxBufferLength: 300,
    maxBufferSize: 150 * 1000 * 1000,
    backBufferLength: 90,
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
    if (top && hls.levels.length > 1) {
      // Start directly on the best rendition instead of climbing from the lowest.
      let best = 0;
      hls.levels.forEach((l, i) => (l.bitrate > hls.levels[best].bitrate ? (best = i) : 0));
      hls.startLevel = best;
      hls.nextLevel = best;
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
      // Faster first frame on live IPTV.
      enableStashBuffer: false,
      stashInitialSize: 384 * 1024,
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

export async function createEngine(kind: EngineKind, video: HTMLVideoElement, url: string, ev: EngineEvents): Promise<Engine> {
  if (kind === 'hls') return hlsEngine(video, url, ev);
  if (kind === 'mpegts') return mpegtsEngine(video, url, ev);
  return nativeEngine(video, url, ev);
}
