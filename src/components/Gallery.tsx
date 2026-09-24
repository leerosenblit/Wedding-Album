import { lazy, Suspense, useState } from 'react';
import { CheckSquare, Download, ImagePlus, X } from 'lucide-react';
import { useMediaFeed } from '../hooks/useMediaFeed';
import { useToast } from '../hooks/useToast';
import { downloadAsZips, type ZipProgress } from '../lib/zipDownload';
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
  const toast = useToast();
  const [openIndex, setOpenIndex] = useState(-1);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);

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

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exitSelectMode = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const downloadSelected = async () => {
    const targets = feed.items.filter((item) => selected.has(item.id));
    if (targets.length === 0) return;
    setZipProgress({ fetched: 0, total: targets.length, zipsCreated: 0 });
    try {
      const { added, skipped } = await downloadAsZips(targets, setZipProgress);
      if (skipped > 0) toast.show(`${added} ירדו, ${skipped} נכשלו. נסו שוב.`, 'error');
      else toast.show(added === 1 ? 'הקובץ ירד.' : `${added} קבצים נארזו להורדה.`, 'success');
      if (skipped === 0) exitSelectMode();
    } catch {
      toast.show('ההורדה נכשלה.', 'error');
    } finally {
      setZipProgress(null);
    }
  };

  return (
    <>
      <div className="gallery-toolbar">
        {selecting ? (
          <>
            <span className="muted">{selected.size} נבחרו</span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setSelected(new Set(feed.items.map((i) => i.id)))}
            >
              בחירת הכול
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={selected.size === 0 || zipProgress !== null}
              onClick={downloadSelected}
            >
              <Download className="icon" aria-hidden="true" />
              {zipProgress ? `מוריד… ${zipProgress.fetched}/${zipProgress.total}` : 'הורדת הנבחרים'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={exitSelectMode}
              disabled={zipProgress !== null}
            >
              <X className="icon" aria-hidden="true" />
              ביטול
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={() => setSelecting(true)}>
            <CheckSquare className="icon" aria-hidden="true" />
            בחירת תמונות להורדה
          </button>
        )}
      </div>

      <div className={`gallery-grid${selecting ? ' gallery-grid--selecting' : ''}`}>
        {feed.items.map((item, index) => (
          <MediaCard
            key={item.id}
            item={item}
            onOpen={() => (selecting ? toggle(item.id) : setOpenIndex(index))}
          >
            {selecting && (
              <span
                className={`media-card__check${selected.has(item.id) ? ' media-card__check--on' : ''}`}
                aria-hidden="true"
              >
                ✓
              </span>
            )}
          </MediaCard>
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
