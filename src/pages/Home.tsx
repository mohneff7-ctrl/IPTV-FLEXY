import { Link } from 'react-router-dom';
import { useCatalogs, useCatalogItems, type CatalogRef } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { useAddons } from '../store/addons';
import { continueWatching, useLibrary } from '../store/library';
import { Hero } from '../components/Hero';
import { RowBoundary } from '../components/ErrorBoundary';
import { CatalogRow, RankRow, Row, SkeletonRow } from '../components/Rows';
import { ProgressCard } from '../components/Cards';
import { Empty, SectionTitle } from '../components/ui';
import { IconBolt, IconLive, IconPuzzle } from '../components/Icons';

export function PromoBanner({ to, title, text, cta, tone, icon }: { to: string; title: string; text: string; cta: string; tone: 'violet' | 'red'; icon: React.ReactNode }) {
  return (
    <Link to={to} className={`promo promo-${tone}`}>
      <div className="promo-glow" />
      <div className="promo-icon">{icon}</div>
      <div className="promo-text">
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <span className="btn promo-btn">{cta}</span>
    </Link>
  );
}

export function ContinueRow() {
  return (
    <RowBoundary>
      <ContinueRowView />
    </RowBoundary>
  );
}

function ContinueRowView() {
  const t = useT();
  const progress = useLibrary((s) => s.progress);
  const items = continueWatching(progress);
  if (!items.length) return null;
  return (
    <section className="section">
      <SectionTitle title={t('continueWatching')} />
      <Row>
        {items.map((p) => (
          <ProgressCard key={p.videoId} p={p} />
        ))}
      </Row>
    </section>
  );
}

function HeroFrom({ cref }: { cref?: CatalogRef }) {
  const { items } = useCatalogItems(cref);
  return <Hero items={cref ? items : []} />;
}

export default function Home() {
  const t = useT();
  const ready = useAddons((s) => s.ready);
  const catalogs = useCatalogs();
  const heroRef = catalogs.find((c) => c.catalog.type === 'series') ?? catalogs[0];
  const rankRef = catalogs.find((c) => c.catalog.type === 'movie') ?? catalogs[0];

  if (ready && !catalogs.length) {
    return (
      <div className="page page-pad">
        <Empty
          icon={<IconPuzzle size={48} />}
          title={t('noAddonsForType')}
          text={t('addonsHint')}
          action={
            <Link to="/addons" className="btn btn-primary">
              {t('goToAddons')}
            </Link>
          }
        />
      </div>
    );
  }

  if (!ready && !catalogs.length) {
    return (
      <div className="page home">
        <Hero items={null} />
        <div className="section">
          <SkeletonRow />
        </div>
        <div className="section">
          <SkeletonRow />
        </div>
      </div>
    );
  }

  const rows = catalogs.filter((c) => c !== rankRef);
  return (
    <div className="page home">
      <HeroFrom cref={heroRef} />
      <ContinueRow />
      {rankRef && <RankRow cref={rankRef} />}
      {rows.slice(0, 3).map((c) => (
        <CatalogRow key={c.key} cref={c} />
      ))}
      <PromoBanner
        to="/browse/anime"
        tone="violet"
        icon={<IconBolt size={34} />}
        title={t('animeBannerTitle')}
        text={t('animeBannerText')}
        cta={t('watchNow')}
      />
      {rows.slice(3, 7).map((c) => (
        <CatalogRow key={c.key} cref={c} />
      ))}
      <PromoBanner
        to="/channels"
        tone="red"
        icon={<IconLive size={34} />}
        title={t('liveBannerTitle')}
        text={t('liveBannerText')}
        cta={t('watchNow')}
      />
      {rows.slice(7).map((c) => (
        <CatalogRow key={c.key} cref={c} />
      ))}
    </div>
  );
}
