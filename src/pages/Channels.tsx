import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePlaylists } from '../store/playlists';
import { usePlayback } from '../store/playback';
import { useCatalogs } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { cx } from '../lib/format';
import type { Channel } from '../lib/m3u';
import { PageHeader } from '../components/Shell';
import { CatalogRow } from '../components/Rows';
import { Empty, Img, SectionTitle, Sheet, Spinner, toast } from '../components/ui';
import { IconLive, IconPlus, IconRefresh, IconSearch, IconTrash, IconTv } from '../components/Icons';

export default function Channels() {
  const t = useT();
  const nav = useNavigate();
  const start = usePlayback((s) => s.start);
  const { playlists, add, reload, remove } = usePlaylists();
  const tvCatalogs = useCatalogs((c) => c.type === 'tv' || c.type === 'channel');
  const [active, setActive] = useState<string | undefined>(playlists[0]?.id);
  const [group, setGroup] = useState<string>();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', url: '' });
  const [busy, setBusy] = useState(false);

  const playlist = playlists.find((p) => p.id === active) ?? playlists[0];
  const groups = useMemo(() => [...new Set(playlist?.channels.map((c) => c.group))], [playlist]);
  const channels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (playlist?.channels ?? []).filter((c) => (!group || c.group === group) && (!q || c.name.toLowerCase().includes(q)));
  }, [playlist, group, query]);

  const play = (c: Channel) => {
    start({
      stream: { url: c.url, name: c.name, addonId: 'm3u', addonName: playlist?.name ?? 'IPTV' },
      videoId: c.id,
      type: 'tv',
      title: c.name,
      subtitle: c.group,
      poster: c.logo,
    });
    nav('/play');
  };

  const submit = async () => {
    setBusy(true);
    try {
      const pl = await add(form.name.trim(), form.url.trim());
      setActive(pl.id);
      setAdding(false);
      setForm({ name: '', url: '' });
      toast(`${pl.name} · ${t('channelsCount', { n: pl.channels.length })}`);
    } catch {
      toast(t('playlistError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title={t('channels')}
        right={
          <button className="icon-btn" onClick={() => setAdding(true)} aria-label={t('addPlaylist')}>
            <IconPlus size={24} />
          </button>
        }
      />

      <section className="section">
        <SectionTitle
          title={t('playlists')}
          action={
            <button className="see-all" onClick={() => setAdding(true)}>
              + {t('addPlaylist')}
            </button>
          }
        />
        {playlists.length === 0 ? (
          <button className="promo promo-red promo-inline" onClick={() => setAdding(true)}>
            <div className="promo-icon">
              <IconLive size={32} />
            </div>
            <div className="promo-text">
              <h3>{t('liveBannerTitle')}</h3>
              <p>{t('liveBannerText')}</p>
            </div>
            <span className="btn promo-btn">{t('addPlaylist')}</span>
          </button>
        ) : (
          <>
            <div className="chips row-scroll">
              {playlists.map((p) => (
                <button key={p.id} className={cx('chip', playlist?.id === p.id && 'active')} onClick={() => (setActive(p.id), setGroup(undefined))}>
                  {p.name} · {p.channels.length}
                </button>
              ))}
            </div>
            {playlist && (
              <>
                <div className="playlist-tools">
                  <div className="search-box compact grow">
                    <IconSearch size={20} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchChannels')} />
                  </div>
                  <button className="icon-btn" onClick={() => reload(playlist.id).then(() => toast(t('saved'))).catch(() => toast(t('playlistError')))} aria-label={t('reload')}>
                    <IconRefresh size={20} />
                  </button>
                  <button className="icon-btn danger" onClick={() => remove(playlist.id)} aria-label={t('uninstall')}>
                    <IconTrash size={20} />
                  </button>
                </div>
                {groups.length > 1 && (
                  <div className="chips row-scroll">
                    <button className={cx('chip', !group && 'active')} onClick={() => setGroup(undefined)}>
                      {t('all')}
                    </button>
                    {groups.map((g) => (
                      <button key={g} className={cx('chip', group === g && 'active')} onClick={() => setGroup(g)}>
                        {g}
                      </button>
                    ))}
                  </div>
                )}
                <div className="channel-grid">
                  {channels.slice(0, 600).map((c) => (
                    <button key={c.id} className="channel-card" onClick={() => play(c)}>
                      <Img src={c.logo} alt={c.name} className="channel-logo" fallback={<IconTv size={30} />} />
                      <span className="channel-name">{c.name}</span>
                    </button>
                  ))}
                </div>
                {!channels.length && <Empty title={t('noResults')} />}
              </>
            )}
          </>
        )}
      </section>

      {tvCatalogs.map((c) => (
        <CatalogRow key={c.key} cref={c} />
      ))}
      {!tvCatalogs.length && playlists.length === 0 && (
        <Empty icon={<IconTv size={44} />} title={t('addonChannels')} text={t('noAddonsForTypeHint')} />
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title={t('addPlaylist')}>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.url.trim()) submit();
          }}
        >
          <label>
            <span>{t('playlistName')}</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="IPTV" />
          </label>
          <label>
            <span>{t('playlistUrl')}</span>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/playlist.m3u"
              dir="ltr"
              inputMode="url"
              required
            />
          </label>
          <button className="btn btn-primary btn-lg" disabled={busy || !form.url.trim()}>
            {busy ? <Spinner size={20} /> : <IconPlus size={20} />} {t('addPlaylist')}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
