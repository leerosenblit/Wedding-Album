import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type WithFieldValue,
} from 'firebase/firestore';

export type MediaType = 'image' | 'video';

/** Shape of a document in the `media` collection. Mirrors `firestore.rules`. */
export interface MediaDoc {
  url: string;
  type: MediaType;
  /** `null` only while a local write is pending (before the server assigns it). */
  timestamp: Timestamp | null;
  storagePath: string;
  uid: string;
  hidden: boolean;
  thumbUrl?: string;
  thumbPath?: string;
  caption?: string;
  guestName?: string;
}

export interface MediaItem extends MediaDoc {
  id: string;
}

function stripUndefined<T extends object>(obj: T): DocumentData {
  const out: DocumentData = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export const mediaConverter: FirestoreDataConverter<MediaDoc> = {
  toFirestore(doc: WithFieldValue<MediaDoc>): DocumentData {
    // Firestore rejects `undefined`; the rules use keys().hasOnly(), so drop them.
    return stripUndefined(doc);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): MediaDoc {
    const data = snapshot.data({ serverTimestamps: 'estimate', ...options });
    return {
      url: String(data.url ?? ''),
      type: data.type === 'video' ? 'video' : 'image',
      timestamp: data.timestamp instanceof Timestamp ? data.timestamp : null,
      storagePath: String(data.storagePath ?? ''),
      uid: String(data.uid ?? ''),
      hidden: data.hidden === true,
      thumbUrl: typeof data.thumbUrl === 'string' ? data.thumbUrl : undefined,
      thumbPath: typeof data.thumbPath === 'string' ? data.thumbPath : undefined,
      caption: typeof data.caption === 'string' ? data.caption : undefined,
      guestName: typeof data.guestName === 'string' ? data.guestName : undefined,
    };
  },
};

/** Best-effort MIME type for a stored video, derived from its storage path. */
export function videoMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    default:
      return 'video/mp4';
  }
}
