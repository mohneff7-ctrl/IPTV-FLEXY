import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Meta, MetaPreview, Video } from '../lib/types';
import { backgroundOf, previewOf, catalogExtras, genresOf, getCatalog, getMeta, logoOf, posterOf, trailerOf, yearOf } from '../lib/stremio';
import { useActiveAddons, useAddons } from '../store/addons';
import { isWatched, useLibrary } from '../store/library';
import { useSettings } from '../store/settings';
import { usePlayback } from '../store/playback';
import { genreLabel, useT } from '../lib/i18n';
import { cx, formatDate, formatRuntime, formatTime } from '../lib/format';
import { StreamSheet, type StreamTarget } from '../components/StreamSheet';
import { MetaRow } from '../components/Rows';
import { WatchedMark } from '../components/Cards';
import { shareApp } from '../components/Shell';
import { Empty, Img, Rating, SectionTitle, Sheet, Spinner, toast } from '../components/ui';
import {
  IconBack,
  IconCheck,
  IconClapper,
  IconDownload,
  IconHeart,
  IconHeartFill,
  IconInfo,
  IconPlay,
  IconSearch,
  IconShare,
  IconSort,
} from '../components/Icons';

const epNum = (v: Video) => v.episode ?? v.number ?? 0;

export default function Detail() {
  const { type = '', id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const addons = useActiveAddons();
  const ready = useAddons((s) => s.ready);
  const { favorites, toggleFavorite, progress, markWatched } = useLibrary();
  const startPlayback = usePlayback((s) => s.start);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [source, setSource] = useState('');
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [target, setTarget] = useState<StreamTarget | null>(null);
  const [sheetMode, setSheetMode] = useState<'watch' | 'download'>('watch');
  const [expanded, setExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [season, setSeason] = useState<number>();
  const [epQuery, setEpQuery] = useState('');
  const [newestFirst, setNewestFirst] = useState(false);
  const [similar, setSimilar] = useState<MetaPreview[] | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 260);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setState('loading');
    setMeta(null);
    setSeason(undefined);
    window.scrollTo(0, 0);
    getMeta(addons, type, id).then((r) => {
      if (!alive) return;
      if (!r) {
        // No meta addon for this ID: use the catalog's own preview (like Stremio).
        const p = previewOf(type, id);
        if (!p) return setState('missing');
        setMeta({ ...p.meta, type });
        setSource(p.addonName);
        return setState('ok');
      }
      setMeta(r.meta);
      setSource(r.addon.manifest.name);
      setState('ok');
    });
    return () => {
      alive = false;
    };
  }, [type, id, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const videos = useMemo(() => (meta?.videos ?? []).filter((v) => v && v.id), [meta]);
  const isSeries = videos.length > 0 && !(videos.length === 1 && videos[0].id === meta?.id);
  const seasons = useMemo(() => {
    const s = [...new Set(videos.map((v) => v.season ?? 0))].sort((a, b) => a - b);
    return s.length > 1 && s[0] === 0 ? [...s.slice(1), 0] : s; // specials last
  }, [videos]);

  // Last watched episode drives the default season and the Resume button.
  const lastProgress = useMemo(
    () =>
      Object.values(progress)
        .filter((p) => p.metaId === id)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0],
    [progress, id],
  );

  useEffect(() => {
    if (!meta || season !== undefined || !seasons.length) return;
    const last = lastProgress && videos.find((v) => v.id === lastProgress.videoId);
    setSeason(last?.season ?? seasons[0]);
  }, [meta, seasons, season, lastProgress, videos]);

  // Deep link from "Continue watching": ?play=<videoId>
  useEffect(() => {
    const vid = params.get('play');
    if (!meta || !vid) return;
    openStreams(vid);
    params.delete('play');
    setParams(params, { replace: true });
  }, [meta]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Similar" = same genre from a catalog of the same type.
  useEffect(() => {
    if (!meta) return;
    const genre = genresOf(meta)[0];
    const pick = addons
      .flatMap((a) => a.manifest.catalogs.map((c) => ({ a, c })))
      .find(({ c }) => c.type === meta.type && catalogExtras(c).supportsGenre && !catalogExtras(c).searchOnly);
    if (!pick || !genre) return setSimilar([]);
    setSimilar(null);
    getCatalog(pick.a, pick.c, { genre })
      .then((items) => setSimilar(items.filter((m) => m.id !== meta.id).slice(0, 20)))
      .catch(() => setSimilar([]));
  }, [meta]); // eslint-disable-line react-hooks/exhaustive-deps

  const episodes = useMemo(() => {
    const q = epQuery.trim().toLowerCase();
    let list = videos.filter((v) => (v.season ?? 0) === season);
    if (q) list = list.filter((v) => String(epNum(v)) === q || (v.title ?? v.name ?? '').toLowerCase().includes(q));
    list.sort((a, b) => epNum(a) - epNum(b));
    return newestFirst ? list.reverse() : list;
  }, [videos, season, epQuery, newestFirst]);

  if (state === 'loading') {
    return (
      <div className="page center-fill">
        <Spinner />
      </div>
    );
  }
  if (state === 'missing' || !meta) {
    return (
      <div className="page page-pad">
        <Empty title={t('notFound')} action={<button className="btn btn-primary" onClick={() => nav(-1)}>{t('back')}</button>} />
      </div>
    );
  }

  function openStreams(videoId: string, mode: 'watch' | 'download' = 'watch') {
    const video = videos.find((v) => v.id === videoId);
    setSheetMode(mode);
    setTarget({ meta: meta!, video, videoId });
  }

  const defaultVideoId = meta.behaviorHints?.defaultVideoId ?? (isSeries ? undefined : videos[0]?.id ?? meta.id);
  const mainVideoId = isSeries
    ? lastProgress?.videoId ?? [...videos].filter((v) => (v.season ?? 0) > 0).sort((a, b) => (a.season! - b.season!) || epNum(a) - epNum(b))[0]?.id ?? videos[0]?.id
    : defaultVideoId ?? meta.id;
  const mainVideo = videos.find((v) => v.id === mainVideoId);
  const mainProgress = mainVideoId ? progress[mainVideoId] : undefined;
  const resuming = !!mainProgress && !isWatched(mainProgress) && mainProgress.time > 5;
  const watchLabel = resuming ? t('resume') : t('watch');
  const mainEpLabel =
    isSeries && mainVideo
      ? `${t('season')} ${mainVideo.season ?? 0} · ${t('episode')} ${epNum(mainVideo)}${mainVideo.title || mainVideo.name ? ' — ' + (mainVideo.title || mainVideo.name) : ''}`
      : resuming
        ? `\u2066${formatTime(mainProgress!.time)} / ${formatTime(mainProgress!.duration)}\u2069`
        : undefined;

  const fav = !!favorites[meta.id];
  const trailer = trailerOf(meta);
  const genres = genresOf(meta);
  const cast = meta.app_extras?.cast?.length
    ? meta.app_extras.cast
    : (meta.cast ?? meta.links?.filter((l) => l.category === 'Cast').map((l) => l.name) ?? []).map((name) => ({ name, photo: undefined, character: undefined }));
  const crew = [
    ...(meta.app_extras?.directors ?? (meta.director ?? meta.links?.filter((l) => l.category === 'Directors').map((l) => l.name) ?? []).map((name) => ({ name, photo: undefined }))).map((p) => ({ ...p, role: t('director') })),
    ...(meta.app_extras?.writers ?? (meta.writer ?? meta.links?.filter((l) => l.category === 'Writers').map((l) => l.name) ?? []).map((name) => ({ name, photo: undefined }))).map((p) => ({ ...p, role: t('writer') })),
  ];

  const onFav = () => toast(toggleFavorite(meta) ? t('addedToFav') : t('removedFromFav'));
  const playTrailer = () =>
    trailer &&
    (startPlayback({
      stream: { ytId: trailer, addonId: 'trailer', addonName: 'YouTube', name: t('trailer') },
      meta,
      videoId: `trailer:${meta.id}`,
      type: meta.type,
      title: `${meta.name} — ${t('trailer')}`,
    }),
    nav('/play'));

  return (
    <div className="page detail">
      <div className="detail-backdrop">
        <Img src={backgroundOf(meta)} alt="" className="detail-bg" />
        <div className="detail-bg-shade" />
      </div>
      <div className={cx('detail-top', scrolled && 'scrolled')}>
        <button className="icon-btn glass flip-rtl" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label={t('back')}>
          <IconBack size={24} />
        </button>
        <span className="detail-top-title" dir="auto">
          {meta.name}
        </span>
        <div className="detail-top-actions">
          <button className="icon-btn glass" onClick={() => shareApp(meta.name, location.href)} aria-label={t('share')}>
            <IconShare size={22} />
          </button>
          <button className={cx('icon-btn glass', fav && 'fav-on')} onClick={onFav} aria-label={t('favorites')}>
            {fav ? <IconHeartFill size={22} /> : <IconHeart size={22} />}
          </button>
        </div>
      </div>

      <div className="detail-head">
        <div className="detail-poster">
          <Img src={posterOf(meta)} alt={meta.name} />
        </div>
        <div className="detail-info">
          <DetailTitle meta={meta} />
          <div className="detail-line">
            {[formatRuntime(meta.runtime), meta.country?.split(',')[0], yearOf(meta)].filter(Boolean).map((x, i) => (
              <span key={i}>{x}</span>
            ))}
          </div>
          <div className="detail-badges">
            {meta.imdbRating && (
              <span className="badge-outline badge-gold">
                <Rating value={meta.imdbRating} />
              </span>
            )}
            {meta.status === 'Continuing' && <span className="pill pill-green">{t('ongoing')}</span>}
            {meta.status === 'Ended' && <span className="pill pill-dark">{t('ended')}</span>}
            {isSeries && <span className="pill pill-dark">{t('nEpisodes', { n: videos.filter((v) => (v.season ?? 0) > 0).length || videos.length })}</span>}
          </div>
          {genres.length > 0 && (
            <div className="detail-genres">
              {genres.slice(0, 4).map((g) => (
                <span key={g} className="genre-chip">
                  {genreLabel(g, lang)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="detail-cta">
        <button className="btn btn-primary btn-lg" onClick={() => mainVideoId && openStreams(mainVideoId)} disabled={!mainVideoId}>
          <IconPlay size={22} /> {watchLabel}
        </button>
        <button className="btn btn-outline btn-lg" onClick={() => mainVideoId && openStreams(mainVideoId, 'download')} disabled={!mainVideoId}>
          <IconDownload size={22} /> {t('download')}
        </button>
      </div>
      {mainEpLabel && <div className="detail-next-ep">{mainEpLabel}</div>}
      {resuming && mainProgress && (
        <div className="detail-resume-bar">
          <span style={{ width: `${(mainProgress.time / mainProgress.duration) * 100}%` }} />
        </div>
      )}

      <div className="detail-actions">
        <button onClick={playTrailer} disabled={!trailer}>
          <IconClapper size={28} />
          <span>{t('trailer')}</span>
        </button>
        <button onClick={onFav} className={cx(fav && 'fav-on')}>
          {fav ? <IconHeartFill size={28} /> : <IconHeart size={28} />}
          <span>{t('favorites')}</span>
        </button>
        <button onClick={() => shareApp(meta.name, location.href)}>
          <IconShare size={28} />
          <span>{t('share')}</span>
        </button>
        <button onClick={() => setInfoOpen(true)}>
          <IconInfo size={28} />
          <span>{t('info')}</span>
        </button>
      </div>

      {meta.description && (
        <section className="section">
          <SectionTitle title={t('story')} />
          <p className={cx('story', expanded && 'expanded')} dir="auto">{meta.description}</p>
          {meta.description.length > 180 && (
            <button className="link-btn more-btn" onClick={() => setExpanded(!expanded)}>
              {expanded ? t('less') : t('more')}
            </button>
          )}
        </section>
      )}

      {isSeries && (
        <section className="section" id="episodes">
          <SectionTitle title={t('episodes')} />
          {seasons.length > 1 && (
            <div className="chips row-scroll">
              {seasons.map((s) => (
                <button key={s} className={cx('chip', s === season && 'active')} onClick={() => setSeason(s)}>
                  {s === 0 ? t('specials') : `${t('season')} ${s}`}
                </button>
              ))}
            </div>
          )}
          <div className="ep-toolbar">
            <button className="btn btn-soft" onClick={() => setNewestFirst(!newestFirst)}>
              <IconSort size={20} /> {newestFirst ? t('newestFirst') : t('oldestFirst')}
            </button>
            <span className="ep-count">{t('nEpisodes', { n: episodes.length })}</span>
          </div>
          <div className="search-box compact">
            <IconSearch size={20} />
            <input value={epQuery} onChange={(e) => setEpQuery(e.target.value)} placeholder={t('searchEpisodes')} inputMode="search" />
          </div>
          <div className="episodes">
            {episodes.map((v) => {
              const p = progress[v.id];
              const watched = isWatched(p);
              const pct = p && p.duration ? (p.time / p.duration) * 100 : 0;
              return (
                <div key={v.id} className="episode">
                  <button className="episode-thumb" onClick={() => openStreams(v.id)} aria-label={`${t('episode')} ${epNum(v)}`}>
                    <Img src={v.thumbnail ?? backgroundOf(meta)} alt="" />
                    <span className="episode-play">
                      <IconPlay size={28} />
                    </span>
                    {watched && <WatchedMark />}
                    {p && p.duration > 1 && !watched && <span className="episode-dur">{formatTime(p.duration - p.time)}</span>}
                    {pct > 0 && !watched && (
                      <span className="episode-progress">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </button>
                  <div className="episode-info" onClick={() => openStreams(v.id)}>
                    <span className="episode-num">
                      {t('episode')} {epNum(v)}
                    </span>
                    <strong className="episode-title" dir="auto">{v.title ?? v.name ?? `${t('episode')} ${epNum(v)}`}</strong>
                    {formatDate(v.released ?? v.firstAired) && <span className="episode-date">{formatDate(v.released ?? v.firstAired)}</span>}
                  </div>
                  <button
                    className={cx('episode-check', watched && 'on')}
                    title={t('markWatched')}
                    aria-label={t('markWatched')}
                    onClick={() =>
                      markWatched(
                        {
                          videoId: v.id,
                          metaId: meta.id,
                          type: meta.type,
                          name: meta.name,
                          poster: meta.poster,
                          background: meta.background,
                          thumbnail: v.thumbnail,
                          season: v.season,
                          episode: epNum(v),
                          episodeTitle: v.title ?? v.name,
                        },
                        !watched,
                      )
                    }
                  >
                    <IconCheck size={18} />
                  </button>
                </div>
              );
            })}
            {!episodes.length && <Empty title={t('noResults')} />}
          </div>
        </section>
      )}

      {cast.length > 0 && (
        <section className="section">
          <SectionTitle title={t('cast')} />
          <div className="row-scroll people">
            {cast.slice(0, 20).map((c) => (
              <Link key={c.name} to={`/search?q=${encodeURIComponent(c.name)}`} className="person">
                <Avatar name={c.name} photo={c.photo} />
                <span className="person-name" dir="auto">{c.name}</span>
                {c.character && <span className="person-role-text">{c.character}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {crew.length > 0 && (
        <section className="section">
          <SectionTitle title={t('crew')} />
          <div className="row-scroll people">
            {crew.slice(0, 12).map((c, i) => (
              <div key={c.name + i} className="person">
                <Avatar name={c.name} photo={c.photo} />
                <span className="person-name" dir="auto">{c.name}</span>
                <span className="role-pill">{c.role}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <MetaRow title={t('similar')} sub={`${t('becauseYouWatched')} "${meta.name}"`} items={similar} />

      <StreamSheet open={!!target} target={target} mode={sheetMode} onClose={() => setTarget(null)} />

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} title={t('info')}>
        <dl className="info-list">
          {[
            ['IMDb', meta.imdbRating],
            [t('catalog'), source],
            [t('genres'), genres.map((g) => genreLabel(g, lang)).join('، ')],
            ['📅', formatDate(meta.released) ?? yearOf(meta)],
            ['🌍', meta.country],
            ['🗣', meta.language],
            ['🏆', meta.awards],
            ['⏱', meta.runtime],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
        {/^tt\d+/.test(meta.id) && (
          <a className="btn btn-soft" href={`https://www.imdb.com/title/${meta.id.split(':')[0]}/`} target="_blank" rel="noopener">
            IMDb ↗
          </a>
        )}
      </Sheet>
    </div>
  );
}

function DetailTitle({ meta }: { meta: Meta }) {
  const [ok, setOk] = useState(true);
  const logo = logoOf(meta);
  return (
    <>
      {logo && ok ? (
        <h1 className="detail-title">
          <img src={logo} alt={meta.name} className="detail-logo" onError={() => setOk(false)} referrerPolicy="no-referrer" />
        </h1>
      ) : (
        <h1 className="detail-title">{meta.name}</h1>
      )}
      {logo && ok && <div className="detail-subtitle">{meta.name}</div>}
    </>
  );
}

function Avatar({ name, photo }: { name: string; photo?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return (
    <span className="avatar">
      <Img src={photo} alt={name} fallback={<span className="avatar-initials">{initials}</span>} />
    </span>
  );
}
