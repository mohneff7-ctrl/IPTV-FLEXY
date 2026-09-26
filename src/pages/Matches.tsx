import { useMemo, useState } from 'react';
import type { Match } from '../lib/football';
import { useSettings } from '../store/settings';
import { useT } from '../lib/i18n';
import { cx } from '../lib/format';
import { PageHeader } from '../components/Shell';
import { MatchRow, MatchSheet, useMatches } from '../components/Football';
import { Empty, Img, Spinner } from '../components/ui';
import { IconBall, IconRefresh } from '../components/Icons';

type Filter = 'featured' | 'live' | 'all';

function dayOffset(n: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

export default function Matches() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<Filter>('featured');
  const [open, setOpen] = useState<Match | null>(null);
  const day = useMemo(() => dayOffset(offset), [offset]);
  const { matches, reload } = useMatches(day);

  const featuredCount = matches?.filter((m) => m.priority < 100).length ?? 0;
  const liveCount = matches?.filter((m) => m.state === 'in').length ?? 0;
  // With no featured match that day, show everything instead of an empty list.
  const effective: Filter = filter === 'featured' && matches && !featuredCount ? 'all' : filter;

  const groups = useMemo(() => {
    const list = (matches ?? []).filter((m) =>
      effective === 'live' ? m.state === 'in' : effective === 'featured' ? m.priority < 100 : true,
    );
    const map = new Map<string, Match[]>();
    list.forEach((m) => map.set(m.leagueKey, [...(map.get(m.leagueKey) ?? []), m]));
    return [...map.values()];
  }, [matches, effective]);

  const dayLabel = (n: number) => {
    if (n === 0) return t('today');
    if (n === -1) return t('yesterday');
    if (n === 1) return t('tomorrow');
    return dayOffset(n).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric' });
  };

  return (
    <div className="page matches-page">
      <PageHeader
        title={t('matches')}
        right={
          <button className="icon-btn" onClick={reload} aria-label={t('reload')}>
            <IconRefresh size={22} />
          </button>
        }
      />

      <div className="chips row-scroll day-strip">
        {[-2, -1, 0, 1, 2, 3, 4].map((n) => (
          <button key={n} className={cx('chip day-chip', offset === n && 'active')} onClick={() => setOffset(n)}>
            {dayLabel(n)}
          </button>
        ))}
      </div>

      <div className="chips row-scroll">
        <button className={cx('chip', effective === 'featured' && 'active')} onClick={() => setFilter('featured')}>
          ⭐ {t('featuredLeagues')}
        </button>
        <button className={cx('chip', effective === 'live' && 'active')} onClick={() => setFilter('live')}>
          <span className="live-dot-red" /> {t('liveNow')} {liveCount ? `(${liveCount})` : ''}
        </button>
        <button className={cx('chip', effective === 'all' && 'active')} onClick={() => setFilter('all')}>
          {t('allMatches')} {matches ? `(${matches.length})` : ''}
        </button>
      </div>

      {!matches && (
        <div className="center-pad">
          <Spinner />
        </div>
      )}

      {matches && !groups.length && (
        <Empty icon={<IconBall size={46} />} title={effective === 'live' ? t('noLiveMatches') : t('noMatches')} />
      )}

      {groups.map((g) => (
        <section key={g[0].leagueKey} className="league-group">
          <h3 className="league-head">
            {g[0].leagueLogo ? <Img src={g[0].leagueLogo} alt="" className="league-logo" /> : <IconBall size={22} />}
            <span>{lang === 'ar' ? g[0].leagueNameAr : g[0].leagueName}</span>
            <small>{g.length}</small>
          </h3>
          <div className="league-matches">
            {g.map((m) => (
              <MatchRow key={m.id} m={m} onOpen={setOpen} />
            ))}
          </div>
        </section>
      ))}

      <p className="data-credit">{t('scoresSource')}</p>
      <MatchSheet match={open} onClose={() => setOpen(null)} />
    </div>
  );
}
