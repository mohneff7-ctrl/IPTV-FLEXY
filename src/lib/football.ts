/**
 * Football scores from ESPN's public scoreboard API (no key needed, CORS open).
 * We merge the "all competitions" feed with dedicated feeds for the top
 * leagues (which carry proper names and logos) and de-duplicate by match id.
 */
import { fetchJson } from './stremio';

// The web host (used by espn.com itself) accepts browser user agents; the
// plain site.api host rejects them with 403 from some networks.
const BASE = 'https://site.web.api.espn.com/apis/site/v2/sports/soccer';

/** Featured competitions, in display priority. */
export const TOP_LEAGUES: { slug: string; ar: string; en: string }[] = [
  { slug: 'uefa.champions', ar: 'دوري أبطال أوروبا', en: 'UEFA Champions League' },
  { slug: 'eng.1', ar: 'الدوري الإنجليزي الممتاز', en: 'Premier League' },
  { slug: 'esp.1', ar: 'الدوري الإسباني', en: 'LALIGA' },
  { slug: 'ksa.1', ar: 'دوري روشن السعودي', en: 'Saudi Pro League' },
  { slug: 'ita.1', ar: 'الدوري الإيطالي', en: 'Serie A' },
  { slug: 'ger.1', ar: 'الدوري الألماني', en: 'Bundesliga' },
  { slug: 'fra.1', ar: 'الدوري الفرنسي', en: 'Ligue 1' },
  { slug: 'uefa.europa', ar: 'الدوري الأوروبي', en: 'UEFA Europa League' },
  { slug: 'uefa.europa.conf', ar: 'دوري المؤتمر الأوروبي', en: 'UEFA Conference League' },
  { slug: 'afc.champions', ar: 'دوري أبطال آسيا للنخبة', en: 'AFC Champions League Elite' },
  { slug: 'caf.champions', ar: 'دوري أبطال أفريقيا', en: 'CAF Champions League' },
  { slug: 'fifa.world', ar: 'كأس العالم', en: 'FIFA World Cup' },
  { slug: 'fifa.cwc', ar: 'كأس العالم للأندية', en: 'FIFA Club World Cup' },
  { slug: 'uefa.nations', ar: 'دوري الأمم الأوروبية', en: 'UEFA Nations League' },
  { slug: 'fifa.friendly', ar: 'مباريات ودية دولية', en: 'International Friendly' },
];

/** Arabic names for competitions that only appear in the "all" feed. */
const LEAGUE_AR: Record<string, string> = {
  'Arabian Gulf Cup': 'كأس الخليج العربي',
  'AFCON Qualifying': 'تصفيات كأس أمم أفريقيا',
  'Africa Cup of Nations': 'كأس أمم أفريقيا',
  'Copa del Rey': 'كأس ملك إسبانيا',
  'FA Cup': 'كأس الاتحاد الإنجليزي',
  'Carabao Cup': 'كأس الرابطة الإنجليزية',
  'Coppa Italia': 'كأس إيطاليا',
  'DFB Pokal': 'كأس ألمانيا',
  'Coupe de France': 'كأس فرنسا',
  "Men's International Friendly": 'مباريات ودية دولية',
  'Club Friendly': 'مباريات ودية للأندية',
  'MLS': 'الدوري الأمريكي',
  'Liga MX': 'الدوري المكسيكي',
  'LALIGA 2': 'الدوري الإسباني الدرجة الثانية',
  'EFL Championship': 'دوري البطولة الإنجليزية',
  'EFL League One': 'الدوري الإنجليزي الدرجة الأولى',
  'EFL League Two': 'الدوري الإنجليزي الدرجة الثانية',
  'Taca de Portugal': 'كأس البرتغال',
  'Portuguese Primeira Liga': 'الدوري البرتغالي',
  'Dutch Eredivisie': 'الدوري الهولندي',
  'Turkish Super Lig': 'الدوري التركي',
  'Brazil Serie A': 'الدوري البرازيلي',
  'Brazil Serie B': 'الدوري البرازيلي الدرجة الثانية',
  'UEFA Nations League': 'دوري الأمم الأوروبية',
  'EURO U-21 Qualifying': 'تصفيات أمم أوروبا تحت 21',
  "UEFA Women's Champions League": 'دوري أبطال أوروبا للسيدات',
  'Supercopa Internacional': 'كأس السوبر الدولية',
};

export type MatchState = 'pre' | 'in' | 'post';

export interface Team {
  id: string;
  name: string;
  short: string;
  logo?: string;
  score?: string;
  winner?: boolean;
}

