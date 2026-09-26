import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMatchDetails, fetchMatches, statusText, type Match, type MatchDetails, type Team } from '../lib/football';
import { useSettings } from '../store/settings';
import { useT } from '../lib/i18n';
import { cx } from '../lib/format';
import { Img, Sheet, Spinner } from './ui';
import { IconTv } from './Icons';

/** Loads a day's matches and refreshes them while any match is live. */
export function useMatches(day: Date) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [error, setError] = useState(false);
  const key = day.toDateString();

  const load = useCallback(
    async (fresh = false) => {
      try {
        const list = await fetchMatches(day, { fresh });
        setMatches(list);
        setError(false);
      } catch {
        setError(true);
        setMatches((m) => m ?? []);
      }
    },
    [key], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    setMatches(null);
    load();
  }, [load]);

  const hasLive = !!matches?.some((m) => m.state === 'in');
  useEffect(() => {
    if (!hasLive) return;
    const id = setInterval(() => document.visibilityState === 'visible' && load(true), 30_000);
    return () => clearInterval(id);
  }, [hasLive, load]);

  return { matches, error, reload: () => load(true) };
}

function TeamBadge({ team, size = 44 }: { team: Team; size?: number }) {
  return (
    <span className="team-logo" style={{ width: size, height: size }}>
      <Img src={team.logo} alt={team.name} fallback={<span>{team.short.slice(0, 3)}</span>} />
    </span>
  );
}

function Score({ m }: { m: Match }) {
  const lang = useSettings((s) => s.lang);
  if (m.state === 'pre') return <span className="match-time">{statusText(m, lang)}</span>;
  return (
    <span className="match-score" dir="ltr">
      {/* Home is shown on the start side, so in RTL its score goes on the right. */}
      {lang === 'ar' ? `${m.away.score ?? 0} - ${m.home.score ?? 0}` : `${m.home.score ?? 0} - ${m.away.score ?? 0}`}
    </span>
  );
}

function StatusLine({ m }: { m: Match }) {
  const lang = useSettings((s) => s.lang);
  if (m.state === 'in')
    return (
      <span className="match-status live">
        <span className="live-dot-red" /> <bdi dir="ltr">{statusText(m, lang)}</bdi>
      </span>
    );
  if (m.state === 'post') return <span className="match-status">{statusText(m, lang)}</span>;
  return <span className="match-status">{new Date(m.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short' })}</span>;
}

/** Compact card for the home page row (like the reference design). */
export function MatchCard({ m, onOpen }: { m: Match; onOpen: (m: Match) => void }) {
  const lang = useSettings((s) => s.lang);
  return (
    <button className={cx('match-card', m.state === 'in' && 'is-live')} onClick={() => onOpen(m)}>
      <span className="match-league">{lang === 'ar' ? m.leagueNameAr : m.leagueName}</span>
      <span className="match-card-body">
        <span className="match-team">
          <TeamBadge team={m.home} />
          <span className="team-name" dir="auto">
            {m.home.short}
          </span>
        </span>
        <Score m={m} />
        <span className="match-team">
          <TeamBadge team={m.away} />
          <span className="team-name" dir="auto">
            {m.away.short}
          </span>
        </span>
      </span>
      <StatusLine m={m} />
    </button>
  );
}

/** Full-width row used on the Matches page. */
export function MatchRow({ m, onOpen }: { m: Match; onOpen: (m: Match) => void }) {
  return (
    <button className={cx('match-row', m.state === 'in' && 'is-live')} onClick={() => onOpen(m)}>
      <span className={cx('match-side', m.state === 'post' && m.home.winner && 'winner')}>
        <TeamBadge team={m.home} size={34} />
        <span className="team-name" dir="auto">
          {m.home.name}
        </span>
      </span>
      <span className="match-mid">
        <Score m={m} />
        {m.state !== 'pre' && <StatusLine m={m} />}
      </span>
      <span className={cx('match-side end', m.state === 'post' && m.away.winner && 'winner')}>
        <span className="team-name" dir="auto">
          {m.away.name}
        </span>
        <TeamBadge team={m.away} size={34} />
      </span>
    </button>
  );
}

const EVENT_ICON: Record<string, string> = { goal: '⚽', yellow: '🟨', red: '🟥', sub: '🔄' };

export function MatchSheet({ match, onClose }: { match: Match | null; onClose: () => void }) {
  const t = useT();
  const nav = useNavigate();
  const lang = useSettings((s) => s.lang);
  const [details, setDetails] = useState<MatchDetails | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!match) return;
    let alive = true;
    setDetails(null);
    setFailed(false);
    const load = () =>
      fetchMatchDetails(match.id, lang)
        .then((d) => alive && setDetails(d))
        .catch(() => alive && setFailed(true));
    load();
    const id = match.state === 'in' ? setInterval(load, 30_000) : undefined;
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [match, lang]);

  if (!match) return null;
  const channels = details?.broadcasts.length ? details.broadcasts : match.broadcasts;

  return (
    <Sheet open={!!match} onClose={onClose} title={lang === 'ar' ? match.leagueNameAr : match.leagueName}>
      <div className="md-head">
        <div className="md-team">
          <TeamBadge team={match.home} size={64} />
          <strong dir="auto">{match.home.name}</strong>
        </div>
        <div className="md-center">
          <Score m={match} />
          <StatusLine m={match} />
          <small>{new Date(match.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</small>
        </div>
        <div className="md-team">
          <TeamBadge team={match.away} size={64} />
          <strong dir="auto">{match.away.name}</strong>
        </div>
      </div>

      <button
        className="btn btn-primary btn-lg md-watch"
        onClick={() => {
          onClose();
          nav(`/channels?q=${encodeURIComponent(channels[0] ?? '')}`);
        }}
      >
        <IconTv size={22} /> {t('watchLive')}
      </button>

      {!details && !failed && (
        <div className="center-pad">
          <Spinner />
        </div>
      )}

      {details && (
        <>
          {details.events.length > 0 && (
            <section className="md-section">
              <h4>{t('matchEvents')}</h4>
              <ul className="md-events">
                {details.events.map((e, i) => (
                  <li key={i} className={cx(e.teamId === match.away.id ? 'away' : 'home', e.kind)}>
                    <span className="md-min" dir="ltr">
                      {e.minute}
                    </span>
                    <span className="md-ico">{EVENT_ICON[e.kind]}</span>
                    <span className="md-text" dir="auto">
                      {e.text}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {details.stats.length > 0 && (
            <section className="md-section">
              <h4>{t('matchStats')}</h4>
              {details.stats.map((s) => {
                const total = s.home + s.away || 1;
                return (
                  <div key={s.label} className="md-stat">
                    <div className="md-stat-top">
                      <b>{s.homeText}</b>
                      <span>{s.label}</span>
                      <b>{s.awayText}</b>
                    </div>
                    <div className="md-bars">
                      <span className="home" style={{ width: `${(s.home / total) * 100}%` }} />
                      <span className="away" style={{ width: `${(s.away / total) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </section>
          )}
          <section className="md-section">
            <h4>{t('info')}</h4>
            <dl className="info-list">
              {[
                ['🏟', [details.venue ?? match.venue, details.city].filter(Boolean).join(' — ')],
                ['🧑‍⚖️', details.referee],
                ['📺', channels.join('، ')],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd dir="auto">{v}</dd>
                  </div>
                ))}
            </dl>
          </section>
        </>
      )}
    </Sheet>
  );
}
