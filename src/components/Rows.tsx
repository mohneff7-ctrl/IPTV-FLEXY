import { type ReactNode } from 'react';
import type { MetaPreview } from '../lib/types';
import { useCatalogItems, useLazyVisible, type CatalogRef } from '../lib/hooks';
import { typeLabel, useT } from '../lib/i18n';
import { useSettings } from '../store/settings';
import { PosterCard, RankCard } from './Cards';
import { SectionTitle, SeeAll } from './ui';

export function catalogTitle(ref: CatalogRef, lang: 'ar' | 'en') {
  const name = ref.catalog.name || ref.catalog.id;
  return `${name} · ${typeLabel(ref.catalog.type, lang)}`;
}

export const catalogPath = (ref: CatalogRef, genre?: string) =>
  `/catalog/${encodeURIComponent(ref.addon.manifest.id)}/${encodeURIComponent(ref.catalog.type)}/${encodeURIComponent(ref.catalog.id)}${
    genre ? `?genre=${encodeURIComponent(genre)}` : ''
  }`;

export function Row({ children }: { children: ReactNode }) {
  return <div className="row-scroll">{children}</div>;
}

export function SkeletonRow({ wide }: { wide?: boolean }) {
  return (
    <Row>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={wide ? 'skeleton skeleton-wide' : 'skeleton skeleton-poster'} />
      ))}
    </Row>
  );
}

export function MetaRow({ title, sub, items, action }: { title: ReactNode; sub?: ReactNode; items: MetaPreview[] | null; action?: ReactNode }) {
  if (items && !items.length) return null;
  return (
    <section className="section">
      <SectionTitle title={title} sub={sub} action={action} />
      {items ? (
        <Row>
          {items.map((m) => (
            <PosterCard key={m.id} meta={m} />
          ))}
        </Row>
      ) : (
        <SkeletonRow />
      )}
    </section>
  );
}

/** A lazily-loaded row for one addon catalog. */
export function CatalogRow({ cref, title, genre }: { cref: CatalogRef; title?: string; genre?: string }) {
  const [ref, visible] = useLazyVisible<HTMLDivElement>();
  const lang = useSettings((s) => s.lang);
  const t = useT();
  const { items } = useCatalogItems(visible ? cref : undefined, genre);
  if (visible && items && !items.length) return null;
  return (
    <div ref={ref} className="lazy-row">
      <MetaRow
        title={title ?? catalogTitle(cref, lang)}
        items={visible ? items : null}
        action={<SeeAll to={catalogPath(cref, genre)} label={t('seeAll')} />}
      />
    </div>
  );
}

export function RankRow({ cref }: { cref: CatalogRef }) {
  const t = useT();
  const { items } = useCatalogItems(cref);
  if (items && !items.length) return null;
  return (
    <section className="section">
      <SectionTitle title={t('trendingToday')} action={<SeeAll to={catalogPath(cref)} label={t('seeAll')} />} />
      {items ? (
        <Row>
          {items.slice(0, 10).map((m, i) => (
            <RankCard key={m.id} meta={m} rank={i + 1} />
          ))}
        </Row>
      ) : (
        <SkeletonRow />
      )}
    </section>
  );
}
