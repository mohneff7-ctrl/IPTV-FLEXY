/**
 * Thin bridge to native features when FLEXY runs as an Android/iOS app
 * (Capacitor). Every function is a safe no-op in the browser.
 */
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

/**
 * GET as text. In the native app requests go through the OS HTTP stack, so
 * addons and playlists without CORS headers (or on plain http) just work.
 */
export async function nativeGetText(url: string, timeout = 20000): Promise<string> {
  const res = await CapacitorHttp.get({
    url,
    responseType: 'text',
    connectTimeout: timeout,
    readTimeout: timeout,
    headers: { 'User-Agent': 'FLEXY/1.0 (Android)', Accept: 'application/json, */*' },
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
  return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
}

export async function enterPlayerMode() {
  if (!isNative()) return;
  try {
    const [{ ScreenOrientation }, { StatusBar }] = await Promise.all([
      import('@capacitor/screen-orientation'),
      import('@capacitor/status-bar'),
    ]);
    await Promise.allSettled([ScreenOrientation.lock({ orientation: 'landscape' }), StatusBar.hide()]);
  } catch {
    /* plugin unavailable */
  }
}

export async function exitPlayerMode() {
  if (!isNative()) return;
  try {
    const [{ ScreenOrientation }, { StatusBar }] = await Promise.all([
      import('@capacitor/screen-orientation'),
      import('@capacitor/status-bar'),
    ]);
    await Promise.allSettled([ScreenOrientation.lock({ orientation: 'portrait' }), StatusBar.show()]);
  } catch {
    /* plugin unavailable */
  }
}

/** stremio://…/manifest.json links (addon "Install" buttons) open the install sheet. */
export async function setupAddonLinks(open: (manifestUrl: string) => void) {
  if (!isNative()) return;
  const { App } = await import('@capacitor/app');
  const handle = (url?: string) => url && /^stremio:/i.test(url) && open(url);
  App.addListener('appUrlOpen', (e) => handle(e.url));
  App.getLaunchUrl().then((l) => handle(l?.url)).catch(() => undefined);
}

/** Android hardware back button → in-app navigation, exit on the home screen. */
export async function setupBackButton(goBack: () => boolean) {
  if (!isNative()) return;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', () => {
    if (!goBack()) App.exitApp();
  });
}

export async function setupStatusBar() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#08080b' }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

/* ---------------- Native player (ExoPlayer) ---------------- */

export interface NativePlayOptions {
  url: string;
  title: string;
  subtitle?: string;
  headers?: Record<string, string>;
  subtitles?: { url: string; lang: string; label: string }[];
  startMs?: number;
  highest?: boolean;
  subLang?: string;
}

export interface NativePlayResult {
  position?: number;
  duration?: number;
  ended?: boolean;
  error?: string;
}

interface NativePlayerPlugin {
  play(opts: NativePlayOptions): Promise<NativePlayResult>;
}

const NativePlayer = registerPlugin<NativePlayerPlugin>('NativePlayer');

export const hasNativePlayer = () => isNative() && Capacitor.getPlatform() === 'android';

export function nativePlay(opts: NativePlayOptions): Promise<NativePlayResult> {
  return NativePlayer.play(opts);
}

/* ---------------- External links ---------------- */

const MEDIA_EXT = /\.(m3u8|mpd|mp4|m4v|mkv|webm|mov|avi|ts|flv|mp3|aac)(\?|#|$)/i;

/**
 * Is this URL a video (so it can play inside FLEXY) or a web page?
 * Checks the extension first, then asks the server for its content type.
 */
export async function isMediaUrl(url: string): Promise<boolean> {
  if (MEDIA_EXT.test(url)) return true;
  if (!/^https?:/i.test(url)) return false;
  try {
    if (isNative()) {
      const res = await CapacitorHttp.request({
        url,
        method: 'HEAD',
        connectTimeout: 4000,
        readTimeout: 4000,
        headers: { 'User-Agent': 'FLEXY/1.0 (Android)' },
      });
      const type = String(res.headers['Content-Type'] ?? res.headers['content-type'] ?? '');
      return /video|mpegurl|dash\+xml|octet-stream|mp2t/i.test(type);
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal }).finally(() => clearTimeout(t));
    return /video|mpegurl|dash\+xml|mp2t/i.test(res.headers.get('content-type') ?? '');
  } catch {
    return false;
  }
}

/** Opens a web page inside the app (Chrome Custom Tab) instead of leaving FLEXY. */
export async function openInApp(url: string) {
  if (isNative()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, toolbarColor: '#08080b', presentationStyle: 'fullscreen' });
    return;
  }
  window.open(url, '_blank', 'noopener');
}
