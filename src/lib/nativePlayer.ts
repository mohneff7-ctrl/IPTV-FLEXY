/**
 * Native Android player (ExoPlayer / Media3, see PlayerActivity.java).
 * Hardware decoding, HLS/DASH/RTSP/TS/MKV/MP4 and FFmpeg audio: it plays far
 * more streams than the WebView, faster and at full quality.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativePlayOptions {
  url: string;
  title: string;
  subtitle?: string;
  /** Seconds. */
  startPosition?: number;
  live?: boolean;
  headers?: Record<string, string>;
  subtitles?: { url: string; lang: string; label: string }[];
  subtitleLang?: string;
  subtitleSize?: number;
  subtitleColor?: string;
  subtitleBgColor?: string;
  /** 0–100. */
  subtitleBgOpacity?: number;
  subtitleEdge?: 'shadow' | 'outline' | 'none';
  subtitleBold?: boolean;
  seekStep?: number;
  resizeMode?: 'fit' | 'zoom' | 'fill';
  /** 0 = no limit. */
  maxHeight?: number;
  /** Limit quality to the screen size ("auto" mode). */
  capToScreen?: boolean;
}

export interface NativePlayResult {
  /** Seconds. */
  position: number;
  duration: number;
  ended: boolean;
  error?: string;
  cancelled?: boolean;
}

interface NativePlayerPlugin {
  play(options: NativePlayOptions): Promise<NativePlayResult>;
  addListener(event: 'progress', cb: (p: { position: number; duration: number }) => void): Promise<PluginListenerHandle>;
}

export const NativePlayer = registerPlugin<NativePlayerPlugin>('NativePlayer');

export const nativePlayerAvailable = () =>
  Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('NativePlayer');
