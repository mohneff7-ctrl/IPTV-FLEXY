/**
 * The app was renamed from FLEXY to LAYAN. Copy data saved under the old
 * storage keys once, before the stores hydrate, so nothing is lost.
 * Imported first in main.tsx for that reason.
 */
const KEYS = ['settings', 'library', 'addons', 'playlists'];

try {
  for (const k of KEYS) {
    const old = localStorage.getItem(`flexy.${k}`);
    if (old != null && localStorage.getItem(`layan.${k}`) == null) {
      localStorage.setItem(`layan.${k}`, old);
      localStorage.removeItem(`flexy.${k}`);
    }
  }
} catch {
  /* storage unavailable (private mode) */
}
