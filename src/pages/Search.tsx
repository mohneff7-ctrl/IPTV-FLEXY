import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { MetaPreview } from '../lib/types';
import { catalogExtras, getCatalog } from '../lib/stremio';
import { useActiveAddons } from '../store/addons';
import { useLibrary } from '../store/library';
import { useSettings } from '../store/settings';
import { typeLabel, useT } from '../lib/i18n';
import { PageHeader } from '../components/Shell';
import { MetaRow } from '../components/Rows';
import { Empty } from '../components/ui';
import { IconClose, IconSearch } from '../components/Icons';

interface Group {
  key: string;
  title: string;
  items: MetaPreview[] | null;
}

export default function Search() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const addons = useActiveAddons();
  const { searches, addSearch, clearSearches } = useLibrary();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  const [groups, setGroups] = useState<Group[]>([]);
  const q = params.get('q') ?? '';
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce typing into the URL (keeps history & back-navigation sane).
  useEffect(() => {
    const id = setTimeout(() => {
      if (input.trim() !== q) setParams(input.trim() ? { q: input.trim() } : {}, { replace: true });
    }, 450);
    return () => clearTimeout(id);
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!q) return setGroups([]);
    let alive = true;
    const targets = addons.flatMap((addon) =>
      addon.manifest.catalogs
        .filter((c) => catalogExtras(c).supportsSearch)
        .map((catalog) => ({ addon, catalog, key: `${addon.manifest.id}|${catalog.type}|${catalog.id}` })),
    );
    setGroups(
      targets.map((x) => ({
        key: x.key,
        title: `${typeLabel(x.catalog.type, lang)} · ${x.addon.manifest.name}`,
        items: null,
      })),
    );
    targets.forEach((x) => {
      getCatalog(x.addon, x.catalog, { search: q })
        .catch(() => [])
        .then((items) => alive && setGroups((gs) => gs.map((g) => (g.key === x.key ? { ...g, items } : g))));
    });
    addSearch(q);
    return () => {
      alive = false;
    };
  }, [q, addons]); // eslint-disable-line react-hooks/exhaustive-deps

  const allDone = groups.length > 0 && groups.every((g) => g.items);
  const noResults = allDone && groups.every((g) => !g.items!.length);

  return (
    <div className="page">
      <PageHeader title={t('search')} />
      <div className="search-box">
        <IconSearch size={22} />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setParams(input.trim() ? { q: input.trim() } : {})}
          placeholder={t('searchPlaceholder')}
          enterKeyHint="search"
        />
        {input && (
          <button className="icon-btn" onClick={() => setInput('')} aria-label={t('clear')}>
            <IconClose size={20} />
          </button>
        )}
      </div>
      {!q && searches.length > 0 && (
        <div className="recent">
          <div className="recent-head">
            <h3>{t('recentSearches')}</h3>
            <button className="link-btn" onClick={clearSearches}>
              {t('clear')}
            </button>
          </div>
          <div className="chips wrap">
            {searches.map((s) => (
              <button key={s} className="chip" onClick={() => setInput(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {!q && !searches.length && <Empty icon={<IconSearch size={48} />} title={t('typeToSearch')} />}
      {groups.map((g) => (
        <MetaRow key={g.key} title={g.title} items={g.items} />
      ))}
      {noResults && <Empty title={t('noResults')} />}
    </div>
  );
}
