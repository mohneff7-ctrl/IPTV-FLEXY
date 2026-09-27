import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayback, type PlaybackSession } from '../store/playback';
import { isWatched, useLibrary } from '../store/library';
import { useSettings } from '../store/settings';
import { useActiveAddons } from '../store/addons';
import { getSubtitles } from '../lib/stremio';
import { playableUrl } from '../lib/streams';
import { langName } from '../lib/subtitles';
import { nativePlay, setupStatusBar } from '../lib/native';
import { useT } from '../lib/i18n';
import { episodeLabel, findNextStream, nextVideo } from './next';
import { Spinner, toast } from '../components/ui';

/** How long we wait for subtitle addons before starting (playback speed wins). */
const SUBTITLE_WAIT_MS = 2500;

/**
 * Hands the stream to the native ExoPlayer screen (Android), then saves
 * progress and chains the next episode when it returns.
 */
export function NativeLauncher({ session, onFallback }: { session: PlaybackSession; onFallback: () => void }) {
  const t = useT();
  const nav = useNavigate();
  const addons = useActiveAddons();
  const settings = useSettings();
  const startSession = usePlayback((s) => s.start);
  const saveProgress = useLibrary((s) => s.saveProgress);
  const launched = useRef(false);

  useEffect(() => {
    if (launched.current) return;
    launched.current = true;
    const { stream, meta, video, videoId } = session;

    (async () => {
      const url = playableUrl(stream);
      if (!url) return onFallback();

      // Resume point.
      const saved = useLibrary.getState().progress[videoId];
      const trackProgress = !!meta && !videoId.startsWith('trailer:');
      const startMs =
        trackProgress && settings.resumePlayback && saved && !isWatched(saved) && saved.time > 10 ? Math.floor((saved.time - 3) * 1000) : 0;

      // Subtitles: from the stream itself + every subtitle addon (bounded wait).
      const embedded = (stream.subtitles ?? []).map((s) => ({ url: s.url, lang: s.lang, label: `${langName(s.lang, settings.lang)} · ${stream.addonName}` }));
      const fromAddons = meta
        ? await Promise.race([
            getSubtitles(addons, meta.type, videoId, {
              videoSize: stream.behaviorHints?.videoSize,
              filename: stream.behaviorHints?.filename,
            }).catch(() => []),
            new Promise<[]>((r) => setTimeout(() => r([]), SUBTITLE_WAIT_MS)),
          ])
        : [];
      const pref = settings.subtitleLang.slice(0, 2);
      const subtitles = [
        ...embedded,
        ...fromAddons.map((s) => ({ url: s.url, lang: s.lang, label: `${langName(s.lang, settings.lang)} · ${s.addonName}` })),
      ]
        .sort((a, b) => Number(b.lang?.startsWith(pref)) - Number(a.lang?.startsWith(pref)))
        .slice(0, 40);

      const res = await nativePlay({
        url,
        title: session.title,
        subtitle: session.subtitle,
        headers: stream.behaviorHints?.proxyHeaders?.request,
        subtitles,
        startMs,
        highest: settings.maxQuality,
        subLang: settings.subtitleLang,
      }).catch((e) => ({ error: String(e) }) as { error: string; position?: number; duration?: number; ended?: boolean });

      setupStatusBar(); // restore FLEXY's dark system bars after the player

      // Save progress (seconds) like the web player does.
      const position = (res.position ?? 0) / 1000;
      const duration = (res.duration ?? -1) / 1000;
      if (trackProgress && meta && duration > 30 && position > 5) {
        saveProgress({
          videoId,
          metaId: meta.id,
          type: meta.type,
          name: meta.name,
          poster: meta.poster,
          background: meta.background,
          thumbnail: video?.thumbnail,
          season: video?.season,
          episode: video?.episode ?? video?.number,
          episodeTitle: video?.title ?? video?.name,
          time: res.ended ? duration : position,
          duration,
        });
      }

      if (res.error && position < 1) {
        toast(settings.lang === 'ar' ? 'جاري المحاولة بالمشغل الثاني…' : 'Trying the second player…');
        return onFallback();
      }

      const next = nextVideo(meta?.videos, video);
      if (res.ended && next && meta && settings.autoplayNext) {
        const found = await findNextStream(addons, meta.type, next.id, stream);
        if (found) {
          startSession({ ...session, stream: found, video: next, videoId: next.id, subtitle: episodeLabel(next, t) });
          return;
        }
        nav(`/detail/${encodeURIComponent(meta.type)}/${encodeURIComponent(meta.id)}?play=${encodeURIComponent(next.id)}`, { replace: true });
        return;
      }
      if (history.length > 1) nav(-1);
      else nav('/', { replace: true });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="player native-launch" dir="auto">
      <Spinner size={56} />
      <strong>{session.title}</strong>
      {session.subtitle && <span>{session.subtitle}</span>}
    </div>
  );
}
