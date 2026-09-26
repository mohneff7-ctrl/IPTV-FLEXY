export function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "100 min" → "1:40:00" (the screenshot style). */
export function formatRuntime(runtime?: string): string | undefined {
  if (!runtime) return undefined;
  const min = parseInt(runtime, 10);
  if (!min || /h/i.test(runtime)) return runtime;
  return formatTime(min * 60);
}

export function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
