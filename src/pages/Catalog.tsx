import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { catalogExtras } from '../lib/stremio';
import { useCatalogs, useInView, usePagedCatalog } from '../lib/hooks';
import { genreLabel, typeLabel, useT } from '../lib/i18n';
import { useSettings } from '../store/settings';
import { cx } from '../lib/format';
import { PageHeader } from '../components/Shell';
import { PosterCard } from '../components/Cards';
import { Empty, Spinner } from '../components/ui';

export default function Catalog() {
  const { addonId = '', type = '', id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const genre = params.get('genre') ?? undefined;
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const [cref] = useCatalogs((c, a) => a.manifest.id === addonId && c.type === type && c.id === id);
  const { items, loading, done, loadMore } = usePagedCatalog(cref, genre);
  const sentinel = useInView<HTMLDivElement>(() => loadMore(), [items.length, loading, done, cref?.key, genre]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [genre]);

  if (!cref) return <Empty title={t('notFound')} />;
  const extras = catalogExtras(cref.catalog);

  return (
    <div className="page">
      <PageHeader title={`${cref.catalog.name ?? id} · ${typeLabel(type, lang)}`} />
      {extras.genreOptions.length > 0 && (
        <div className="chips row-scroll">
          {!extras.required.has('genre') && (
            <button className={cx('chip', !genre && 'active')} onClick={() => setParams({})}>
              {t('all')}
            </button>
          )}
          {extras.genreOptions.map((g) => (
            <button key={g} className={cx('chip', genre === g && 'active')} onClick={() => setParams({ genre: g })}>
              {genreLabel(g, lang)}
            </button>
          ))}
        </div>
      )}
      <div className="grid">
        {items.map((m) => (
          <PosterCard key={m.id} meta={m} />
        ))}
        {!done && items.length === 0 && Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton skeleton-poster" />)}
      </div>
      {!done && (
        <div ref={sentinel} className="load-more">
          {loading && <Spinner />}
        </div>
      )}
      {done && !items.length && <Empty title={t('noResults')} />}
    </div>
  );
}
