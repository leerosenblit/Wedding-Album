import { useEffect, useRef } from 'react';

interface Props {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

/** Infinite-scroll sentinel with a button fallback. */
export function LoadMore({ hasMore, loading, onLoadMore }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="load-more">
      <button type="button" className="btn btn--ghost" onClick={onLoadMore} disabled={loading}>
        {loading ? 'טוען…' : 'טענו עוד'}
      </button>
    </div>
  );
}
