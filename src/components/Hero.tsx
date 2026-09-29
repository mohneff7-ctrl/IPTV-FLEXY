import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MetaPreview } from '../lib/types';
import { backgroundOf, genresOf, logoOf, posterOf, yearOf } from '../lib/stremio';
import { genreLabel, useT } from '../lib/i18n';
import { useSettings } from '../store/settings';
import { useLibrary } from '../store/library';
import { cx } from '../lib/format';
import { detailPath } from './Cards';
import { Img, Rating, toast } from './ui';
import { IconCheck, IconInfo, IconPlay, IconPlus } from './Icons';

const INTERVAL = 7000;

export function Hero({ items }: { items: MetaPreview[] | null }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const lang = useSettings((s) => s.lang);
  const t = useT();
  const list = (items ?? []).slice(0, 10);

  useEffect(() => {
    if (paused || list.length < 2) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % list.length), INTERVAL);
    return () => clearTimeout(id);
  }, [paused, list.length, index]);

  // Preload the next backdrop so transitions are instant.
  useEffect(() => {
    const next = list[(index + 1) % Math.max(1, list.length)];
    if (next) new Image().src = backgroundOf(next) ?? '';
  }, [index, list]);

  if (!items) return <div className="hero hero-skeleton skeleton" />;
  if (!list.length) return null;

  const go = (d: number) => setIndex((i) => (i + d + list.length) % list.length);
  const rtl = lang === 'ar';

  return (
    <section
      className={cx('hero', paused && 'paused')}
      style={{ '--hero-interval': `${INTERVAL}ms` } as React.CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) go((dx < 0 ? 1 : -1) * (rtl ? -1 : 1));
        touch.current = null;
      }}
    >
      {list.map((m, i) => {
        const active = i === index;
        const genres = genresOf(m).slice(0, 2);
        return (
          <div key={m.id} className={cx('hero-slide', active && 'active')} aria-hidden={!active}>
            <Img src={backgroundOf(m)} alt="" className="hero-bg" />
            <div className="hero-shade" />
            <div className="hero-content">
              <Link to={detailPath(m.type, m.id)} className="hero-poster" tabIndex={active ? 0 : -1}>
                <Img src={posterOf(m, 'large')} alt={m.name} />
              </Link>
              <div className="hero-text">
                <HeroTitle meta={m} />
                {genres.length > 0 && <div className="hero-genres">{genres.map((g) => genreLabel(g, lang)).join(' • ')}</div>}
                <div className="hero-meta">
                  <Rating value={m.imdbRating} />
                  {yearOf(m) && <span>{yearOf(m)}</span>}
                  {(m as { status?: string }).status === 'Continuing' && <span className="pill pill-green">{t('ongoing')}</span>}
                </div>
                <div className="hero-actions">
                  <Link to={detailPath(m.type, m.id)} className="btn btn-primary hero-cta" tabIndex={active ? 0 : -1}>
                    <IconPlay size={18} /> {t('watch')}
                  </Link>
                  <FavButton meta={m} tabIndex={active ? 0 : -1} />
                  <Link to={detailPath(m.type, m.id)} className="btn btn-glass hero-icon-btn" aria-label={t('moreInfo')} tabIndex={active ? 0 : -1}>
                    <IconInfo size={20} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="hero-dots">
        {list.map((m, i) => (
          <button key={m.id} className={cx('dot', i === index && 'active')} onClick={() => setIndex(i)} aria-label={`${i + 1}`}>
            {i === index && <span key={index} className="dot-fill" />}
          </button>
        ))}
      </div>
    </section>
  );
}

function HeroTitle({ meta }: { meta: MetaPreview }) {
  const [logoOk, setLogoOk] = useState(true);
  const logo = logoOf(meta);
  if (logo && logoOk)
    return (
      <h2 className="hero-title">
        <img src={logo} alt={meta.name} className="hero-logo" onError={() => setLogoOk(false)} referrerPolicy="no-referrer" />
      </h2>
    );
  return <h2 className="hero-title">{meta.name}</h2>;
}

function FavButton({ meta, tabIndex }: { meta: MetaPreview; tabIndex: number }) {
  const t = useT();
  const fav = useLibrary((s) => !!s.favorites[meta.id]);
  const toggle = useLibrary((s) => s.toggleFavorite);
  return (
    <button
      className={cx('btn btn-glass', fav && 'on')}
      tabIndex={tabIndex}
      onClick={() => toast(t(toggle(meta) ? 'addedToFav' : 'removedFromFav'))}
    >
      {fav ? <IconCheck size={18} /> : <IconPlus size={18} />} {t('myList')}
    </button>
  );
}
