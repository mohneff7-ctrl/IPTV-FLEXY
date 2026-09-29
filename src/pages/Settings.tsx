import { useRef, useState, type ReactNode } from 'react';
import { useSettings, type Settings as S } from '../store/settings';
import { useLibrary } from '../store/library';
import { useAddons } from '../store/addons';
import { usePlaylists } from '../store/playlists';
import { useT } from '../lib/i18n';
import { langName, SUB_LANG_OPTIONS } from '../lib/subtitles';
import { PageHeader } from '../components/Shell';
import { Logo, LogoMark } from '../components/Logo';
import { Toggle, toast } from '../components/ui';
import { SubtitlePreview, SubtitleStyleControls } from '../components/SubtitleStyle';
import { APP_ID, APP_NAME, APP_VERSION } from '../lib/brand';
import { nativePlayerAvailable } from '../lib/nativePlayer';
import {
  IconBolt,
  IconCC,
  IconDownload,
  IconGlobe,
  IconHand,
  IconPalette,
  IconInfo,
  IconLayers,
  IconLink,
  IconLive,
  IconLock,
  IconNext,
  IconPlay,
  IconSpeed,
  IconStar,
  IconTrash,
  IconUser,
} from '../components/Icons';

/** Backups made before the rename carry the old id. */
const BACKUP_IDS = [APP_ID, 'flexy'];

function Row({ icon, title, desc, children }: { icon: ReactNode; title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="set-row">
      <span className="set-icon">{icon}</span>
      <div className="set-text">
        <strong>{title}</strong>
        {desc && <small>{desc}</small>}
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

function TextSetting({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  const t = useT();
  return (
    <form
      className="set-input"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v.trim());
        toast(t('saved'));
      }}
    >
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} dir="ltr" spellCheck={false} autoCapitalize="off" />
      {v !== value && <button className="btn btn-primary sm">{t('save')}</button>}
    </form>
  );
}

