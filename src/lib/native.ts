/**
 * Thin bridge to native features when FLEXY runs as an Android/iOS app
 * (Capacitor). Every function is a safe no-op in the browser.
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core';

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
    await Promise.allSettled([ScreenOrientation.unlock(), StatusBar.show()]);
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
