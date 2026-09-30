import type { Addon, SourcedStream, Stream, Video } from '../lib/types';
import { getStreams } from '../lib/stremio';
import { playableUrl, qualityOf } from '../lib/streams';

/** Next episode in watch order (specials are skipped unless we are in them). */
export function nextVideo(videos: Video[] | undefined, current?: Video): Video | undefined {
  if (!videos || !current) return undefined;
  const same = (v: Video) => ((current.season ?? 0) === 0 ? (v.season ?? 0) === 0 : (v.season ?? 0) > 0);
  const order = videos
    .filter(same)
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? a.number ?? 0) - (b.episode ?? b.number ?? 0));
  const i = order.findIndex((v) => v.id === current.id);
  return i >= 0 ? order[i + 1] : undefined;
}

/**
 * Best stream for the next episode, like Stremio: same bingeGroup first,
 * otherwise the same addon in the same quality, otherwise anything playable.
 */
export function findNextStream(
  addons: Addon[],
  type: string,
  videoId: string,
  current: SourcedStream | Stream & { addonId?: string },
): Promise<SourcedStream | undefined> {
  return new Promise((resolve) => {
    const group = current.behaviorHints?.bingeGroup;
    const q = qualityOf(current);
    let best: SourcedStream | undefined;
    const timer = setTimeout(() => (stop(), resolve(best)), 15000);
    const stop = getStreams(addons, type, videoId, (list, pending) => {
      const playable = list.filter((s) => playableUrl(s));
      const binge = group && playable.find((s) => s.behaviorHints?.bingeGroup === group);
      if (binge) {
        clearTimeout(timer);
        stop();
        return resolve(binge);
      }
      best =
        playable.find((s) => s.addonId === current.addonId && qualityOf(s) === q) ??
        playable.find((s) => s.addonId === current.addonId) ??
        best ??
        playable[0];
      if (pending === 0) {
        clearTimeout(timer);
        resolve(best);
      }
    });
  });
}

export function episodeLabel(v: Video, t: (k: 'season' | 'episode') => string): string {
  return `${t('season')} ${v.season} · ${t('episode')} ${v.episode ?? v.number}${v.title || v.name ? ' — ' + (v.title || v.name) : ''}`;
}
