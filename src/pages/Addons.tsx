import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  addonBase,
  catalogExtras,
  fetchJson,
  fetchManifest,
  getCommunityAddons,
  hasResource,
  normalizeManifestUrl,
  resourceUrl,
  type CommunityAddon,
} from '../lib/stremio';
import type { Addon, Manifest, ResourceDescriptor } from '../lib/types';
import { catalogKey, useAddons } from '../store/addons';
import { useSettings } from '../store/settings';
import { typeLabel, useT } from '../lib/i18n';
import { cx } from '../lib/format';
import { PageHeader } from '../components/Shell';
import { catalogPath } from '../components/Rows';
import { Img, SectionTitle, Sheet, Spinner, Toggle, toast } from '../components/ui';
import {
  IconArrowUp,
  IconChevronDown,
  IconCopy,
  IconGear,
  IconPlus,
  IconPuzzle,
  IconRefresh,
  IconSearch,
  IconTrash,
} from '../components/Icons';

type Lang = 'ar' | 'en';
const L = (lang: Lang, ar: string, en: string) => (lang === 'ar' ? ar : en);

const RESOURCE_LABELS: Record<string, [string, string]> = {
  catalog: ['قوائم', 'Catalogs'],
  meta: ['بيانات', 'Metadata'],
  stream: ['روابط', 'Streams'],
  subtitles: ['ترجمات', 'Subtitles'],
  addon_catalog: ['إضافات', 'Addons'],
};

/** Which FLEXY section a content type shows up in. */
function sectionOf(type: string, lang: Lang): string {
  const map: Record<string, [string, string]> = {
    movie: ['الأفلام', 'Movies'],
    series: ['المسلسلات', 'Series'],
    anime: ['الأنمي', 'Anime'],
    tv: ['القنوات', 'Channels'],
    channel: ['القنوات', 'Channels'],
  };
  return map[type]?.[lang === 'ar' ? 0 : 1] ?? L(lang, 'الرئيسية', 'Home');
}

function resources(m: Manifest): ResourceDescriptor[] {
  return m.resources.map((r) => (typeof r === 'string' ? { name: r } : r));
}

function resourceNames(m: Manifest) {
  return [...new Set(resources(m).map((r) => r.name))];
}

/** Human explanation of each role an addon plays inside FLEXY. */
function describeRoles(m: Manifest, lang: Lang): { icon: string; title: string; text: string }[] {
  const out: { icon: string; title: string; text: string }[] = [];
  const typesFor = (r: ResourceDescriptor) => [...new Set((r.types ?? m.types ?? []).map((t) => typeLabel(t, lang)))].join('، ');
  const prefixes = (r: ResourceDescriptor) => r.idPrefixes ?? m.idPrefixes;
  for (const r of resources(m)) {
    const pre = prefixes(r);
    const scope = pre?.length ? L(lang, ` (المعرّفات: ${pre.join('، ')})`, ` (IDs: ${pre.join(', ')})`) : '';
    if (r.name === 'catalog' && m.catalogs.length) {
      const where = [...new Set(m.catalogs.map((c) => sectionOf(c.type, lang)))].join('، ');
      out.push({
        icon: '🗂',
        title: L(lang, 'قوائم المحتوى', 'Catalogs'),
        text: L(lang, `يضيف ${m.catalogs.length} قائمة تظهر في: ${where}، وفي البحث عند دعمه.`, `Adds ${m.catalogs.length} catalogs shown in: ${where}, and in Search when supported.`),
      });
    } else if (r.name === 'meta') {
      out.push({
        icon: '📄',
        title: L(lang, 'تفاصيل الأعمال', 'Details'),
        text: L(lang, `يوفر القصة والحلقات والممثلين والصور لـ: ${typesFor(r)}${scope}.`, `Provides plot, episodes, cast and artwork for: ${typesFor(r)}${scope}.`),
      });
    } else if (r.name === 'stream') {
      out.push({
        icon: '▶️',
        title: L(lang, 'روابط المشاهدة', 'Watch links'),
        text:
          L(lang, `يضيف روابط المشاهدة في قائمة "روابط المشاهدة" لـ: ${typesFor(r)}${scope}.`, `Adds links to the "Watch links" list for: ${typesFor(r)}${scope}.`) +
          (m.behaviorHints?.p2p ? L(lang, ' روابط التورنت تحتاج خادم بث أو حساب Debrid.', ' Torrent links need a streaming server or a Debrid account.') : ''),
      });
    } else if (r.name === 'subtitles') {
      out.push({
        icon: '💬',
        title: L(lang, 'الترجمات', 'Subtitles'),
        text: L(lang, `يضيف ترجمات داخل المشغل (زر CC) لـ: ${typesFor(r)}.`, `Adds subtitles in the player (CC button) for: ${typesFor(r)}.`),
      });
    } else if (r.name === 'addon_catalog') {
      out.push({
        icon: '🧩',
        title: L(lang, 'دليل إضافات', 'Addon directory'),
        text: L(lang, 'يقترح إضافات أخرى في قسم "اكتشف الإضافات".', 'Suggests more addons under "Discover addons".'),
      });
    }
  }
  return out;
}

