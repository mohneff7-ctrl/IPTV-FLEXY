import { useEffect, useMemo, useState } from 'react';
import type { Addon, ManifestCatalog, MetaPreview } from './types';
import { catalogExtras, getCatalog } from './stremio';
import { useAddons } from '../store/addons';

export interface CatalogRef {
  addon: Addon;
  catalog: ManifestCatalog;
  key: string;
}

/** Every browseable catalog from every installed addon, optionally filtered by type. */
export function useCatalogs(filter?: (c: ManifestCatalog, a: Addon) => boolean): CatalogRef[] {
  const addons = useAddons((s) => s.addons);
  return useMemo(
    () =>
      addons.flatMap((addon) =>
        (addon.manifest.catalogs ?? [])
          .filter((c) => catalogExtras(c).browsable && !catalogExtras(c).searchOnly)
          .filter((c) => (filter ? filter(c, addon) : true))
          .map((catalog) => ({ addon, catalog, key: `${addon.manifest.id}|${catalog.type}|${catalog.id}` })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addons],
  );
}

export function useCatalogItems(ref: CatalogRef | undefined, genre?: string) {
  const [items, setItems] = useState<MetaPreview[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!ref) return;
    let alive = true;
    setItems(null);
    setError(false);
    getCatalog(ref.addon, ref.catalog, { genre })
      .then((m) => alive && setItems(m))
      .catch(() => alive && (setError(true), setItems([])));
    return () => {
      alive = false;
    };
  }, [ref?.key, genre]); // eslint-disable-line react-hooks/exhaustive-deps
  return { items, error };
}

/** Paged catalog loading for grids ("See all"). */
export function usePagedCatalog(ref: CatalogRef | undefined, genre?: string) {
  const [items, setItems] = useState<MetaPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setItems([]);
    setDone(false);
  }, [ref?.key, genre]);

  const loadMore = async () => {
    if (!ref || loading || done) return;
    setLoading(true);
    try {
      const skip = items.length;
      const next = await getCatalog(ref.addon, ref.catalog, { genre, skip: skip || undefined });
      const seen = new Set(items.map((i) => i.id));
      const fresh = next.filter((n) => !seen.has(n.id));
      if (!fresh.length || !catalogExtras(ref.catalog).supportsSkip) setDone(true);
      setItems((prev) => [...prev, ...fresh]);
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return { items, loading, done, loadMore };
}

export function useInView<T extends Element>(onEnter: () => void, deps: unknown[] = []) {
  const [el, setEl] = useState<T | null>(null);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onEnter(), {
      rootMargin: '600px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [el, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return setEl;
}

/** Defers rendering (and network) of rows until they get near the viewport. */
export function useLazyVisible<T extends Element>() {
  const [visible, setVisible] = useState(false);
  const ref = useInView<T>(() => setVisible(true), []);
  return [visible ? () => undefined : ref, visible] as const;
}