export interface Match {
  id: string;
  leagueKey: string;
  leagueName: string;
  leagueNameAr: string;
  leagueLogo?: string;
  leagueSlug?: string;
  priority: number;
  date: string;
  state: MatchState;
  /** "FT", "HT", "Postponed"… */
  detail: string;
  /** Live minute, e.g. 67' */
  clock?: string;
  home: Team;
  away: Team;
  venue?: string;
  broadcasts: string[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = any;

const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

function team(c: Raw): Team {
  return {
    id: String(c?.team?.id ?? c?.id ?? ''),
    name: c?.team?.displayName ?? c?.team?.name ?? '?',
    short: c?.team?.shortDisplayName ?? c?.team?.abbreviation ?? c?.team?.displayName ?? '?',
    logo: c?.team?.logo ?? c?.team?.logos?.[0]?.href,
    score: c?.score != null ? String(typeof c.score === 'object' ? c.score.displayValue ?? c.score.value : c.score) : undefined,
    winner: !!c?.winner,
  };
}

function normalize(e: Raw, league?: { name: string; ar: string; logo?: string; slug: string; priority: number }): Match | null {
  const comp = e?.competitions?.[0];
  if (!comp) return null;
  const home = comp.competitors?.find((c: Raw) => c.homeAway === 'home') ?? comp.competitors?.[0];
  const away = comp.competitors?.find((c: Raw) => c.homeAway === 'away') ?? comp.competitors?.[1];
  if (!home || !away) return null;
  const note: string = (comp.altGameNote ?? '').split(',')[0].trim();
  const name = league?.name ?? (note || 'Football');
  const status = e.status ?? comp.status ?? {};
  const state: MatchState = status.type?.state ?? 'pre';
  return {
    id: String(e.id),
    leagueKey: league?.slug ?? name,
    leagueName: name,
    leagueNameAr: league?.ar ?? LEAGUE_AR[name] ?? name,
    leagueLogo: league?.logo,
    leagueSlug: league?.slug,
    priority: league?.priority ?? 100,
    date: e.date ?? comp.date,
    state,
    detail: status.type?.shortDetail ?? status.type?.detail ?? '',
    clock: state === 'in' ? status.displayClock : undefined,
    home: team(home),
    away: team(away),
    venue: comp.venue?.fullName ?? e.venue?.displayName,
    broadcasts: [...new Set((comp.broadcasts ?? []).flatMap((b: Raw) => b.names ?? []))] as string[],
  };
}

/** All matches of a (local) day, featured leagues first, live matches first within a league. */
export async function fetchMatches(day: Date, { fresh = false } = {}): Promise<Match[]> {
  const date = ymd(day);
  const ttl = fresh ? 15_000 : 60_000;
  const top = TOP_LEAGUES.map((l, priority) =>
    fetchJson<Raw>(`${BASE}/${l.slug}/scoreboard?dates=${date}`, { ttl, timeout: 12000 })
      .then((d) =>
        (d.events ?? [])
          .map((e: Raw) =>
            normalize(e, { name: l.en, ar: l.ar, slug: l.slug, logo: d.leagues?.[0]?.logos?.[0]?.href, priority }),
          )
          .filter(Boolean) as Match[],
      )
      .catch(() => [] as Match[]),
  );
  const all = fetchJson<Raw>(`${BASE}/all/scoreboard?dates=${date}&limit=1000`, { ttl, timeout: 15000 })
    .then((d) => (d.events ?? []).map((e: Raw) => normalize(e)).filter(Boolean) as Match[])
    .catch(() => [] as Match[]);

  const lists = await Promise.all([...top, all]);
  const byId = new Map<string, Match>();
  lists.flat().forEach((m) => {
    if (!byId.has(m.id)) byId.set(m.id, m); // featured feeds come first and win
  });
  const stateRank: Record<MatchState, number> = { in: 0, pre: 1, post: 2 };
  return [...byId.values()].sort(
    (a, b) => a.priority - b.priority || a.leagueName.localeCompare(b.leagueName) || stateRank[a.state] - stateRank[b.state] || a.date.localeCompare(b.date),
  );
}

export interface MatchEvent {
  minute: string;
  kind: 'goal' | 'yellow' | 'red' | 'sub' | 'other';
  text: string;
  teamId?: string;
}

export interface MatchStat {
  label: string;
  home: number;
  away: number;
  homeText: string;
  awayText: string;
}

export interface MatchDetails {
  events: MatchEvent[];
  stats: MatchStat[];
  venue?: string;
  city?: string;
  referee?: string;
  broadcasts: string[];
}

const STAT_LABELS: Record<string, [string, string]> = {
  possessionPct: ['الاستحواذ', 'Possession'],
  totalShots: ['التسديدات', 'Shots'],
  shotsOnTarget: ['على المرمى', 'On target'],
  wonCorners: ['الركنيات', 'Corners'],
  foulsCommitted: ['الأخطاء', 'Fouls'],
  offsides: ['التسلل', 'Offsides'],
  yellowCards: ['البطاقات الصفراء', 'Yellow cards'],
  redCards: ['البطاقات الحمراء', 'Red cards'],
  saves: ['التصديات', 'Saves'],
};

export async function fetchMatchDetails(id: string, lang: 'ar' | 'en'): Promise<MatchDetails> {
  const d = await fetchJson<Raw>(`${BASE}/all/summary?event=${id}`, { ttl: 20_000 });
  const events: MatchEvent[] = (d.keyEvents ?? [])
    .map((k: Raw): MatchEvent | null => {
      const type: string = `${k.type?.type ?? ''} ${k.type?.text ?? ''}`.toLowerCase();
      const kind: MatchEvent['kind'] = /goal|penalty---scored|own-goal/.test(type)
        ? 'goal'
        : /red/.test(type)
          ? 'red'
          : /yellow/.test(type)
            ? 'yellow'
            : /substitution/.test(type)
              ? 'sub'
              : 'other';
      if (kind === 'other') return null;
      const who = (k.participants ?? []).map((p: Raw) => p.athlete?.displayName).filter(Boolean).join(' ← ');
      return { minute: k.clock?.displayValue ?? '', kind, text: who || k.text || k.type?.text || '', teamId: k.team?.id ? String(k.team.id) : undefined };
    })
    .filter(Boolean);

  const [homeBox, awayBox] = (d.boxscore?.teams ?? []) as Raw[];
  const homeFirst = homeBox?.homeAway !== 'away';
  const [hb, ab] = homeFirst ? [homeBox, awayBox] : [awayBox, homeBox];
  const stats: MatchStat[] = Object.keys(STAT_LABELS)
    .map((name) => {
      const h = hb?.statistics?.find((s: Raw) => s.name === name);
      const a = ab?.statistics?.find((s: Raw) => s.name === name);
      if (!h || !a) return null;
      return {
        label: STAT_LABELS[name][lang === 'ar' ? 0 : 1],
        home: Number(h.displayValue) || 0,
        away: Number(a.displayValue) || 0,
        homeText: name === 'possessionPct' ? `${h.displayValue}%` : h.displayValue,
        awayText: name === 'possessionPct' ? `${a.displayValue}%` : a.displayValue,
      };
    })
    .filter(Boolean) as MatchStat[];

  return {
    events,
    stats,
    venue: d.gameInfo?.venue?.fullName,
    city: [d.gameInfo?.venue?.address?.city, d.gameInfo?.venue?.address?.country].filter(Boolean).join('، '),
    referee: d.gameInfo?.officials?.[0]?.displayName ?? d.gameInfo?.officials?.[0]?.fullName,
    broadcasts: [...new Set((d.broadcasts ?? []).flatMap((b: Raw) => [b.media?.shortName ?? b.names ?? []].flat()))].filter(Boolean) as string[],
  };
}

export function kickoff(m: Match, lang: 'ar' | 'en'): string {
  return new Date(m.date).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function statusText(m: Match, lang: 'ar' | 'en'): string {
  const ar = lang === 'ar';
  if (m.state === 'in') {
    if (/HT|half/i.test(m.detail)) return ar ? 'استراحة' : 'Half-time';
    return m.clock || (ar ? 'مباشر' : 'Live');
  }
  if (m.state === 'post') {
    if (/postp/i.test(m.detail)) return ar ? 'مؤجلة' : 'Postponed';
    if (/canc|abd/i.test(m.detail)) return ar ? 'ملغاة' : 'Cancelled';
    if (/pen/i.test(m.detail)) return ar ? 'انتهت (ركلات ترجيح)' : 'FT (pens)';
    if (/aet/i.test(m.detail)) return ar ? 'انتهت (أشواط إضافية)' : 'AET';
    return ar ? 'انتهت' : 'FT';
  }
  if (/postp/i.test(m.detail)) return ar ? 'مؤجلة' : 'Postponed';
  return kickoff(m, lang);
}