function AddonTags({ m }: { m: Manifest }) {
  const lang = useSettings((s) => s.lang);
  return (
    <div className="addon-tags">
      {resourceNames(m).map((r) => (
        <span key={r} className={cx('tag', r === 'stream' && 'tag-red')}>
          {RESOURCE_LABELS[r]?.[lang === 'ar' ? 0 : 1] ?? r}
        </span>
      ))}
      {m.types.slice(0, 4).map((ty) => (
        <span key={ty} className="tag tag-ghost">
          {typeLabel(ty, lang)}
        </span>
      ))}
    </div>
  );
}

function RoleList({ m }: { m: Manifest }) {
  const lang = useSettings((s) => s.lang);
  const roles = describeRoles(m, lang);
  if (!roles.length) return null;
  return (
    <ul className="role-list">
      {roles.map((r) => (
        <li key={r.title}>
          <span className="role-ico">{r.icon}</span>
          <div>
            <strong>{r.title}</strong>
            <p>{r.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Stremio-style install confirmation: shows what the addon will do first. */
function InstallSheet({ url, onClose }: { url: string | null; onClose: () => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const { addons, install } = useAddons();
  const [preview, setPreview] = useState<Addon | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!url) return;
    setPreview(null);
    setError(false);
    fetchManifest(url)
      .then(setPreview)
      .catch(() => setError(true));
  }, [url]);

  const existing = preview && addons.find((a) => a.manifest.id === preview.manifest.id);
  const needsConfig = preview?.manifest.behaviorHints?.configurationRequired;

  return (
    <Sheet open={!!url} onClose={onClose} title={t('addAddon')}>
      {!preview && !error && (
        <div className="center-pad">
          <Spinner />
        </div>
      )}
      {error && <p className="install-error">{t('addonError')}</p>}
      {preview && (
        <div className="install-preview">
          <div className="install-head">
            <Img src={preview.manifest.logo} alt="" className="addon-logo lg" fallback={<IconPuzzle size={34} />} />
            <div>
              <h3 dir="auto">{preview.manifest.name}</h3>
              <span className="addon-version">v{preview.manifest.version}</span>
            </div>
          </div>
          {preview.manifest.description && (
            <p className="addon-desc full" dir="auto">
              {preview.manifest.description}
            </p>
          )}
          <h4 className="role-head">{L(lang, 'ماذا ستضيف هذه الإضافة؟', 'What this addon adds')}</h4>
          <RoleList m={preview.manifest} />
          <p className="install-url" dir="ltr">
            {preview.transportUrl}
          </p>
          {needsConfig ? (
            <a className="btn btn-primary btn-lg full" href={`${addonBase(preview.transportUrl)}/configure`} target="_blank" rel="noopener">
              <IconGear size={20} /> {t('configure')}
            </a>
          ) : (
            <button
              className="btn btn-primary btn-lg full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const a = await install(preview.transportUrl);
                  toast(t('addonInstalled', { name: a.manifest.name }));
                  onClose();
                } catch {
                  toast(t('addonError'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Spinner size={20} /> : <IconPlus size={20} />}{' '}
              {existing ? L(lang, 'تحديث الإضافة', 'Update addon') : t('install')}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Everything about one installed addon: on/off, its roles and each catalog. */
function AddonDetails({ addon, onClose }: { addon: Addon | null; onClose: () => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const { addons, setDisabled, toggleCatalog, hiddenCatalogs, remove, move } = useAddons();
  const live = addon && addons.find((a) => a.transportUrl === addon.transportUrl);
  if (!live) return null;
  const m = live.manifest;
  const index = addons.indexOf(live);

  return (
    <Sheet open onClose={onClose} title={m.name}>
      <div className="install-head">
        <Img src={m.logo} alt="" className="addon-logo lg" fallback={<IconPuzzle size={34} />} />
        <div className="grow">
          <h3 dir="auto">{m.name}</h3>
          <span className="addon-version">v{m.version}</span>
        </div>
        <Toggle checked={!live.disabled} onChange={(v) => setDisabled(live.transportUrl, !v)} label={L(lang, 'تفعيل', 'Enabled')} />
      </div>
      {live.disabled && <p className="addon-off-note">{L(lang, 'الإضافة متوقفة: لن تُستخدم في أي مكان حتى تفعّلها.', 'Turned off: FLEXY ignores it until you turn it back on.')}</p>}
      {m.description && (
        <p className="addon-desc full" dir="auto">
          {m.description}
        </p>
      )}

      <h4 className="role-head">{L(lang, 'دورها في التطبيق', 'Its role in FLEXY')}</h4>
      <RoleList m={m} />

      {m.catalogs.length > 0 && (
        <>
          <h4 className="role-head">{L(lang, 'القوائم', 'Catalogs')}</h4>
          <div className="catalog-list">
            {m.catalogs.map((c) => {
              const key = catalogKey(m.id, c.type, c.id);
              const ex = catalogExtras(c);
              const searchOnly = ex.searchOnly || !ex.browsable;
              return (
                <div key={key} className="catalog-item">
                  <div className="grow">
                    <strong dir="auto">{c.name || c.id}</strong>
                    <small>
                      {typeLabel(c.type, lang)} · {searchOnly ? L(lang, 'للبحث فقط', 'Search only') : sectionOf(c.type, lang)}
                      {ex.supportsSearch && !searchOnly ? L(lang, ' · يدعم البحث', ' · searchable') : ''}
                    </small>
                  </div>
                  {!searchOnly && !live.disabled && (
                    <Link to={catalogPath({ addon: live, catalog: c, key })} className="see-all" onClick={onClose}>
                      {t('seeAll')}
                    </Link>
                  )}
                  {!searchOnly && (
                    <Toggle checked={!hiddenCatalogs.includes(key)} onChange={() => toggleCatalog(key)} label={c.name || c.id} />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="addon-detail-actions">
        {m.behaviorHints?.configurable && (
          <a className="btn btn-soft sm" href={`${addonBase(live.transportUrl)}/configure`} target="_blank" rel="noopener">
            <IconGear size={16} /> {t('configure')}
          </a>
        )}
        <button
          className="btn btn-soft sm"
          onClick={() => navigator.clipboard?.writeText(live.transportUrl).then(() => toast(t('copied')))}
        >
          <IconCopy size={16} /> {t('copyLink')}
        </button>
        <button className="btn btn-soft sm" disabled={index === 0} onClick={() => move(live.transportUrl, -1)}>
          <IconArrowUp size={16} /> {L(lang, 'أولوية أعلى', 'Move up')}
        </button>
        <button className="btn btn-soft sm" disabled={index === addons.length - 1} onClick={() => move(live.transportUrl, 1)}>
          <IconChevronDown size={16} /> {L(lang, 'أولوية أقل', 'Move down')}
        </button>
        {!live.protected && (
          <button
            className="btn btn-danger sm"
            onClick={() => {
              remove(live.transportUrl);
              onClose();
              toast(t('addonRemoved'));
            }}
          >
            <IconTrash size={16} /> {t('uninstall')}
          </button>
        )}
      </div>
      <p className="addon-order-note">
        {L(lang, 'ترتيب الإضافات يحدد أيها يُسأل أولاً عن التفاصيل، وترتيب القوائم في الرئيسية.', 'Addon order decides which one is asked first for details, and the order of rows on Home.')}
      </p>
    </Sheet>
  );
}

/** Addon lists offered by installed addons that have the addon_catalog resource. */
async function addonCatalogsFrom(addons: Addon[]): Promise<CommunityAddon[]> {
  const lists = await Promise.allSettled(
    addons
      .filter((a) => !a.disabled && hasResource(a.manifest, 'addon_catalog') && a.manifest.addonCatalogs?.length)
      .flatMap((a) =>
        (a.manifest.addonCatalogs ?? []).map((c) =>
          fetchJson<{ addons?: CommunityAddon[] }>(resourceUrl(a, 'addon_catalog', c.type, c.id)).then((d) => d.addons ?? []),
        ),
      ),
  );
  return lists.flatMap((l) => (l.status === 'fulfilled' ? l.value : []));
}

export default function Addons() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const { addons, refresh } = useAddons();
  const showAdult = useSettings((s) => s.showAdult);
  const [params, setParams] = useSearchParams();
  const [url, setUrl] = useState('');
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [details, setDetails] = useState<Addon | null>(null);
  const [community, setCommunity] = useState<CommunityAddon[] | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    Promise.all([getCommunityAddons().catch(() => []), addonCatalogsFrom(addons).catch(() => [])]).then(([a, b]) => {
      const seen = new Set<string>();
      setCommunity(
        [...a, ...b].filter((x) => x?.manifest?.id && !seen.has(x.transportUrl) && (seen.add(x.transportUrl), true)),
      );
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep links: #/addons?install=<manifest url> (also stremio:// links opened in the app).
  const deepLink = params.get('install') ?? params.get('addon');
  useEffect(() => {
    if (!deepLink) return;
    setInstallUrl(deepLink);
    setParams({}, { replace: true });
  }, [deepLink]); // eslint-disable-line react-hooks/exhaustive-deps

  const installedUrls = new Set(addons.map((a) => a.transportUrl));
  const installedIds = new Set(addons.map((a) => a.manifest.id));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (community ?? []).filter((a) => {
      const m = a.manifest;
      if (!showAdult && m.behaviorHints?.adult) return false;
      if (filter !== 'all' && !hasResource(m, filter)) return false;
      return !q || `${m.name} ${m.description ?? ''}`.toLowerCase().includes(q);
    });
  }, [community, query, filter, showAdult]);

  let validUrl = false;
  try {
    validUrl = !!url.trim() && !!normalizeManifestUrl(url);
  } catch {
    validUrl = false;
  }

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) setUrl(text);
    } catch {
      toast(L(lang, 'اسمح بالوصول للحافظة أو الصق الرابط يدوياً', 'Allow clipboard access or paste manually'));
    }
  };

  return (
    <div className="page addons-page">
      <PageHeader
        title={t('addons')}
        right={
          <button
            className="icon-btn"
            aria-label={t('reload')}
            onClick={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
              toast(L(lang, 'تم تحديث الإضافات', 'Addons updated'));
            }}
          >
            {refreshing ? <Spinner size={20} /> : <IconRefresh size={22} />}
          </button>
        }
      />
      <p className="page-intro">{t('addonsHint')}</p>

      <form
        className="add-addon"
        onSubmit={(e) => {
          e.preventDefault();
          if (validUrl) setInstallUrl(url.trim());
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('addonUrlPlaceholder')}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
        />
        <button type="button" className="btn btn-soft" onClick={paste}>
          {L(lang, 'لصق', 'Paste')}
        </button>
        <button className="btn btn-primary" disabled={!validUrl}>
          <IconPlus size={20} /> {t('install')}
        </button>
      </form>
      <p className="add-help">
        {L(
          lang,
          'يعمل أي رابط إضافة Stremio: manifest.json أو stremio:// أو رابط موقع الإضافة. بعد "إعداد" إضافة مثل Torrentio اضغط Install أو انسخ الرابط والصقه هنا.',
          'Any Stremio addon link works: manifest.json, stremio:// or the addon website. After configuring an addon like Torrentio, tap Install or copy its link and paste it here.',
        )}
      </p>

      <section className="section">
        <SectionTitle title={`${t('installedAddons')} (${addons.length})`} />
        <div className="addon-list">
          {addons.map((a) => (
            <div key={a.transportUrl} className={cx('addon-card', a.disabled && 'is-off')}>
              <button className="addon-card-main" onClick={() => setDetails(a)}>
                <Img src={a.manifest.logo} alt={a.manifest.name} className="addon-logo" fallback={<IconPuzzle size={28} />} />
                <span className="addon-body">
                  <span className="addon-title">
                    <strong dir="auto">{a.manifest.name}</strong>
                    <span className="addon-version">v{a.manifest.version}</span>
                  </span>
                  {a.manifest.description && (
                    <span className="addon-desc" dir="auto">
                      {a.manifest.description}
                    </span>
                  )}
                  <AddonTags m={a.manifest} />
                </span>
              </button>
              <div className="addon-actions">
                <Toggle
                  checked={!a.disabled}
                  onChange={(v) => useAddons.getState().setDisabled(a.transportUrl, !v)}
                  label={a.manifest.name}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionTitle title={t('discoverAddons')} />
        <div className="search-box compact">
          <IconSearch size={20} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchAddons')} />
        </div>
        <div className="chips row-scroll">
          {['all', 'stream', 'catalog', 'subtitles', 'meta'].map((f) => (
            <button key={f} className={cx('chip', filter === f && 'active')} onClick={() => setFilter(f)}>
              {f === 'all' ? t('all') : RESOURCE_LABELS[f][lang === 'ar' ? 0 : 1]}
            </button>
          ))}
        </div>
        {!community && (
          <div className="center-pad">
            <Spinner />
          </div>
        )}
        <div className="addon-list">
          {visible.map((a) => {
            const installed = installedUrls.has(a.transportUrl) || installedIds.has(a.manifest.id);
            return (
              <div key={a.transportUrl} className="addon-card">
                <button className="addon-card-main" onClick={() => setInstallUrl(a.transportUrl)}>
                  <Img src={a.manifest.logo} alt={a.manifest.name} className="addon-logo" fallback={<IconPuzzle size={28} />} />
                  <span className="addon-body">
                    <span className="addon-title">
                      <strong dir="auto">{a.manifest.name}</strong>
                      <span className="addon-version">v{a.manifest.version}</span>
                    </span>
                    {a.manifest.description && (
                      <span className="addon-desc" dir="auto">
                        {a.manifest.description}
                      </span>
                    )}
                    <AddonTags m={a.manifest} />
                  </span>
                </button>
                <div className="addon-actions">
                  <button
                    className={cx('btn sm', installed ? 'btn-soft' : 'btn-primary')}
                    disabled={installed}
                    onClick={() => setInstallUrl(a.transportUrl)}
                  >
                    {installed ? t('installed') : t('install')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <InstallSheet url={installUrl} onClose={() => setInstallUrl(null)} />
      {details && <AddonDetails addon={details} onClose={() => setDetails(null)} />}
    </div>
  );
}
