import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Meta, SourcedStream, Video } from '../lib/types';
import { getStreams, supports } from '../lib/stremio';
import {
  QUALITY_ORDER,
  externalPlayerUrl,
  playableUrl,
  qualityOf,
  streamKind,
  streamLabel,
  streamTags,
  type Quality,
} from '../lib/streams';
import { useAddons } from '../store/addons';
import { usePlayback } from '../store/playback';
import { useSettings } from '../store/settings';
import { useT } from '../lib/i18n';
import { cx } from '../lib/format';
import { Empty, Sheet, Spinner, toast } from './ui';
import { IconCopy, IconDownload, IconExternal, IconPlay } from './Icons';

export interface StreamTarget {
  meta: Meta;
  video?: Video;
  videoId: string;
}

/** Starts playback for a stream, handling torrents, YouTube and external links. */
export function usePlayStream() {
  const nav = useNavigate();
  const start = usePlayback((s) => s.start);
  const t = useT();
  return (stream: SourcedStream, target: StreamTarget) => {
    const kind = streamKind(stream);
    if (kind === 'external') {
      window.open(stream.externalUrl, '_blank', 'noopener');
      return;
    }
    if (kind === 'torrent' && !playableUrl(stream)) {
      toast(t('torrentNeedsServer'), { label: t('settings'), run: () => nav('/settings') });
      return;
    }
    const { meta, video, videoId } = target;
    const epLabel =
      video && video.season != null
        ? `${t('season')} ${video.season} · ${t('episode')} ${video.episode ?? video.number}${video.title || video.name ? ' — ' + (video.title || video.name) : ''}`
        : undefined;
    start({
      stream,
      meta,
      video,
      videoId,
      type: meta.type,
      title: meta.name,
      subtitle: epLabel,
      poster: meta.poster,
    });
    nav('/play');
  };
}

export function StreamSheet({
  open,
  onClose,
  target,
  mode = 'watch',
}: {
  open: boolean;
  onClose: () => void;
  target: StreamTarget | null;
  mode?: 'watch' | 'download';
}) {
  const t = useT();
  const addons = useAddons((s) => s.addons);
  const preferred = useSettings((s) => s.preferredQuality);
  const [streams, setStreams] = useState<SourcedStream[]>([]);
  const [pending, setPending] = useState(0);
  const [addonFilter, setAddonFilter] = useState<string>();
  const play = usePlayStream();

  const type = target?.meta.type ?? '';
  const id = target?.videoId ?? '';
  const streamAddons = useMemo(() => addons.filter((a) => supports(a, 'stream', type, id)), [addons, type, id]);

  useEffect(() => {
    if (!open || !target) return;
    setStreams([]);
    setAddonFilter(undefined);
    // Streams embedded in the meta (e.g. YouTube / channel addons) come first.
    const embedded: SourcedStream[] = (target.video?.streams ?? []).map((s) => ({ ...s, addonId: 'meta', addonName: target.meta.name }));
    return getStreams(addons, type, id, (list, p) => {
      setStreams([...embedded, ...list]);
      setPending(p);
    });
  }, [open, target, addons, type, id]);

  const grouped = useMemo(() => {
    const filtered = addonFilter ? streams.filter((s) => s.addonId === addonFilter) : streams;
    const map = new Map<Quality, SourcedStream[]>();
    filtered.forEach((s) => {
      const q = qualityOf(s);
      map.set(q, [...(map.get(q) ?? []), s]);
    });
    const order = [...QUALITY_ORDER];
    if (preferred !== 'auto') order.sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : 0));
    return order.filter((q) => map.has(q)).map((q) => [q, map.get(q)!] as const);
  }, [streams, addonFilter, preferred]);

  const addonNames = useMemo(() => {
    const m = new Map<string, string>();
    streams.forEach((s) => m.set(s.addonId, s.addonName));
    return [...m.entries()];
  }, [streams]);

  const onPick = (s: SourcedStream) => {
    if (!target) return;
    if (mode === 'download') {
      const url = playableUrl(s) ?? s.externalUrl;
      if (!url) return toast(t('torrentNeedsServer'));
      const a = document.createElement('a');
      a.href = url;
      a.download = s.behaviorHints?.filename ?? '';
      a.target = '_blank';
      a.rel = 'noopener';
      a.click();
      return;
    }
    play(s, target);
  };

  const copy = async (s: SourcedStream) => {
    const url = playableUrl(s) ?? s.externalUrl ?? (s.infoHash ? `magnet:?xt=urn:btih:${s.infoHash}` : '');
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    toast(t('copied'));
  };

  const loading = pending > 0;

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'download' ? t('downloadLinks') : t('watchLinks')}>
      {addonNames.length > 1 && (
        <div className="chips row-scroll sheet-chips">
          <button className={cx('chip', !addonFilter && 'active')} onClick={() => setAddonFilter(undefined)}>
            {t('all')} ({streams.length})
          </button>
          {addonNames.map(([aid, name]) => (
            <button key={aid} className={cx('chip', addonFilter === aid && 'active')} onClick={() => setAddonFilter(aid)}>
              {name} ({streams.filter((s) => s.addonId === aid).length})
            </button>
          ))}
        </div>
      )}
      {loading && (
        <div className="sheet-loading">
          <Spinner size={22} /> {t('loadingStreams', { n: pending })}
        </div>
      )}
      {!loading && !streams.length && (
        <Empty title={streamAddons.length ? t('noStreams') : t('noStreamAddons')} text={t('noStreamsHint')} />
      )}
      {grouped.map(([q, list]) => (
        <fieldset key={q} className="quality-group">
          <legend className="quality-pill">{q === 'multi' ? t('multi') : q.toUpperCase()}</legend>
          {list.map((s, i) => {
            const { title, subtitle } = streamLabel(s);
            const kind = streamKind(s);
            const tags = streamTags(s);
            const url = playableUrl(s);
            return (
              <div key={i} className="stream-row">
                <button className="stream-btn" onClick={() => onPick(s)}>
                  <span className="stream-play">{mode === 'download' ? <IconDownload size={22} /> : <IconPlay size={22} />}</span>
                  <span className="stream-text">
                    <strong>{title}</strong>
                    {subtitle && <small>{subtitle}</small>}
                    <span className="stream-tags">
                      <span className="tag tag-dark">{t(kind)}</span>
                      {tags.map((x) => (
                        <span key={x} className="tag">
                          {x}
                        </span>
                      ))}
                      {s.addonName && <span className="tag tag-ghost">{s.addonName}</span>}
                    </span>
                  </span>
                </button>
                <div className="stream-side">
                  <button className="icon-btn sm" onClick={() => copy(s)} aria-label={t('copyLink')} title={t('copyLink')}>
                    <IconCopy size={18} />
                  </button>
                  {url && (
                    <a className="icon-btn sm" href={externalPlayerUrl(url)} target="_blank" rel="noopener" aria-label={t('openExternal')} title={t('openExternal')}>
                      <IconExternal size={18} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </fieldset>
      ))}
    </Sheet>
  );
}
