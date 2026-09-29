import { type ReactNode } from 'react';
import type { MetaPreview } from '../lib/types';
import { useCatalogItems, useLazyVisible, type CatalogRef } from '../lib/hooks';
import { typeLabel, useT } from '../lib/i18n';
import { useSettings } from '../store/settings';
import { PosterCard, RankCard } from './Cards';
import { SectionTitle, SeeAll } from './ui';
import { RowBoundary } from './ErrorBoundary';

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

/** Horizontal rows show a preview; the full catalog lives behind "See all". */
const ROW_LIMIT = 30;

function MetaRowView({
  title,
  sub,
  items,
  action,
  limit,
}: {
  title: ReactNode;
  sub?: ReactNode;
  items: MetaPreview[] | null;
  action?: ReactNode;
  limit?: number;
}) {
  if (items && !items.length) return null;
  return (
    <section className="section">
      <SectionTitle title={title} sub={sub} action={action} />
      {items ? (
        <Row>
          {(limit ? items.slice(0, limit) : items).map((m) => (
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
function CatalogRowView({ cref, title, genre }: { cref: CatalogRef; title?: string; genre?: string }) {
  const [ref, visible] = useLazyVisible<HTMLDivElement>();
  const lang = useSettings((s) => s.lang);
  const t = useT();
  const { items } = useCatalogItems(visible ? cref : undefined, genre);
  if (visible && items && !items.length) return null;
  return (
    <div ref={ref} className="lazy-row">
      <MetaRowView
        title={title ?? catalogTitle(cref, lang)}
        items={visible ? items : null}
        limit={ROW_LIMIT}
        action={<SeeAll to={catalogPath(cref, genre)} label={t('seeAll')} />}
      />
    </div>
  );
}

function RankRowView({ cref }: { cref: CatalogRef }) {
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

/* Each row is isolated: if an addon sends data that breaks it, only that row
   disappears instead of the whole page going blank. */
export function MetaRow(props: Parameters<typeof MetaRowView>[0]) {
  return (
    <RowBoundary>
      <MetaRowView {...props} />
    </RowBoundary>
  );
}

export function CatalogRow(props: Parameters<typeof CatalogRowView>[0]) {
  return (
    <RowBoundary>
      <CatalogRowView {...props} />
    </RowBoundary>
  );
}

export function RankRow(props: Parameters<typeof RankRowView>[0]) {
  return (
    <RowBoundary>
      <RankRowView {...props} />
    </RowBoundary>
  );
}
