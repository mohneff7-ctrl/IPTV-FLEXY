import { useRef, useState, type ReactNode } from 'react';
import { useSettings, type Settings as S } from '../store/settings';
import { useLibrary } from '../store/library';
import { useAddons } from '../store/addons';
import { usePlaylists } from '../store/playlists';
import { useT } from '../lib/i18n';
import { langName, SUB_LANG_OPTIONS } from '../lib/subtitles';
import { PageHeader } from '../components/Shell';
import { LogoMark } from '../components/Logo';
import { Toggle, toast } from '../components/ui';
import {
  IconBall,
  IconCC,
  IconDownload,
  IconGlobe,
  IconInfo,
  IconLayers,
  IconLink,
  IconLive,
  IconLock,
  IconNext,
  IconPlay,
  IconSpeed,
  IconTrash,
  IconUser,
} from '../components/Icons';

const VERSION = '1.0.4';

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
      app: 'flexy',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: JSON.parse(localStorage.getItem('flexy.settings') ?? '{}'),
      addons: useAddons.getState().addons.map((a) => a.transportUrl),
      library: JSON.parse(localStorage.getItem('flexy.library') ?? '{}'),
      playlists: usePlaylists.getState().playlists.map((p) => ({ name: p.name, url: p.url })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flexy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'flexy') throw new Error('bad');
      if (data.settings?.state) useSettings.setState(data.settings.state);
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

      <h3 className="set-section">{t('general')}</h3>
      <Row icon={<IconGlobe size={24} />} title={t('language')} desc={t('languageDesc')}>
        <div className="segmented">
          <button className={s.lang === 'ar' ? 'on' : ''} onClick={() => set('lang', 'ar')}>
            العربية
          </button>
          <button className={s.lang === 'en' ? 'on' : ''} onClick={() => set('lang', 'en')}>
            English
          </button>
        </div>
      </Row>
      <Row icon={<IconUser size={24} />} title={t('profile')} desc={t('profileName')}>
        <TextSetting value={s.profileName} onSave={(v) => set('profileName', v)} placeholder="FLEXY" />
      </Row>

      <Row icon={<IconBall size={24} />} title={t('showMatchesHome')} desc={t('showMatchesHomeDesc')}>
        <Toggle checked={s.showMatchesHome} onChange={(v) => set('showMatchesHome', v)} label={t('showMatchesHome')} />
      </Row>

      <h3 className="set-section">{t('player')}</h3>
      <Row icon={<IconNext size={24} />} title={t('autoplayNext')} desc={t('autoplayNextDesc')}>
        <Toggle checked={s.autoplayNext} onChange={(v) => set('autoplayNext', v)} label={t('autoplayNext')} />
      </Row>
      <Row icon={<IconPlay size={22} />} title={t('resumePlayback')} desc={t('resumePlaybackDesc')}>
        <Toggle checked={s.resumePlayback} onChange={(v) => set('resumePlayback', v)} label={t('resumePlayback')} />
      </Row>
      <Row icon={<IconLayers size={24} />} title={t('preferredQuality')} desc={t('preferredQualityDesc')}>
        <select value={s.preferredQuality} onChange={(e) => set('preferredQuality', e.target.value as S['preferredQuality'])}>
          <option value="auto">{t('auto')}</option>
          {['4K', '1080p', '720p', '480p'].map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </Row>
      <Row icon={<IconSpeed size={24} />} title={t('seekStep')}>
        <select value={s.seekStep} onChange={(e) => set('seekStep', Number(e.target.value))}>
          {[5, 10, 15, 30].map((n) => (
            <option key={n} value={n}>
              {n} {t('seconds')}
            </option>
          ))}
        </select>
      </Row>
      <Row icon={<IconCC size={24} />} title={t('subtitleLang')} desc={t('subtitleLangDesc')}>
        <select value={s.subtitleLang} onChange={(e) => set('subtitleLang', e.target.value)}>
          {SUB_LANG_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {langName(l, s.lang)}
            </option>
          ))}
        </select>
      </Row>
      <Row icon={<IconCC size={24} />} title={t('subtitleSize')}>
        <div className="range-wrap">
          <input type="range" min={60} max={180} step={10} value={s.subtitleSize} onChange={(e) => set('subtitleSize', Number(e.target.value))} />
          <b>{s.subtitleSize}%</b>
        </div>
      </Row>
      <Row icon={<IconCC size={24} />} title={t('subtitleBg')} desc={t('subtitleBgDesc')}>
        <Toggle checked={s.subtitleBackground} onChange={(v) => set('subtitleBackground', v)} label={t('subtitleBg')} />
      </Row>

      <h3 className="set-section">{t('streaming')}</h3>
      <Row icon={<IconLive size={24} />} title={t('streamingServer')} desc={t('streamingServerDesc')}>
        <TextSetting value={s.streamingServer} onSave={(v) => set('streamingServer', v)} placeholder="http://127.0.0.1:11470" />
      </Row>
      <Row icon={<IconLink size={24} />} title={t('corsProxy')} desc={t('corsProxyDesc')}>
        <TextSetting value={s.corsProxy} onSave={(v) => set('corsProxy', v)} placeholder="https://proxy.example/?url={url}" />
      </Row>
      <Row icon={<IconLock size={22} />} title={t('showAdult')} desc={t('showAdultDesc')}>
        <Toggle checked={s.showAdult} onChange={(v) => set('showAdult', v)} label={t('showAdult')} />
      </Row>

      <h3 className="set-section">{t('data')}</h3>
      <Row icon={<IconDownload size={24} />} title={t('exportData')} desc={t('exportDataDesc')}>
        <button className="btn btn-soft sm" onClick={exportData}>
          {t('exportData')}
        </button>
      </Row>
      <Row icon={<IconDownload size={24} style={{ transform: 'rotate(180deg)' }} />} title={t('importData')}>
        <button className="btn btn-soft sm" onClick={() => fileRef.current?.click()}>
          {t('importData')}
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
      </Row>
      <Row icon={<IconTrash size={24} />} title={t('clearHistory')} desc={t('clearHistoryDesc')}>
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

      <h3 className="set-section">{t('about')}</h3>
      <Row icon={<IconInfo size={24} />} title="FLEXY" desc={`${t('version')} ${VERSION} · ${t('aboutDesc')}`}>
        <LogoMark size={40} />
      </Row>
    </div>
  );
}
