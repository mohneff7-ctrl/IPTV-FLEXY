import type {
  Addon,
  Manifest,
  ManifestCatalog,
  Meta,
  MetaPreview,
  ResourceDescriptor,
  SourcedStream,
  Stream,
  Subtitle,
} from './types';
import { useSettings } from '../store/settings';
import { isNative, nativeGetText } from './native';

/* ------------------------------------------------------------------ */
/* URLs                                                                */
/* ------------------------------------------------------------------ */

/**
 * Accepts every way people share Stremio addons: `stremio://…`, bare hosts,
 * base URLs, full manifest URLs, `/configure` pages and Stremio Web links
 * (`…#/addons?addon=<encoded manifest url>`).
 */
export function normalizeManifestUrl(input: string): string {
  let url = input.trim().replace(/^["'<\s]+|["'>\s]+$/g, '');
  if (!url) throw new Error('empty');
  const shared = /[?&]addon=([^&#]+)/.exec(url);
  if (shared && /stremio/i.test(url)) url = decodeURIComponent(shared[1]);
  url = url.replace(/^stremio:\/\//i, 'https://');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const u = new URL(url);
  if (!u.pathname.endsWith('/manifest.json')) {
    u.pathname = u.pathname.replace(/\/+$/, '').replace(/\/configure$/i, '') + '/manifest.json';
    u.hash = '';
  }
  return u.toString();
}

export function addonBase(transportUrl: string): string {
  return transportUrl.replace(/\/manifest\.json(\?.*)?$/, '');
}

function encodeExtra(extra?: Record<string, string | number | undefined>): string {
  if (!extra) return '';
  const parts = Object.entries(extra)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? '/' + parts.join('&') : '';
}

export function resourceUrl(
  addon: Addon,
  resource: string,
  type: string,
  id: string,
  extra?: Record<string, string | number | undefined>,
): string {
  return `${addonBase(addon.transportUrl)}/${resource}/${encodeURIComponent(type)}/${encodeURIComponent(id)}${encodeExtra(extra)}.json`;
}

/* ------------------------------------------------------------------ */
/* Fetching (with in-memory cache, in-flight de-duplication, timeout,  */
/* and an optional CORS proxy fallback)                                */
/* ------------------------------------------------------------------ */

const CACHE_TTL = 1000 * 60 * 10;
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function rawFetch(url: string, timeout: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } finally {
    clearTimeout(t);
  }
}

export function withProxy(url: string): string | null {
  const proxy = useSettings.getState().corsProxy.trim();
  if (!proxy) return null;
  return proxy.includes('{url}') ? proxy.replace('{url}', encodeURIComponent(url)) : proxy + url;
}

export async function fetchJson<T>(url: string, { timeout = 15000, useCache = true, ttl = CACHE_TTL } = {}): Promise<T> {
  if (useCache) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < ttl) return hit.data as T;
    const pending = inflight.get(url);
    if (pending) return pending as Promise<T>;
  }
  const run = (async () => {
    if (isNative()) {
      const data = JSON.parse(await nativeGetText(url, timeout)) as T;
      cache.set(url, { at: Date.now(), data });
      return data;
    }
    let res: Response;
    try {
      res = await rawFetch(url, timeout);
    } catch (err) {
      // Network / CORS failure: retry through the user's proxy if one is set.
      const proxied = withProxy(url);
      if (!proxied) throw err;
      res = await rawFetch(proxied, timeout);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as T;
    cache.set(url, { at: Date.now(), data });
    return data;
  })();
  inflight.set(url, run);
  try {
    return await run;
  } finally {
    inflight.delete(url);
  }
}

/* ------------------------------------------------------------------ */
/* Manifest helpers                                                    */
/* ------------------------------------------------------------------ */

export async function fetchManifest(input: string): Promise<Addon> {
  const transportUrl = normalizeManifestUrl(input);
  const manifest = await fetchJson<Manifest>(transportUrl, { useCache: false });
  if (!manifest || !manifest.id || !manifest.name || !Array.isArray(manifest.resources)) {
    throw new Error('invalid-manifest');
  }
  manifest.catalogs = manifest.catalogs ?? [];
  manifest.types = manifest.types ?? [];
  return { transportUrl, manifest };
}

function descriptor(r: string | ResourceDescriptor): ResourceDescriptor {
  return typeof r === 'string' ? { name: r } : r;
}

export function hasResource(m: Manifest, name: string): boolean {
  return m.resources.some((r) => descriptor(r).name === name);
}

/** True when `addon` can answer `resource` for this `type`/`id`, honouring types & idPrefixes. */
export function supports(addon: Addon, resource: string, type: string, id?: string): boolean {
  const m = addon.manifest;
  return m.resources.some((raw) => {
    const r = descriptor(raw);
    if (r.name !== resource) return false;
    const types = r.types ?? m.types ?? [];
    if (types.length && !types.includes(type)) return false;
    const prefixes = r.idPrefixes ?? (typeof raw === 'string' ? m.idPrefixes : undefined);
    if (id && prefixes && prefixes.length && !prefixes.some((p) => id.startsWith(p))) return false;
    return true;
  });
}

export function catalogExtras(c: ManifestCatalog) {
  const list = c.extra ?? [];
  const names = new Set(list.map((e) => e.name));
  (c.extraSupported ?? []).forEach((n) => names.add(n));
  const required = new Set([
    ...list.filter((e) => e.isRequired).map((e) => e.name),
    ...(c.extraRequired ?? []),
  ]);
  const genreOptions = list.find((e) => e.name === 'genre')?.options ?? c.genres ?? [];
  return {
    supportsSearch: names.has('search'),
    supportsSkip: names.has('skip'),
    supportsGenre: names.has('genre') || !!c.genres?.length,
    genreOptions,
    required,
    /** Can be shown as a browseable row without any user input. */
    browsable: [...required].every((r) => r === 'genre' && genreOptions.length > 0) || required.size === 0,
    searchOnly: required.has('search'),
  };
}

/* ------------------------------------------------------------------ */
/* Resource requests                                                   */
/* ------------------------------------------------------------------ */

export async function getCatalog(
  addon: Addon,
  catalog: ManifestCatalog,
  extra: { genre?: string; skip?: number; search?: string } = {},
): Promise<MetaPreview[]> {
  const ex = catalogExtras(catalog);
  const params: Record<string, string | number | undefined> = {};
  if (extra.search) params.search = extra.search;
  if (extra.genre) params.genre = extra.genre;
  else if (ex.required.has('genre')) params.genre = ex.genreOptions[0];
  if (extra.skip) params.skip = extra.skip;
  const url = resourceUrl(addon, 'catalog', catalog.type, catalog.id, params);
  const data = await fetchJson<{ metas?: MetaPreview[] }>(url);
  const metas = (Array.isArray(data.metas) ? data.metas : []).filter((m) => m && m.id && m.name).map(cleanMeta);
  metas.forEach((m) => rememberPreview({ ...m, type: m.type || catalog.type }, addon));
  return metas;
}

const str = (v: unknown): string | undefined => (v == null || v === '' ? undefined : typeof v === 'string' ? v : String(v));
const strList = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x) => x != null).map(String) : typeof v === 'string' ? [v] : undefined;

/** Addons are written by many people: coerce fields the UI treats as text. */
export function cleanMeta<T extends MetaPreview>(m: T): T {
  return {
    ...m,
    id: String(m.id),
    type: str(m.type) ?? '',
    name: String(m.name),
    poster: str(m.poster),
    background: str(m.background),
    logo: str(m.logo),
    description: str(m.description),
    releaseInfo: str(m.releaseInfo),
    year: str(m.year),
    imdbRating: m.imdbRating != null && !isNaN(Number(m.imdbRating)) ? String(m.imdbRating) : undefined,
    runtime: str(m.runtime),
    country: str(m.country),
    genres: strList(m.genres),
    genre: strList(m.genre),
    links: Array.isArray(m.links) ? m.links : undefined,
    trailers: Array.isArray(m.trailers) ? m.trailers : undefined,
    trailerStreams: Array.isArray(m.trailerStreams) ? m.trailerStreams : undefined,
  };
}

/*
 * Catalog previews, remembered so a title still opens when no installed addon
 * has a `meta` resource for it (common with TV / IPTV addons). Stremio does
 * the same: it falls back to the catalog's own preview.
 */
const PREVIEW_KEY = 'flexy.previews';
const previews = new Map<string, { meta: MetaPreview; addonName: string }>();
try {
  const saved = JSON.parse(sessionStorage.getItem(PREVIEW_KEY) ?? '[]') as [string, { meta: MetaPreview; addonName: string }][];
  saved.forEach(([k, v]) => previews.set(k, v));
} catch {
  /* private mode */
}
let persistTimer: ReturnType<typeof setTimeout> | undefined;

function rememberPreview(meta: MetaPreview, addon: Addon) {
  previews.set(`${meta.type}:${meta.id}`, { meta, addonName: addon.manifest.name });
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      sessionStorage.setItem(PREVIEW_KEY, JSON.stringify([...previews.entries()].slice(-800)));
    } catch {
      /* quota */
    }
  }, 500);
}

