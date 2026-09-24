import { lazy, Suspense, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useMediaFeed } from '../hooks/useMediaFeed';
import { LoadMore } from './LoadMore';
import { MediaCard } from './MediaCard';

// The lightbox is only needed once a guest taps a photo; keep it out of the first load.
const MediaLightbox = lazy(() => import('./Lightbox'));

interface Props {
  /** False until the user is signed in; the rules reject unauthenticated reads. */
  enabled: boolean;
}

export function Gallery({ enabled }: Props) {
  const feed = useMediaFeed({ enabled });
  const [openIndex, setOpenIndex] = useState(-1);

  if (!enabled || feed.status === 'loading') {
    return <p className="muted">טוען את הגלריה…</p>;
  }
  if (feed.status === 'error') {
    return (
      <p className="error" role="alert">
        הגלריה לא נטענה. רעננו את הדף ונסו שוב.
      </p>
    );
  }
  if (feed.items.length === 0) {
    return (
      <p className="muted">
        <ImagePlus className="icon" aria-hidden="true" /> עדיין אין תמונות בגלריה. תהיו הראשונים
        להעלות!
      </p>
    );
  }

  return (
    <>
      <div className="gallery-grid">
        {feed.items.map((item, index) => (
          <MediaCard key={item.id} item={item} onOpen={() => setOpenIndex(index)} />
        ))}
      </div>
      <LoadMore hasMore={feed.hasMore} loading={feed.loadingMore} onLoadMore={feed.loadMore} />
      {openIndex >= 0 && (
        <Suspense fallback={null}>
          <MediaLightbox items={feed.items} index={openIndex} onClose={() => setOpenIndex(-1)} />
        </Suspense>
      )}
    </>
  );
}
