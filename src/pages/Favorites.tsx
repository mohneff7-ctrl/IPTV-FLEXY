import { useLibrary } from '../store/library';
import { useT } from '../lib/i18n';
import { PageHeader } from '../components/Shell';
import { PosterCard } from '../components/Cards';
import { ContinueRow } from './Home';
import { Empty, SectionTitle } from '../components/ui';
import { IconHeart } from '../components/Icons';

export default function Favorites() {
  const t = useT();
  const favorites = useLibrary((s) => s.favorites);
  const list = Object.values(favorites).sort((a, b) => b.addedAt - a.addedAt);
  return (
    <div className="page">
      <PageHeader title={t('favorites')} />
      <ContinueRow />
      {list.length ? (
        <section className="section">
          <SectionTitle title={t('favorites')} />
          <div className="grid">
            {list.map((m) => (
              <PosterCard key={m.id} meta={{ ...m, releaseInfo: m.year }} />
            ))}
          </div>
        </section>
      ) : (
        <Empty icon={<IconHeart size={48} />} title={t('emptyFavorites')} text={t('emptyFavoritesHint')} />
      )}
    </div>
  );
}