export function previewOf(type: string, id: string) {
  return previews.get(`${type}:${id}`);
}

export async function getMeta(addons: Addon[], type: string, id: string): Promise<{ meta: Meta; addon: Addon } | null> {
  const candidates = addons.filter((a) => supports(a, 'meta', type, id));
  for (const addon of candidates) {
    try {
      const data = await fetchJson<{ meta?: Meta }>(resourceUrl(addon, 'meta', type, id));
      if (data.meta && data.meta.id) {
        const meta = cleanMeta(data.meta);
        meta.videos = Array.isArray(data.meta.videos) ? data.meta.videos.filter((v) => v && v.id) : undefined;
        meta.cast = strList(data.meta.cast);
        meta.director = strList(data.meta.director);
        meta.writer = strList(data.meta.writer);
        return { meta, addon };
      }
    } catch {
      /* try the next addon */
    }
  }
  return null;
}

/** Queries every stream addon in parallel and reports results as they arrive. */
export function getStreams(
  addons: Addon[],
  type: string,
  id: string,
  onUpdate: (streams: SourcedStream[], pending: number) => void,
): () => void {
  let cancelled = false;
  const candidates = addons.filter((a) => supports(a, 'stream', type, id));
  let pending = candidates.length;
  const all: SourcedStream[] = [];
  onUpdate([], pending);
  candidates.forEach((addon) => {
    const url = resourceUrl(addon, 'stream', type, id);
    // One retry: stream addons (often on free hosting) regularly drop a request.
    fetchJson<{ streams?: Stream[] }>(url, { timeout: 25000 })
      .catch(() => new Promise((r) => setTimeout(r, 800)).then(() => fetchJson<{ streams?: Stream[] }>(url, { timeout: 25000 })))
      .then((data) => {
        (data.streams ?? []).forEach((s) => {
          if (s && (s.url || s.infoHash || s.ytId || s.externalUrl)) {
            all.push({ ...s, addonId: addon.manifest.id, addonName: addon.manifest.name });
          }
        });
      })
      .catch(() => undefined)
      .finally(() => {
        pending -= 1;
        if (!cancelled) onUpdate([...all], pending);
      });
  });
  return () => {
    cancelled = true;
  };
}

