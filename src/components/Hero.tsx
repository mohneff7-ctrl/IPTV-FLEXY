import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MetaPreview } from '../lib/types';
import { backgroundOf, genresOf, logoOf, posterOf, yearOf } from '../lib/stremio';
import { genreLabel, useT } from '../lib/i18n';
import { useSettings } from '../store/settings';
import { cx } from '../lib/format';
import { detailPath } from './Cards';
import { Img, Rating } from './ui';
import { IconPlay } from './Icons';

export function Hero({ items }: { items: MetaPreview[] | null }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const lang = useSettings((s) => s.lang);
  const t = useT();
  const list = (items ?? []).slice(0, 10);

  useEffect(() => {
    if (paused || list.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % list.length), 7000);
    return () => clearInterval(id);
  }, [paused, list.length]);

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
      className="hero"
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
        // Only the current slide and its neighbours exist in the page: keeps GPU memory low on phones.
        const near = active || i === (index + 1) % list.length || i === (index - 1 + list.length) % list.length;
        if (!near) return null;
        const genres = genresOf(m).slice(0, 2);
        return (
          <div key={m.id} className={cx('hero-slide', active && 'active')} aria-hidden={!active}>
            <Img src={backgroundOf(m)} alt="" className="hero-bg" />
            <div className="hero-shade" />
            <div className="hero-content">
              <Link to={detailPath(m.type, m.id)} className="hero-poster" tabIndex={active ? 0 : -1}>
                <Img src={posterOf(m)} alt={m.name} />
              </Link>
              <div className="hero-text">
                <HeroTitle meta={m} />
                {genres.length > 0 && <div className="hero-genres">{genres.map((g) => genreLabel(g, lang)).join(' • ')}</div>}
                <div className="hero-meta">
                  <Rating value={m.imdbRating} />
                  {yearOf(m) && <span>{yearOf(m)}</span>}
                  {(m as { status?: string }).status === 'Continuing' && <span className="pill pill-green">{t('ongoing')}</span>}
                </div>
                <Link to={detailPath(m.type, m.id)} className="btn btn-primary hero-cta" tabIndex={active ? 0 : -1}>
                  <IconPlay size={18} /> {t('watch')}
                </Link>
              </div>
            </div>
          </div>
        );
      })}
      <div className="hero-dots">
        {list.map((m, i) => (
          <button key={m.id} className={cx('dot', i === index && 'active')} onClick={() => setIndex(i)} aria-label={`${i + 1}`} />
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
