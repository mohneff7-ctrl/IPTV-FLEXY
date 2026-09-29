import { SUBTITLE_DEFAULTS, useSettings, type SubtitleEdge } from '../store/settings';
import { SUBTITLE_BG_COLORS, SUBTITLE_COLORS, SUBTITLE_FONTS, subtitleVars } from '../lib/subtitleStyle';
import { useT } from '../lib/i18n';
import { cx } from '../lib/format';

function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (c: string) => void; label: string }) {
  const t = useT();
  const custom = !colors.includes(value.toLowerCase());
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={value.toLowerCase() === c}
          aria-label={c}
          className={cx('swatch', value.toLowerCase() === c && 'on')}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <label className={cx('swatch swatch-custom', custom && 'on')} title={t('customColor')} style={custom ? { background: value } : undefined}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('customColor')} />
        {!custom && <span aria-hidden="true">+</span>}
      </label>
    </div>
  );
}

/** Live sample over a cinematic backdrop so choices can be judged in context. */
export function SubtitlePreview() {
  const s = useSettings();
  const t = useT();
  return (
    <div className="sub-preview" style={subtitleVars(s)} dir="auto">
      <div className="sub-preview-scene" aria-hidden="true" />
      <div className="p-subs static">
        <span>{t('subtitlePreview')}</span>
      </div>
    </div>
  );
}

/** Every subtitle appearance option. Used in Settings and in the player menu. */
export function SubtitleStyleControls({ compact }: { compact?: boolean }) {
  const s = useSettings();
  const t = useT();
  const edges: { id: SubtitleEdge; key: 'edgeShadow' | 'edgeOutline' | 'edgeNone' }[] = [
    { id: 'shadow', key: 'edgeShadow' },
    { id: 'outline', key: 'edgeOutline' },
    { id: 'none', key: 'edgeNone' },
  ];
  return (
    <div className={cx('sub-style', compact && 'compact')}>
      <div className="ss-row">
        <span className="ss-label">{t('subtitleSize')}</span>
        <div className="range-wrap">
          <input
            type="range"
            min={50}
            max={200}
            step={10}
            value={s.subtitleSize}
            onChange={(e) => s.set({ subtitleSize: Number(e.target.value) })}
            aria-label={t('subtitleSize')}
          />
          <b>{s.subtitleSize}%</b>
        </div>
      </div>

      <div className="ss-row col">
        <span className="ss-label">{t('subtitleFont')}</span>
        <div className="font-chips">
          {SUBTITLE_FONTS.map((f) => (
            <button
              key={f.id}
              className={cx('font-chip', s.subtitleFont === f.id && 'on')}
              style={{ fontFamily: f.family }}
              onClick={() => s.set({ subtitleFont: f.id })}
            >
              <b>Aa أب</b>
              <small>{f.label}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="ss-row">
        <span className="ss-label">{t('subtitleBold')}</span>
        <div className="segmented">
          <button className={!s.subtitleBold ? 'on' : ''} onClick={() => s.set({ subtitleBold: false })}>
            Aa
          </button>
          <button className={s.subtitleBold ? 'on' : ''} onClick={() => s.set({ subtitleBold: true })}>
            <b>Aa</b>
          </button>
        </div>
      </div>

      <div className="ss-row col">
        <span className="ss-label">{t('subtitleColor')}</span>
        <Swatches colors={SUBTITLE_COLORS} value={s.subtitleColor} onChange={(c) => s.set({ subtitleColor: c })} label={t('subtitleColor')} />
      </div>

      <div className="ss-row">
        <span className="ss-label">{t('subtitleEdge')}</span>
        <div className="segmented">
          {edges.map((e) => (
            <button key={e.id} className={s.subtitleEdge === e.id ? 'on' : ''} onClick={() => s.set({ subtitleEdge: e.id })}>
              {t(e.key)}
            </button>
          ))}
        </div>
      </div>

      <div className="ss-row col">
        <span className="ss-label">{t('subtitleBg')}</span>
        <Swatches colors={SUBTITLE_BG_COLORS} value={s.subtitleBgColor} onChange={(c) => s.set({ subtitleBgColor: c, subtitleBgOpacity: s.subtitleBgOpacity || 60 })} label={t('subtitleBg')} />
      </div>

      <div className="ss-row">
        <span className="ss-label">{t('subtitleBgOpacity')}</span>
        <div className="range-wrap">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={s.subtitleBgOpacity}
            onChange={(e) => s.set({ subtitleBgOpacity: Number(e.target.value) })}
            aria-label={t('subtitleBgOpacity')}
          />
          <b>{s.subtitleBgOpacity === 0 ? t('off') : `${s.subtitleBgOpacity}%`}</b>
        </div>
      </div>

      <button className="btn btn-soft sm ss-reset" onClick={() => s.set(SUBTITLE_DEFAULTS)}>
        {t('resetDefaults')}
      </button>
    </div>
  );
}