export async function getSubtitles(
  addons: Addon[],
  type: string,
  id: string,
  extra: { videoHash?: string; videoSize?: number; filename?: string } = {},
): Promise<(Subtitle & { addonName: string })[]> {
  const candidates = addons.filter((a) => supports(a, 'subtitles', type, id));
  const results = await Promise.allSettled(
    candidates.map(async (addon) => {
      const data = await fetchJson<{ subtitles?: Subtitle[] }>(resourceUrl(addon, 'subtitles', type, id, extra));
      return (data.subtitles ?? []).map((s) => ({ ...s, addonName: addon.manifest.name }));
    }),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

export interface CommunityAddon {
  transportUrl: string;
  manifest: Manifest;
}

export async function getCommunityAddons(): Promise<CommunityAddon[]> {
  const sources = [
    'https://v3-cinemeta.strem.io/addon_catalog/all/official.json',
    'https://v3-cinemeta.strem.io/addon_catalog/all/community.json',
  ];
  const lists = await Promise.allSettled(sources.map((u) => fetchJson<{ addons?: CommunityAddon[] }>(u)));
  const seen = new Set<string>();
  const out: CommunityAddon[] = [];
  lists.forEach((l) => {
    if (l.status !== 'fulfilled') return;
    (l.value.addons ?? []).forEach((a) => {
      if (!a?.manifest?.id || seen.has(a.transportUrl)) return;
      seen.add(a.transportUrl);
      out.push(a);
    });
  });
  if (!out.length) {
    const fallback = await fetchJson<CommunityAddon[]>('https://api.strem.io/addonscollection.json').catch(() => []);
    return fallback.filter((a) => a?.manifest?.id);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Artwork helpers                                                     */
/* ------------------------------------------------------------------ */

const imdbId = (id: string) => (/^tt\d+/.exec(id) ?? [])[0];

export function backgroundOf(m: Partial<MetaPreview> & { id: string }): string | undefined {
  if (m.background) return m.background;
  const tt = imdbId(m.id);
  return tt ? `https://images.metahub.space/background/medium/${tt}/img` : m.poster;
}

export function logoOf(m: Partial<MetaPreview> & { id: string }): string | undefined {
  if (m.logo) return m.logo;
  const tt = imdbId(m.id);
  return tt ? `https://images.metahub.space/logo/medium/${tt}/img` : undefined;
}

export function posterOf(m: Partial<MetaPreview> & { id: string }): string | undefined {
  if (m.poster) return m.poster;
  const tt = imdbId(m.id);
  return tt ? `https://images.metahub.space/poster/medium/${tt}/img` : undefined;
}

export function genresOf(m: Partial<MetaPreview>): string[] {
  return m.genres?.length ? m.genres : m.genre ?? (m.links ?? []).filter((l) => l.category === 'Genres').map((l) => l.name);
}

/** "2026–" → "2026", "2008–2013" → "2008-2013" (en-dashes reorder badly in RTL). */
export function yearOf(m: Partial<Meta>): string | undefined {
  const raw = m.releaseInfo || m.year || (m.released ? String(new Date(m.released).getFullYear()) : undefined);
  return raw?.replace(/[\u2013\u2014]/g, '-').replace(/-\s*$/, '').trim() || undefined;
}

export function trailerOf(m: Partial<MetaPreview>): string | undefined {
  return m.trailerStreams?.find((t) => t.ytId)?.ytId ?? m.trailers?.find((t) => t.source)?.source;
}
