import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayback, type PlaybackSession } from '../store/playback';
import { isWatched, useLibrary } from '../store/library';
import { useSettings, type FitMode } from '../store/settings';
import { useActiveAddons } from '../store/addons';
import { getSubtitles } from '../lib/stremio';
import { externalPlayerUrl, playableUrl } from '../lib/streams';
import { activeCues, langName, loadSubtitle, type Cue } from '../lib/subtitles';
import { useT } from '../lib/i18n';
import { cx, formatTime } from '../lib/format';
import { createEngine, engineOrder, type Engine } from './engine';
import { SeekBar } from './SeekBar';
import { episodeLabel, findNextStream, nextVideo } from './next';
import { NativeLauncher } from './NativeLauncher';
import { enterPlayerMode, exitPlayerMode, hasNativePlayer } from '../lib/native';
import { Spinner, toast } from '../components/ui';
import {
  IconAspect,
  IconBack,
  IconCC,
  IconExternal,
  IconForward,
  IconFullscreen,
  IconFullscreenExit,
  IconLayers,
  IconLock,
  IconMute,
  IconNext,
  IconPause,
  IconPip,
  IconPlay,
  IconReplay,
  IconSpeed,
  IconVolume,
} from '../components/Icons';

type Menu = null | 'subs' | 'quality' | 'speed' | 'audio' | 'fit';
interface SubOption {
  id: string;
  url: string;
  lang: string;
  label: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const FITS: FitMode[] = ['contain', 'cover', 'fill'];
const HIDE_AFTER = 3200;

export default function Player() {
  const session = usePlayback((s) => s.session);
  const engine = useSettings((s) => s.playerEngine);
  const nav = useNavigate();
  const key = session ? session.videoId + (session.stream.url ?? session.stream.infoHash) : '';
  // Streams the native player could not open fall back to the web player.
  const [webOnly, setWebOnly] = useState<string | null>(null);
  useEffect(() => {
    if (!session) nav('/', { replace: true });
  }, [session, nav]);
  if (!session) return null;
  if (session.stream.ytId) return <YouTubePlayer session={session} />;
  if (hasNativePlayer() && engine === 'native' && webOnly !== key) {
    return <NativeLauncher key={key} session={session} onFallback={() => setWebOnly(key)} />;
  }
  return <VideoPlayer key={key} session={session} />;
}

function YouTubePlayer({ session }: { session: PlaybackSession }) {
  const nav = useNavigate();
  return (
    <div className="player" dir="ltr">
      <iframe
        className="yt-frame"
        src={`https://www.youtube-nocookie.com/embed/${session.stream.ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        title={session.title}
      />
      <button className="p-btn yt-back" onClick={() => nav(-1)} aria-label="back">
        <IconBack size={26} style={{ transform: 'scaleX(-1)' }} />
      </button>
    </div>
  );
}

function VideoPlayer({ session }: { session: PlaybackSession }) {
  const t = useT();
  const nav = useNavigate();
  const settings = useSettings();
  const addons = useActiveAddons();
  const startSession = usePlayback((s) => s.start);
  const saveProgress = useLibrary((s) => s.saveProgress);

  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTap = useRef<{ t: number; x: number } | null>(null);
  const resumed = useRef(false);
  // Last known position: survives the engine teardown that resets the <video>.
  const pos = useRef({ time: 0, duration: 0 });

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const [fit, setFit] = useState<FitMode>(settings.fitMode);
  const [, setTracksVersion] = useState(0);
  const [subOptions, setSubOptions] = useState<SubOption[]>([]);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [subDelay, setSubDelay] = useState(0);
  const [ripple, setRipple] = useState<{ side: 'l' | 'r'; n: number } | null>(null);
  const [nextLoading, setNextLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const { stream, meta, video } = session;
  const url = useMemo(() => playableUrl(stream), [stream]);
  const live = duration === Infinity || engineRef.current?.kind === 'mpegts' || session.type === 'tv';
  const next = useMemo(() => nextVideo(meta?.videos, video), [meta, video]);
  const trackProgress = !!meta && !session.videoId.startsWith('trailer:');

  useEffect(() => {
    enterPlayerMode();
    return () => {
      exitPlayerMode();
    };
  }, []);

  /* ---------------- engine lifecycle with automatic fallback ---------------- */

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !url) {
      setError('no-url');
      return;
    }
    let cancelled = false;
    const order = engineOrder(url);
    let attempt = 0;
    const tryNext = async (reason?: string) => {
      engineRef.current?.destroy();
      engineRef.current = null;
      if (cancelled) return;
      if (attempt >= order.length) {
        setError(reason ?? 'unsupported');
        setWaiting(false);
        return;
      }
      const kind = order[attempt++];
      try {
        const engine = await createEngine(kind, el, url, {
          onFatal: (r) => !cancelled && engineRef.current === engine && tryNext(r),
          onTracks: () => setTracksVersion((v) => v + 1),
          highest: settings.maxQuality,
        });
        if (cancelled) return engine.destroy();
        engineRef.current = engine;
        el.play().catch(() => undefined);
      } catch (e) {
        tryNext(String(e));
      }
    };
    setError(null);
    setWaiting(true);
    tryNext();
    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [url]);

  /* ---------------- progress persistence ---------------- */

  const persist = useCallback(() => {
    const { time: at, duration: total } = pos.current;
    if (!meta || !trackProgress || !isFinite(total) || total < 30 || at < 5) return;
    saveProgress({
      videoId: session.videoId,
      metaId: meta.id,
      type: meta.type,
      name: meta.name,
      poster: meta.poster,
      background: meta.background,
      thumbnail: video?.thumbnail,
      season: video?.season,
      episode: video?.episode ?? video?.number,
      episodeTitle: video?.title ?? video?.name,
      time: at,
      duration: total,
    });
  }, [meta, video, session.videoId, saveProgress, trackProgress]);

  useEffect(() => {
    const id = setInterval(() => !videoRef.current?.paused && persist(), 5000);
    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(id);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      persist();
    };
  }, [persist]);

  /* ---------------- video element events ---------------- */

  useEffect(() => {
    const el = videoRef.current!;
    const onTime = () => {
      if (el.currentTime > 0 && isFinite(el.duration)) pos.current = { time: el.currentTime, duration: el.duration };
      setTime(el.currentTime);
      const b = el.buffered;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= el.currentTime + 0.5 && b.end(i) >= el.currentTime) {
          setBuffered(b.end(i));
          break;
        }
      }
    };
    const onMeta = () => {
      setDuration(el.duration);
      if (resumed.current || !trackProgress || !settings.resumePlayback) return;
      resumed.current = true;
      const saved = useLibrary.getState().progress[session.videoId];
      if (saved && !isWatched(saved) && saved.time > 10 && isFinite(el.duration)) {
        el.currentTime = saved.time - 3;
        toast(t('resumedFrom', { t: formatTime(saved.time) }), {
          label: t('startOver'),
          run: () => {
            if (videoRef.current) videoRef.current.currentTime = 0;
          },
        });
      }
    };
    const handlers: [string, () => void][] = [
      ['play', () => setPlaying(true)],
      ['pause', () => (setPlaying(false), persist())],
      ['timeupdate', onTime],
      ['progress', onTime],
      ['durationchange', () => setDuration(el.duration)],
      ['loadedmetadata', onMeta],
      ['waiting', () => setWaiting(true)],
      ['stalled', () => setWaiting(true)],
      ['playing', () => (setWaiting(false), setError(null))],
      ['canplay', () => setWaiting(false)],
      ['volumechange', () => (setVolume(el.volume), setMuted(el.muted))],
      ['ratechange', () => setRate(el.playbackRate)],
      ['ended', () => onEnded()],
    ];
    handlers.forEach(([e, h]) => el.addEventListener(e, h));
    return () => handlers.forEach(([e, h]) => el.removeEventListener(e, h));
  }); // re-bound each render so handlers see fresh state

  /* ---------------- subtitles ---------------- */

  useEffect(() => {
    let alive = true;
    const embedded: SubOption[] = (stream.subtitles ?? []).map((s, i) => ({
      id: `s${i}`,
      url: s.url,
      lang: s.lang,
      label: `${langName(s.lang, settings.lang)} · ${stream.addonName}`,
    }));
    setSubOptions(embedded);
    if (!meta) return;
    getSubtitles(addons, meta.type, session.videoId, {
      videoSize: stream.behaviorHints?.videoSize,
      filename: stream.behaviorHints?.filename,
    }).then((list) => {
      if (!alive) return;
      const extra = list.map((s, i) => ({
        id: s.id ? `${s.addonName}:${s.id}` : `a${i}`,
        url: s.url,
        lang: s.lang,
        label: `${langName(s.lang, settings.lang)} · ${s.addonName}`,
      }));
      const all = [...embedded, ...extra];
      setSubOptions(all);
      const preferred = all.find((s) => s.lang?.toLowerCase().startsWith(settings.subtitleLang.slice(0, 2)));
      if (preferred) chooseSub(preferred);
    });
    return () => {
      alive = false;
    };
  }, [session.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseSub = async (opt: SubOption | null) => {
    setMenu(null);
    if (!opt) {
      setActiveSub(null);
      setCues([]);
      return;
    }
    setActiveSub(opt.id);
    try {
      setCues(await loadSubtitle(opt.url));
    } catch {
      toast(t('error'));
      setActiveSub(null);
    }
  };

  const shownCues = useMemo(() => (cues.length ? activeCues(cues, time - subDelay) : []), [cues, time, subDelay]);

  /* ---------------- controls visibility ---------------- */

  const poke = useCallback(() => {
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!videoRef.current?.paused) {
        setVisible(false);
        setMenu(null);
      }
    }, HIDE_AFTER);
  }, []);

  useEffect(() => {
    poke();
    return () => clearTimeout(hideTimer.current);
  }, [poke, playing]);

  /* ---------------- actions ---------------- */

  const togglePlay = () => {
    const el = videoRef.current!;
    if (el.paused) el.play().catch(() => undefined);
    else el.pause();
  };

  const seekBy = (d: number) => {
    const el = videoRef.current!;
    if (live) return;
    el.currentTime = Math.max(0, Math.min((el.duration || 0) - 0.5, el.currentTime + d));
    setTime(el.currentTime);
  };

  const seekTo = (s: number) => {
    const el = videoRef.current!;
    el.currentTime = s;
    setTime(s);
  };

  const setVol = (v: number) => {
    const el = videoRef.current!;
    el.volume = Math.max(0, Math.min(1, v));
    el.muted = el.volume === 0;
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await rootRef.current?.requestFullscreen({ navigationUI: 'hide' });
        await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => undefined);
      }
    } catch {
      // iOS Safari: only the video element itself can go fullscreen.
      (videoRef.current as unknown as { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen?.();
    }
  };

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const togglePip = async () => {
    const el = videoRef.current!;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await el.requestPictureInPicture();
    } catch {
      /* unsupported */
    }
  };

  const exit = () => {
    persist();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    history.length > 1 ? nav(-1) : nav('/');
  };

  const anotherStream = () => {
    persist();
    if (meta) nav(`/detail/${encodeURIComponent(meta.type)}/${encodeURIComponent(meta.id)}?play=${encodeURIComponent(session.videoId)}`, { replace: true });
    else nav(-1);
  };

  /** Finds the best stream for the next episode (same bingeGroup first, like Stremio). */
  const playNext = useCallback(async () => {
    if (!next || !meta || nextLoading) return;
    setNextLoading(true);
    setCountdown(null);
    persist();
    const found = await findNextStream(addons, meta.type, next.id, stream);
    setNextLoading(false);
    if (!found) {
      nav(`/detail/${encodeURIComponent(meta.type)}/${encodeURIComponent(meta.id)}?play=${encodeURIComponent(next.id)}`, { replace: true });
      return;
    }
    startSession({
      ...session,
      stream: found,
      video: next,
      videoId: next.id,
      subtitle: episodeLabel(next, t),
    });
  }, [next, meta, nextLoading, persist, stream, addons, startSession, session, t, nav]);

  function onEnded() {
    persist();
    if (next && settings.autoplayNext) setCountdown(5);
  }

  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      playNext();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c == null ? c : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown, playNext]);

  /* ---------------- keyboard & media session ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const step = settings.seekStep;
      switch (e.key) {
        case ' ':
        case 'k':
        case 'MediaPlayPause':
          togglePlay();
          break;
        case 'ArrowRight':
          seekBy(step);
          break;
        case 'ArrowLeft':
          seekBy(-step);
          break;
        case 'ArrowUp':
          setVol(volume + 0.1);
          break;
        case 'ArrowDown':
          setVol(volume - 0.1);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          videoRef.current!.muted = !videoRef.current!.muted;
          break;
        case 'n':
          playNext();
          break;
        case 'Escape':
        case 'Backspace':
          if (menu) setMenu(null);
          else if (!document.fullscreenElement) exit();
          break;
        default:
          return;
      }
      e.preventDefault();
      poke();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: session.subtitle ? `${session.title} — ${session.subtitle}` : session.title,
      artist: 'FLEXY',
      artwork: session.poster ? [{ src: session.poster, sizes: '300x450' }] : [],
    });
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => videoRef.current?.play());
    ms.setActionHandler('pause', () => videoRef.current?.pause());
    ms.setActionHandler('seekbackward', () => seekBy(-settings.seekStep));
    ms.setActionHandler('seekforward', () => seekBy(settings.seekStep));
    ms.setActionHandler('nexttrack', next ? () => playNext() : null);
    return () => {
      ['play', 'pause', 'seekbackward', 'seekforward', 'nexttrack'].forEach((a) =>
        ms.setActionHandler(a as MediaSessionAction, null),
      );
    };
  }, [session, next]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the screen awake while playing.
  useEffect(() => {
    if (!playing || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => undefined);
    return () => {
      lock?.release().catch(() => undefined);
    };
  }, [playing]);

  /* ---------------- gestures ---------------- */

  const onSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (locked) return poke();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const now = Date.now();
    const prev = lastTap.current;
    lastTap.current = { t: now, x };
    // Double tap on the sides = seek (like YouTube / Netflix).
    if (prev && now - prev.t < 300 && Math.abs(prev.x - x) < 0.15 && (x < 0.35 || x > 0.65)) {
      const side = x < 0.5 ? 'l' : 'r';
      seekBy(side === 'l' ? -settings.seekStep : settings.seekStep);
      setRipple((r) => ({ side, n: r && r.side === side ? r.n + 1 : 1 }));
      setTimeout(() => setRipple(null), 650);
      lastTap.current = null;
      return;
    }
    const isTouch = (e.nativeEvent as PointerEvent).pointerType === 'touch' || matchMedia('(hover: none)').matches;
    if (isTouch) {
      if (visible) {
        setVisible(false);
        setMenu(null);
      } else poke();
    } else {
      togglePlay();
      poke();
    }
  };

  /* ---------------- render ---------------- */

  const engine = engineRef.current;
  const levels = engine?.levels ?? [];
  const audioTracks = engine?.audioTracks ?? [];
  const showNextButton = !!next && !live && duration > 0 && duration - time < 45;
  const fitLabel = { contain: t('fitContain'), cover: t('fitCover'), fill: t('fitFill') }[fit];

  return (
    <div
      ref={rootRef}
      className={cx('player', !visible && 'hide-ui', locked && 'locked')}
      dir="ltr"
      onMouseMove={poke}
      style={{ '--sub-scale': settings.subtitleSize / 100 } as React.CSSProperties}
    >
      <video ref={videoRef} className={`fit-${fit}`} playsInline autoPlay preload="auto" poster={meta?.background} />

      <div className="p-surface" onClick={onSurfaceClick} />
      <div className="p-watermark">FLEXY</div>

      {ripple && (
        <div className={cx('p-ripple', ripple.side === 'l' ? 'left' : 'right')}>
          {ripple.side === 'l' ? <IconReplay size={34} /> : <IconForward size={34} />}
          <span>{ripple.n * settings.seekStep}s</span>
        </div>
      )}

      {shownCues.length > 0 && (
        <div className={cx('p-subs', settings.subtitleBackground && 'boxed', visible && 'raised')} dir="auto">
          {shownCues.map((c, i) => (
            <span key={i} dangerouslySetInnerHTML={{ __html: c.text.replace(/\n/g, '<br/>') }} />
          ))}
        </div>
      )}

      {(waiting || nextLoading) && !error && (
        <div className="p-center-spinner">
          <Spinner size={56} />
        </div>
      )}

      {locked ? (
        <button className={cx('p-btn p-unlock', visible && 'show')} onClick={() => setLocked(false)} aria-label="unlock">
          <IconLock size={26} />
        </button>
      ) : (
        <>
          <div className="p-top">
            <button className="p-btn" onClick={exit} aria-label={t('back')}>
              <IconBack size={28} style={{ transform: 'scaleX(-1)' }} />
            </button>
            <div className="p-titles" dir="auto">
              <strong>{session.title}</strong>
              {session.subtitle && <span>{session.subtitle}</span>}
            </div>
            <button className="p-btn" onClick={() => setLocked(true)} aria-label="lock">
              <IconLock size={22} />
            </button>
            {url && (
              <a className="p-btn" href={externalPlayerUrl(url)} target="_blank" rel="noopener" aria-label={t('openExternal')} title={t('openExternal')}>
                <IconExternal size={22} />
              </a>
            )}
          </div>

          <div className="p-center">
            {!live && (
              <button className="p-btn p-big-side" onClick={() => seekBy(-settings.seekStep)} aria-label="-10">
                <IconReplay size={40} />
              </button>
            )}
            <button className="p-btn p-big" onClick={togglePlay} aria-label={playing ? 'pause' : 'play'}>
              {playing ? <IconPause size={46} /> : <IconPlay size={46} />}
            </button>
            {!live && (
              <button className="p-btn p-big-side" onClick={() => seekBy(settings.seekStep)} aria-label="+10">
                <IconForward size={40} />
              </button>
            )}
          </div>

          <div className="p-bottom">
            {live ? (
              <div className="p-live">
                <span className="live-dot" /> {t('live')}
              </div>
            ) : (
              <div className="p-seek-row">
                <span className="p-time">{formatTime(time)}</span>
                <SeekBar value={time} max={duration} buffered={buffered} onSeek={seekTo} onScrub={poke} />
                <span className="p-time">-{formatTime(Math.max(0, duration - time))}</span>
              </div>
            )}
            <div className="p-controls">
              <button className="p-btn" onClick={togglePlay} aria-label={playing ? 'pause' : 'play'}>
                {playing ? <IconPause size={26} /> : <IconPlay size={26} />}
              </button>
              <div className="p-volume">
                <button className="p-btn" onClick={() => (videoRef.current!.muted = !muted)} aria-label="mute">
                  {muted || volume === 0 ? <IconMute size={24} /> : <IconVolume size={24} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={muted ? 0 : volume}
                  onChange={(e) => setVol(Number(e.target.value))}
                  aria-label="volume"
                />
              </div>
              <div className="p-spacer" />
              {next && (
                <button className="p-btn p-text-btn" onClick={playNext} aria-label={t('nextEpisode')}>
                  <IconNext size={22} /> <span className="hide-sm">{t('nextEpisode')}</span>
                </button>
              )}
              <button className={cx('p-btn', activeSub && 'on')} onClick={() => setMenu(menu === 'subs' ? null : 'subs')} aria-label={t('subtitles')}>
                <IconCC size={26} />
              </button>
              {(levels.length > 1 || audioTracks.length > 1) && (
                <button className="p-btn" onClick={() => setMenu(menu === 'quality' ? null : 'quality')} aria-label={t('quality')}>
                  <IconLayers size={24} />
                </button>
              )}
              <button className="p-btn" onClick={() => setMenu(menu === 'speed' ? null : 'speed')} aria-label={t('speed')}>
                <IconSpeed size={24} />
              </button>
              <button className="p-btn" onClick={() => setFit(FITS[(FITS.indexOf(fit) + 1) % FITS.length])} aria-label={t('fit')} title={fitLabel}>
                <IconAspect size={24} />
              </button>
              {'pictureInPictureEnabled' in document && (
                <button className="p-btn hide-sm" onClick={togglePip} aria-label="PiP">
                  <IconPip size={24} />
                </button>
              )}
              <button className="p-btn" onClick={toggleFullscreen} aria-label="fullscreen">
                {fullscreen ? <IconFullscreenExit size={24} /> : <IconFullscreen size={24} />}
              </button>
            </div>
          </div>
        </>
      )}

      {menu && (
        <div className="p-menu" dir={settings.lang === 'ar' ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
          {menu === 'subs' && (
            <>
              <h4>{t('subtitles')}</h4>
              <div className="p-delay">
                <span>{t('subtitleDelay')}</span>
                <button onClick={() => setSubDelay((d) => +(d - 0.25).toFixed(2))}>−</button>
                <b dir="ltr">{subDelay > 0 ? '+' : ''}{subDelay.toFixed(2)}s</b>
                <button onClick={() => setSubDelay((d) => +(d + 0.25).toFixed(2))}>+</button>
              </div>
              <button className={cx('p-opt', !activeSub && 'on')} onClick={() => chooseSub(null)}>
                {t('off')}
              </button>
              {subOptions.map((s) => (
                <button key={s.id} className={cx('p-opt', activeSub === s.id && 'on')} onClick={() => chooseSub(s)}>
                  {s.label}
                </button>
              ))}
            </>
          )}
          {menu === 'quality' && (
            <>
              {levels.length > 1 && (
                <>
                  <h4>{t('quality')}</h4>
                  <button className={cx('p-opt', engine?.getLevel() === -1 && 'on')} onClick={() => (engine?.setLevel(-1), setMenu(null))}>
                    {t('auto')}
                  </button>
                  {levels.map((l) => (
                    <button
                      key={l.index}
                      className={cx('p-opt', engine?.getLevel() === l.index && 'on')}
                      onClick={() => (engine?.setLevel(l.index), setMenu(null))}
                    >
                      {l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps`}
                    </button>
                  ))}
                </>
              )}
              {audioTracks.length > 1 && (
                <>
                  <h4>{t('audio')}</h4>
                  {audioTracks.map((a) => (
                    <button
                      key={a.index}
                      className={cx('p-opt', engine?.getAudioTrack() === a.index && 'on')}
                      onClick={() => (engine?.setAudioTrack(a.index), setMenu(null))}
                    >
                      {a.name || langName(a.lang ?? '', settings.lang)}
                    </button>
                  ))}
                </>
              )}
            </>
          )}
          {menu === 'speed' && (
            <>
              <h4>{t('speed')}</h4>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  className={cx('p-opt', rate === s && 'on')}
                  onClick={() => {
                    videoRef.current!.playbackRate = s;
                    setMenu(null);
                  }}
                >
                  {s === 1 ? t('normal') : `${s}x`}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {showNextButton && countdown == null && !nextLoading && (
        <button className="p-next-float" onClick={playNext}>
          <IconNext size={20} /> {t('nextEpisode')}
        </button>
      )}

      {countdown != null && (
        <div className="p-countdown">
          <p>{t('nextIn', { n: countdown })}</p>
          <div className="p-countdown-actions">
            <button className="btn btn-primary" onClick={playNext}>
              <IconPlay size={18} /> {t('nextEpisode')}
            </button>
            <button className="btn btn-outline" onClick={() => setCountdown(null)}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-error" dir={settings.lang === 'ar' ? 'rtl' : 'ltr'}>
          <h3>{t('playbackError')}</h3>
          <p>{t('playbackErrorHint')}</p>
          <div className="p-error-actions">
            <button className="btn btn-primary" onClick={anotherStream}>
              {t('tryAnother')}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => location.reload()}
            >
              {t('retry')}
            </button>
            {url && (
              <a className="btn btn-outline" href={externalPlayerUrl(url)} target="_blank" rel="noopener">
                <IconExternal size={18} /> {t('openExternal')}
              </a>
            )}
          </div>
          <small className="p-error-code">{error}</small>
        </div>
      )}
    </div>
  );
}
