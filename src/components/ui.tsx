import { useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { Link } from 'react-router-dom';
import { cx } from '../lib/format';
import { IconStar } from './Icons';

/* ---------- Toasts ---------- */

interface ToastState {
  toasts: { id: number; text: string; action?: { label: string; run: () => void } }[];
  push: (text: string, action?: { label: string; run: () => void }) => void;
  dismiss: (id: number) => void;
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (text, action) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, action }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3800);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (text: string, action?: { label: string; run: () => void }) => useToast.getState().push(text, action);

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.text}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Primitives ---------- */

export function SectionTitle({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <h2 className="section-title">{title}</h2>
        {sub && <p className="section-sub">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function SeeAll({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="see-all">
      {label}
    </Link>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx('toggle', checked && 'on')}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

export function Rating({ value }: { value?: string }) {
  if (!value || value === '0') return null;
  return (
    <span className="rating">
      <IconStar size={14} className="star" />
      {Number(value).toFixed(1)}
    </span>
  );
}

/**
 * Image with a fade-in. Load/fail state is tracked per URL, so a cached image
 * that finishes before React's effects run can never be left invisible.
 */
export function Img({ src, alt, className, fallback }: { src?: string; alt: string; className?: string; fallback?: ReactNode }) {
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const [failedSrc, setFailedSrc] = useState<string>();
  const loaded = !!src && loadedSrc === src;
  if (!src || failedSrc === src) return <div className={cx('img-fallback', className)}>{fallback ?? <span>{alt}</span>}</div>;
  return (
    <img
      ref={(el) => {
        // Already decoded (from cache) before onLoad could be observed.
        if (el && el.complete && el.naturalWidth > 0 && loadedSrc !== src) setLoadedSrc(src);
      }}
      src={src}
      alt={alt}
      className={cx(className, 'fade-img', loaded && 'loaded')}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoadedSrc(src)}
      onError={() => setFailedSrc(src)}
    />
  );
}

export function Spinner({ size = 36 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="loading" />;
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
