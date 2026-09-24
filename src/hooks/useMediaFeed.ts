import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  endAt,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { eventConfig } from '../config/event';
import { mediaConverter, type MediaDoc, type MediaItem } from '../types/media';

export type FeedStatus = 'loading' | 'ready' | 'error';

export interface UseMediaFeedOptions {
  /** Admin only: the rules deny this for guests. */
  includeHidden?: boolean;
  pageSize?: number;
  /** Set false until the user is signed in. */
  enabled?: boolean;
}

export interface UseMediaFeedResult {
  items: MediaItem[];
  status: FeedStatus;
  error?: string;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  /** Removes an item locally (after an admin delete) without waiting for a refetch. */
  removeLocal: (id: string) => void;
  /** Patches an item locally (after an admin hide/unhide). */
  patchLocal: (id: string, changes: Partial<MediaDoc>) => void;
}

function toItem(snap: QueryDocumentSnapshot<MediaDoc>): MediaItem {
  return { id: snap.id, ...snap.data() };
}

function sortDesc(a: MediaItem, b: MediaItem): number {
  // Pending (null) timestamps are local writes that have not been acked yet → newest.
  const ta = a.timestamp?.toMillis() ?? Number.POSITIVE_INFINITY;
  const tb = b.timestamp?.toMillis() ?? Number.POSITIVE_INFINITY;
  return tb - ta;
}

/**
 * Live feed with cursor pagination:
 *  - the first page is fetched once and then watched live (`endAt` the last doc),
 *    so new uploads appear at the top without re-reading older pages;
 *  - older pages are fetched on demand with `startAfter`.
 */
export function useMediaFeed({
  includeHidden = false,
  pageSize = eventConfig.feed.pageSize,
  enabled = true,
}: UseMediaFeedOptions = {}): UseMediaFeedResult {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [error, setError] = useState<string>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const liveRef = useRef(new Map<string, MediaItem>());
  const olderRef = useRef(new Map<string, MediaItem>());
  const removedRef = useRef(new Set<string>());
  const cursorRef = useRef<QueryDocumentSnapshot<MediaDoc> | null>(null);
  const baseRef = useRef<Query<MediaDoc> | null>(null);

  const publish = useCallback(() => {
    const merged = new Map<string, MediaItem>();
    olderRef.current.forEach((item, id) => merged.set(id, item));
    liveRef.current.forEach((item, id) => merged.set(id, item));
    removedRef.current.forEach((id) => merged.delete(id));
    setItems([...merged.values()].sort(sortDesc));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    liveRef.current = new Map();
    olderRef.current = new Map();
    removedRef.current = new Set();
    cursorRef.current = null;
    setItems([]);
    setStatus('loading');
    setError(undefined);
    setHasMore(false);

    const col = collection(db, 'media').withConverter(mediaConverter);
    const base = includeHidden
      ? query(col, orderBy('timestamp', 'desc'))
      : query(col, where('hidden', '==', false), orderBy('timestamp', 'desc'));
    baseRef.current = base;

    (async () => {
      const first = await getDocs(query(base, limit(pageSize)));
      if (cancelled) return;
      const anchor = first.docs.at(-1) ?? null;
      cursorRef.current = anchor;
      setHasMore(first.size === pageSize);

      const liveQuery = anchor ? query(base, endAt(anchor)) : base;
      unsubscribe = onSnapshot(
        liveQuery,
        (snap) => {
          liveRef.current = new Map(snap.docs.map((d) => [d.id, toItem(d)]));
          publish();
          setStatus('ready');
        },
        (err) => {
          setError(err.message);
          setStatus('error');
        },
      );
    })().catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [enabled, includeHidden, pageSize, publish]);

  const loadMore = useCallback(async () => {
    const base = baseRef.current;
    const cursor = cursorRef.current;
    if (!base || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getDocs(query(base, startAfter(cursor), limit(pageSize)));
      page.docs.forEach((d) => olderRef.current.set(d.id, toItem(d)));
      cursorRef.current = page.docs.at(-1) ?? cursor;
      setHasMore(page.size === pageSize);
      publish();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, pageSize, publish]);

  const removeLocal = useCallback(
    (id: string) => {
      removedRef.current.add(id);
      publish();
    },
    [publish],
  );

  const patchLocal = useCallback(
    (id: string, changes: Partial<MediaDoc>) => {
      for (const map of [liveRef.current, olderRef.current]) {
        const existing = map.get(id);
        if (existing) map.set(id, { ...existing, ...changes });
      }
      publish();
    },
    [publish],
  );

  return { items, status, error, hasMore, loadingMore, loadMore, removeLocal, patchLocal };
}
