import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Addon, ManifestCatalog } from '../lib/types';
import { catalogExtras } from '../lib/stremio';
import { useCatalogs, useCatalogItems } from '../lib/hooks';
import { genreLabel, typeLabel, useT } from '../lib/i18n';
import { useSettings } from '../store/settings';
import { useAddons } from '../store/addons';
import { cx } from '../lib/format';
import { Hero } from '../components/Hero';
import { CatalogRow } from '../components/Rows';
import { Empty, toast } from '../components/ui';
import { IconPuzzle } from '../components/Icons';

const isAnimeAddon = (a: Addon) => /anime|kitsu|anilist|mal\b/i.test(`${a.manifest.id} ${a.manifest.name}`);

export function matchesSection(section: string, c: ManifestCatalog, a: Addon): boolean {
  if (section === 'anime') return c.type === 'anime' || (isAnimeAddon(a) && ['series', 'movie'].includes(c.type));
  if (isAnimeAddon(a) && section !== 'anime') return false;
  return c.type === section;
}

const SUGGESTED: Record<string, { name: string; url: string }> = {
  anime: { name: 'Anime Kitsu', url: 'https://anime-kitsu.strem.fun/manifest.json' },
};

export default function Browse() {
  const { type = 'movie' } = useParams();
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const install = useAddons((s) => s.install);
  const catalogs = useCatalogs((c, a) => matchesSection(type, c, a));
  const [genre, setGenre] = useState<string>();
  const heroRef = catalogs[0];
  const { items: heroItems } = useCatalogItems(heroRef);
  const genres = [...new Set(catalogs.flatMap((c) => catalogExtras(c.catalog).genreOptions))].slice(0, 40);
  const shown = genre ? catalogs.filter((c) => catalogExtras(c.catalog).genreOptions.includes(genre)) : catalogs;
  const suggestion = SUGGESTED[type];

  if (!catalogs.length) {
    return (
      <div className="page page-pad">
        <Empty
          icon={<IconPuzzle size={48} />}
          title={t('noAddonsForType')}
          text={t('noAddonsForTypeHint')}
          action={
            suggestion ? (
              <button
                className="btn btn-primary"
                onClick={() =>
                  install(suggestion.url)
                    .then(() => toast(t('addonInstalled', { name: suggestion.name })))
                    .catch(() => toast(t('addonError')))
                }
              >
                {t('install')} {suggestion.name}
              </button>
            ) : (
              <Link to="/addons" className="btn btn-primary">
                {t('goToAddons')}
              </Link>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="page browse">
      <Hero items={heroItems} />
      <h1 className="page-title-inline">{typeLabel(type, lang)}</h1>
      {genres.length > 0 && (
        <div className="chips row-scroll">
          <button className={cx('chip', !genre && 'active')} onClick={() => setGenre(undefined)}>
            {t('all')}
          </button>
          {genres.map((g) => (
            <button key={g} className={cx('chip', genre === g && 'active')} onClick={() => setGenre(g)}>
              {genreLabel(g, lang)}
            </button>
          ))}
        </div>
      )}
      {shown.map((c) => (
        <CatalogRow
          key={c.key + (genre ?? '')}
          cref={c}
          genre={genre}
          title={genre ? `${c.catalog.name ?? c.catalog.id} · ${genreLabel(genre, lang)}` : undefined}
        />
      ))}
    </div>
  );
}
