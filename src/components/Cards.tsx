import { Link } from 'react-router-dom';
import type { MetaPreview } from '../lib/types';
import { backgroundOf, posterOf, yearOf } from '../lib/stremio';
import { useLibrary, type Progress } from '../store/library';
import { useSettings } from '../store/settings';
import { translate, typeLabel } from '../lib/i18n';
import { cx, formatTime } from '../lib/format';
import { Img } from './ui';
import { IconCheck, IconHeartFill, IconPlay, IconStar } from './Icons';

export const detailPath = (type: string, id: string) => `/detail/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;

export function PosterCard({ meta, showInfo = true, showType }: { meta: MetaPreview; showInfo?: boolean; showType?: boolean }) {
  const fav = useLibrary((s) => !!s.favorites[meta.id]);
  const lang = useSettings((s) => s.lang);
  const year = yearOf(meta);
  const country = meta.country?.split(',')[0];
  const landscape = meta.posterShape === 'landscape';
  const withInfo = showInfo && !!(year || country);
  return (
    <Link to={detailPath(meta.type, meta.id)} className={cx('poster-card', landscape && 'landscape', withInfo && 'has-info')}>
      <div className="poster-frame">
        <Img src={posterOf(meta)} alt={meta.name} className="poster-img" fallback={<span className="poster-fallback">{meta.name}</span>} />
        <div className="poster-badges">
          {meta.imdbRating && (
            <span className="badge badge-rating">
              {Number(meta.imdbRating).toFixed(1)} <IconStar size={11} />
            </span>
          )}
          {showType && <span className="badge badge-type">{typeLabel(meta.type, lang)}</span>}
        </div>
        {fav && (
          <span className="poster-fav">
            <IconHeartFill size={16} />
          </span>
        )}
        <div className="poster-shade" />
        <span className="poster-title-in" dir="auto">{meta.name}</span>
      </div>
      {withInfo && (
        <div className="poster-info">
          <span className="poster-name" dir="auto">{meta.name}</span>
          <span className="poster-meta">{[year, country].filter(Boolean).join(' • ')}</span>
        </div>
      )}
    </Link>
  );
}

export function RankCard({ meta, rank }: { meta: MetaPreview; rank: number }) {
  return (
    <Link to={detailPath(meta.type, meta.id)} className="rank-card">
      <span className="rank-num" aria-hidden="true">
        {rank}
      </span>
      <div className="poster-frame">
        <Img src={posterOf(meta)} alt={meta.name} className="poster-img" fallback={<span className="poster-fallback">{meta.name}</span>} />
      </div>
    </Link>
  );
}

export function ProgressCard({ p }: { p: Progress }) {
  const lang = useSettings((s) => s.lang);
  const pct = p.duration ? Math.min(100, (p.time / p.duration) * 100) : 0;
  const bg = p.thumbnail ?? p.background ?? backgroundOf({ id: p.metaId, poster: p.poster });
  const epLine =
    p.season != null && p.episode != null ? (
      `${translate(lang, 'episode')} ${p.episode} — ${translate(lang, 'season')} ${p.season}`
    ) : (
      <bdi dir="ltr">{`${formatTime(p.time)} / ${formatTime(p.duration)}`}</bdi>
    );
  return (
    <Link to={`${detailPath(p.type, p.metaId)}?play=${encodeURIComponent(p.videoId)}`} className="wide-card">
      <Img src={bg} alt={p.name} className="wide-img" />
      <div className="wide-shade" />
      <span className="wide-duration">{formatTime(Math.max(0, p.duration - p.time))}</span>
      <span className="wide-play">
        <IconPlay size={30} />
      </span>
      <div className="wide-info">
        {p.poster && <Img src={p.poster} alt="" className="wide-mini-poster" />}
        <div>
          <strong>{p.name}</strong>
          <span>{epLine}</span>
        </div>
      </div>
      <div className="wide-progress">
        <span style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}

export function WatchedMark() {
  return (
    <span className="watched-mark">
      <IconCheck size={18} />
    </span>
  );
}
