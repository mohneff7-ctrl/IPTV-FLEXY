import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

const MAX_MS = 5000;

/**
 * Audio/video sync. Routes the <video> element's sound through a Web Audio
 * DelayNode so the sound can be pushed later than the picture.
 *
 * The graph is only built the first time the viewer asks for a delay: once an
 * element is connected to Web Audio it cannot be disconnected, and a
 * cross-origin source without CORS headers would come out silent. MSE engines
 * (hls.js, mpegts.js) play from a same-origin blob: URL, so they are safe;
 * a direct cross-origin file is reported as unavailable instead of muting it.
 */
export function useAudioDelay(videoRef: RefObject<HTMLVideoElement | null>) {
  const [ms, setMs] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const graph = useRef<{ ctx: AudioContext; delay: DelayNode } | null>(null);

  const canProcess = (el: HTMLVideoElement) => {
    const src = el.currentSrc || el.src;
    if (!src || src.startsWith('blob:')) return true;
    try {
      return new URL(src, location.href).origin === location.origin;
    } catch {
      return false;
    }
  };

  const set = useCallback(
    (value: number) => {
      const el = videoRef.current;
      if (!el) return;
      const next = Math.max(0, Math.min(MAX_MS, Math.round(value / 10) * 10));
      if (!graph.current) {
        if (next === 0) return setMs(0);
        if (!canProcess(el)) return setUnavailable(true);
        try {
          const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new Ctx();
          const source = ctx.createMediaElementSource(el);
          const delay = ctx.createDelay(MAX_MS / 1000);
          source.connect(delay).connect(ctx.destination);
          graph.current = { ctx, delay };
        } catch {
          return setUnavailable(true);
        }
      }
      const { ctx, delay } = graph.current;
      ctx.resume().catch(() => undefined);
      delay.delayTime.setTargetAtTime(next / 1000, ctx.currentTime, 0.05);
      setMs(next);
    },
    [videoRef],
  );

  // Browsers suspend idle audio contexts; wake it whenever playback resumes.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => graph.current?.ctx.resume().catch(() => undefined);
    el.addEventListener('play', onPlay);
    return () => {
      el.removeEventListener('play', onPlay);
    };
  }, [videoRef]);

  useEffect(
    () => () => {
      graph.current?.ctx.close().catch(() => undefined);
      graph.current = null;
    },
    [],
  );

  return { ms, set, unavailable };
}
