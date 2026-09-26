import { Link } from 'react-router-dom';
import { useCatalogs, useCatalogItems, type CatalogRef } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { useAddons } from '../store/addons';
import { continueWatching, useLibrary } from '../store/library';
import { Hero } from '../components/Hero';
import { CatalogRow, RankRow, Row, SkeletonRow } from '../components/Rows';
import { ProgressCard } from '../components/Cards';
import { MatchCard, MatchSheet, useMatches } from '../components/Football';
import type { Match } from '../lib/football';
import { useSettings } from '../store/settings';
import { useMemo, useState } from 'react';
import { Empty, SectionTitle, SeeAll } from '../components/ui';
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

/** Today's featured matches (live first), like the reference home screen. */
function MatchesRow() {
  const t = useT();
  const day = useMemo(() => new Date(), []);
  const { matches } = useMatches(day);
  const [open, setOpen] = useState<Match | null>(null);
  const featured = (matches ?? []).filter((m) => m.priority < 100);
  const list = [...(featured.length ? featured : matches ?? [])]
    .sort((a, b) => (a.state === 'in' ? 0 : a.state === 'pre' ? 1 : 2) - (b.state === 'in' ? 0 : b.state === 'pre' ? 1 : 2))
    .slice(0, 15);
  if (matches && !list.length) return null;
  return (
    <section className="section">
      <SectionTitle title={t('todayMatches')} action={<SeeAll to="/matches" label={t('seeAll')} />} />
      {matches ? (
        <Row>
          {list.map((m) => (
            <MatchCard key={m.id} m={m} onOpen={setOpen} />
          ))}
        </Row>
      ) : (
        <SkeletonRow wide />
      )}
      <MatchSheet match={open} onClose={() => setOpen(null)} />
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
  const showMatches = useSettings((s) => s.showMatchesHome);

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
      {showMatches && <MatchesRow />}
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
