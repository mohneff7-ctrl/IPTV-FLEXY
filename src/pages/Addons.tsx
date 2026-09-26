import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addonBase, getCommunityAddons, hasResource, normalizeManifestUrl, type CommunityAddon } from '../lib/stremio';
import type { Manifest } from '../lib/types';
import { useAddons } from '../store/addons';
import { useSettings } from '../store/settings';
import { typeLabel, useT } from '../lib/i18n';
import { cx } from '../lib/format';
import { PageHeader } from '../components/Shell';
import { Img, SectionTitle, Spinner, toast } from '../components/ui';
import { IconArrowUp, IconChevronDown, IconGear, IconPlus, IconPuzzle, IconRefresh, IconSearch, IconTrash } from '../components/Icons';

const RESOURCE_LABELS: Record<string, [string, string]> = {
  catalog: ['قوائم', 'Catalogs'],
  meta: ['بيانات', 'Metadata'],
  stream: ['روابط', 'Streams'],
  subtitles: ['ترجمات', 'Subtitles'],
  addon_catalog: ['إضافات', 'Addons'],
};

function resourceNames(m: Manifest) {
  return [...new Set(m.resources.map((r) => (typeof r === 'string' ? r : r.name)))];
}

function AddonMeta({ m }: { m: Manifest }) {
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

export default function Addons() {
  const t = useT();
  const { addons, install, remove, move, refresh } = useAddons();
  const showAdult = useSettings((s) => s.showAdult);
  const [params, setParams] = useSearchParams();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [community, setCommunity] = useState<CommunityAddon[] | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getCommunityAddons().then(setCommunity).catch(() => setCommunity([]));
  }, []);

  // Support deep links: #/addons?install=<manifest url>
  const deepLink = params.get('install') ?? params.get('addon');
  useEffect(() => {
    if (!deepLink) return;
    setUrl(deepLink);
    setParams({}, { replace: true });
  }, [deepLink]); // eslint-disable-line react-hooks/exhaustive-deps

  const installedUrls = new Set(addons.map((a) => a.transportUrl));
  const installedIds = new Set(addons.map((a) => a.manifest.id));

  const doInstall = async (u: string) => {
    setBusy(u);
    try {
      const a = await install(u);
      toast(t('addonInstalled', { name: a.manifest.name }));
      setUrl('');
    } catch {
      toast(t('addonError'));
    } finally {
      setBusy(null);
    }
  };

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
          if (validUrl) doInstall(url);
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
        <button className="btn btn-primary" disabled={!validUrl || !!busy}>
          {busy === url ? <Spinner size={18} /> : <IconPlus size={20} />} {t('install')}
        </button>
      </form>

      <section className="section">
        <SectionTitle title={`${t('installedAddons')} (${addons.length})`} />
        <div className="addon-list">
          {addons.map((a, i) => (
            <div key={a.transportUrl} className="addon-card">
              <Img src={a.manifest.logo} alt={a.manifest.name} className="addon-logo" fallback={<IconPuzzle size={28} />} />
              <div className="addon-body">
                <div className="addon-title">
                  <strong>{a.manifest.name}</strong>
                  <span className="addon-version">v{a.manifest.version}</span>
                </div>
                {a.manifest.description && <p className="addon-desc">{a.manifest.description}</p>}
                <AddonMeta m={a.manifest} />
              </div>
              <div className="addon-actions">
                <button className="icon-btn sm" disabled={i === 0} onClick={() => move(a.transportUrl, -1)} aria-label="up">
                  <IconArrowUp size={18} />
                </button>
                <button className="icon-btn sm" disabled={i === addons.length - 1} onClick={() => move(a.transportUrl, 1)} aria-label="down">
                  <IconChevronDown size={18} />
                </button>
                {a.manifest.behaviorHints?.configurable && (
                  <a className="icon-btn sm" href={`${addonBase(a.transportUrl)}/configure`} target="_blank" rel="noopener" aria-label={t('configure')}>
                    <IconGear size={18} />
                  </a>
                )}
                {!a.protected && (
                  <button
                    className="icon-btn sm danger"
                    onClick={() => {
                      remove(a.transportUrl);
                      toast(t('addonRemoved'), { label: '↺', run: () => doInstall(a.transportUrl) });
                    }}
                    aria-label={t('uninstall')}
                  >
                    <IconTrash size={18} />
                  </button>
                )}
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
          {['all', 'stream', 'catalog', 'subtitles'].map((f) => (
            <button key={f} className={cx('chip', filter === f && 'active')} onClick={() => setFilter(f)}>
              {f === 'all' ? t('all') : f === 'stream' ? t('watchLinks') : f === 'catalog' ? t('catalog') : t('subtitles')}
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
            const needsConfig = a.manifest.behaviorHints?.configurationRequired;
            return (
              <div key={a.transportUrl} className="addon-card">
                <Img src={a.manifest.logo} alt={a.manifest.name} className="addon-logo" fallback={<IconPuzzle size={28} />} />
                <div className="addon-body">
                  <div className="addon-title">
                    <strong>{a.manifest.name}</strong>
                    <span className="addon-version">v{a.manifest.version}</span>
                  </div>
                  {a.manifest.description && <p className="addon-desc">{a.manifest.description}</p>}
                  <AddonMeta m={a.manifest} />
                </div>
                <div className="addon-actions">
                  {needsConfig ? (
                    <a className="btn btn-soft sm" href={`${addonBase(a.transportUrl)}/configure`} target="_blank" rel="noopener">
                      {t('configure')}
                    </a>
                  ) : (
                    <button
                      className={cx('btn sm', installed ? 'btn-soft' : 'btn-primary')}
                      disabled={installed || busy === a.transportUrl}
                      onClick={() => doInstall(a.transportUrl)}
                    >
                      {busy === a.transportUrl ? <Spinner size={16} /> : installed ? t('installed') : t('install')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