export default function Settings() {
  const t = useT();
  const s = useSettings();
  const clearHistory = useLibrary((x) => x.clearHistory);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof S>(k: K, v: S[K]) => s.set({ [k]: v } as Partial<S>);

  const exportData = () => {
    const data = {
      app: APP_ID,
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: JSON.parse(localStorage.getItem(`${APP_ID}.settings`) ?? '{}'),
      addons: useAddons.getState().addons.map((a) => a.transportUrl),
      library: JSON.parse(localStorage.getItem(`${APP_ID}.library`) ?? '{}'),
      playlists: usePlaylists.getState().playlists.map((p) => ({ name: p.name, url: p.url })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${APP_ID}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!BACKUP_IDS.includes(data.app)) throw new Error('bad');
      if (data.settings?.state) {
        const { subtitleBackground, ...rest } = data.settings.state;
        useSettings.setState(subtitleBackground === false ? { ...rest, subtitleBgOpacity: 0 } : rest);
      }
      if (data.library?.state) useLibrary.setState(data.library.state);
      await Promise.allSettled((data.addons ?? []).map((u: string) => useAddons.getState().install(u)));
      await Promise.allSettled(
        (data.playlists ?? []).map((p: { name: string; url: string }) => usePlaylists.getState().add(p.name, p.url)),
      );
      toast(t('importDone'));
    } catch {
      toast(t('importError'));
    }
  };

  return (
    <div className="page settings">
      <PageHeader title={t('settings')} />

      <div className="set-hero">
        <LogoMark size={56} />
        <div className="set-hero-text">
          <Logo size={34} markless />
          <small>
            {s.profileName ? `${s.profileName} · ` : ''}
            {t('version')} {APP_VERSION}
          </small>
        </div>
      </div>

      <h3 className="set-section">{t('general')}</h3>
      <div className="set-card">
        <Row icon={<IconGlobe size={22} />} title={t('language')} desc={t('languageDesc')}>
          <div className="segmented">
            <button className={s.lang === 'ar' ? 'on' : ''} onClick={() => set('lang', 'ar')}>
              العربية
            </button>
            <button className={s.lang === 'en' ? 'on' : ''} onClick={() => set('lang', 'en')}>
              English
            </button>
          </div>
        </Row>
        <Row icon={<IconUser size={22} />} title={t('profile')} desc={t('profileName')}>
          <TextSetting value={s.profileName} onSave={(v) => set('profileName', v)} placeholder={APP_NAME} />
        </Row>
        <Row icon={<IconStar size={20} />} title={t('intro')}>
          <Toggle checked={s.showIntro} onChange={(v) => set('showIntro', v)} label={t('intro')} />
        </Row>
      </div>

      <h3 className="set-section">{t('player')}</h3>
      <div className="set-card">
        {nativePlayerAvailable() && (
          <Row icon={<IconBolt size={22} />} title={t('nativePlayer')} desc={t('nativePlayerDesc')}>
            <Toggle checked={s.nativePlayer} onChange={(v) => set('nativePlayer', v)} label={t('nativePlayer')} />
          </Row>
        )}
        <Row icon={<IconNext size={22} />} title={t('autoplayNext')} desc={t('autoplayNextDesc')}>
          <Toggle checked={s.autoplayNext} onChange={(v) => set('autoplayNext', v)} label={t('autoplayNext')} />
        </Row>
        <Row icon={<IconPlay size={20} />} title={t('resumePlayback')} desc={t('resumePlaybackDesc')}>
          <Toggle checked={s.resumePlayback} onChange={(v) => set('resumePlayback', v)} label={t('resumePlayback')} />
        </Row>
        <Row icon={<IconHand size={22} />} title={t('swipeGestures')} desc={t('swipeGesturesDesc')}>
          <Toggle checked={s.swipeGestures} onChange={(v) => set('swipeGestures', v)} label={t('swipeGestures')} />
        </Row>
        <Row icon={<IconLayers size={22} />} title={t('preferredQuality')} desc={t('preferredQualityDesc')}>
          <select value={s.preferredQuality} onChange={(e) => set('preferredQuality', e.target.value as S['preferredQuality'])}>
            <option value="auto">{t('auto')}</option>
            {['4K', '1080p', '720p', '480p'].map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </Row>
        <Row icon={<IconStar size={20} />} title={t('streamQuality')} desc={t('streamQualityDesc')}>
          <div className="segmented">
            {(
              [
                ['max', 'qBest'],
                ['auto', 'qBalanced'],
                ['saver', 'qSaver'],
              ] as const
            ).map(([v, k]) => (
              <button key={v} className={s.streamQuality === v ? 'on' : ''} onClick={() => set('streamQuality', v)}>
                {t(k)}
              </button>
            ))}
          </div>
        </Row>
        <Row icon={<IconSpeed size={22} />} title={t('seekStep')}>
          <select value={s.seekStep} onChange={(e) => set('seekStep', Number(e.target.value))}>
            {[5, 10, 15, 30].map((n) => (
              <option key={n} value={n}>
                {n} {t('seconds')}
              </option>
            ))}
          </select>
        </Row>
      </div>

      <h3 className="set-section">{t('subtitles')}</h3>
      <div className="set-card">
        <Row icon={<IconCC size={22} />} title={t('subtitleLang')} desc={t('subtitleLangDesc')}>
          <select value={s.subtitleLang} onChange={(e) => set('subtitleLang', e.target.value)}>
            {SUB_LANG_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {langName(l, s.lang)}
              </option>
            ))}
          </select>
        </Row>
        <Row icon={<IconPalette size={22} />} title={t('subtitleStyle')} desc={t('subtitleStyleDesc')} />
        <SubtitlePreview />
        <SubtitleStyleControls />
      </div>

      <h3 className="set-section">{t('streaming')}</h3>
      <div className="set-card">
        <Row icon={<IconLive size={22} />} title={t('streamingServer')} desc={t('streamingServerDesc')}>
          <TextSetting value={s.streamingServer} onSave={(v) => set('streamingServer', v)} placeholder="http://127.0.0.1:11470" />
        </Row>
        <Row icon={<IconLink size={22} />} title={t('corsProxy')} desc={t('corsProxyDesc')}>
          <TextSetting value={s.corsProxy} onSave={(v) => set('corsProxy', v)} placeholder="https://proxy.example/?url={url}" />
        </Row>
        <Row icon={<IconLock size={20} />} title={t('showAdult')} desc={t('showAdultDesc')}>
          <Toggle checked={s.showAdult} onChange={(v) => set('showAdult', v)} label={t('showAdult')} />
        </Row>
      </div>

      <h3 className="set-section">{t('data')}</h3>
      <div className="set-card">
        <Row icon={<IconDownload size={22} />} title={t('exportData')} desc={t('exportDataDesc')}>
          <button className="btn btn-soft sm" onClick={exportData}>
            {t('exportData')}
          </button>
        </Row>
        <Row icon={<IconDownload size={22} style={{ transform: 'rotate(180deg)' }} />} title={t('importData')}>
          <button className="btn btn-soft sm" onClick={() => fileRef.current?.click()}>
            {t('importData')}
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        </Row>
        <Row icon={<IconTrash size={22} />} title={t('clearHistory')} desc={t('clearHistoryDesc')}>
          <button
            className="btn btn-danger sm"
            onClick={() => {
              if (confirm(t('clearHistory') + '?')) {
                clearHistory();
                toast(t('historyCleared'));
              }
            }}
          >
            {t('clear')}
          </button>
        </Row>
      </div>

      <h3 className="set-section">{t('about')}</h3>
      <div className="set-card">
        <Row icon={<IconInfo size={22} />} title={APP_NAME} desc={`${t('version')} ${APP_VERSION} · ${t('aboutDesc')}`} />
      </div>
    </div>
  );
}
