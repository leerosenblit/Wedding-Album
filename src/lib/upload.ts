import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from './firebase';
import { compressImage, makeThumbnail } from './compress';
import { buildUploadPath } from './storagePath';
import { assertImageSize, validateFile } from './validateFile';
import { mediaConverter, type MediaDoc } from '../types/media';
import { eventConfig } from '../config/event';

export type UploadStage = 'compressing' | 'uploading';

export interface UploadMeta {
  guestName?: string;
  caption?: string;
}

export interface UploadOneOptions {
  uid: string;
  onStage?: (stage: UploadStage) => void;
  /** Fraction 0..1 of the main file's bytes transferred. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export class UploadCancelledError extends Error {
  constructor() {
    super('ההעלאה בוטלה');
    this.name = 'UploadCancelledError';
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new UploadCancelledError();
}

function uploadFile(
  path: string,
  file: File,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    throwIfAborted(signal);
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });
    const onAbort = () => task.cancel();
    signal?.addEventListener('abort', onAbort, { once: true });

    task.on(
      'state_changed',
      (snap) => onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      (error) => {
        signal?.removeEventListener('abort', onAbort);
        reject(signal?.aborted ? new UploadCancelledError() : error);
      },
      async () => {
        signal?.removeEventListener('abort', onAbort);
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

function cleanText(value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/**
 * Full pipeline for one file: validate → compress → thumbnail → upload → Firestore.
 * The Firestore document is written last, so the gallery never shows a broken item.
 * Resolves with the new document id.
 */
export async function uploadOne(
  file: File,
  meta: UploadMeta,
  { uid, onStage, onProgress, signal }: UploadOneOptions,
): Promise<string> {
  const check = validateFile(file);
  if (!check.ok) throw new Error(check.reason);
  throwIfAborted(signal);

  let mainFile = file;
  let thumbFile: File | null = null;

  if (check.kind === 'image') {
    onStage?.('compressing');
    mainFile = await compressImage(file, 'full');
    assertImageSize(mainFile);
    throwIfAborted(signal);
    thumbFile = await makeThumbnail(mainFile);
    throwIfAborted(signal);
  }

  onStage?.('uploading');
  const paths = buildUploadPath(mainFile);

  // Thumbnails are best-effort: a failure here must not lose the photo.
  let thumbUrl: string | undefined;
  if (thumbFile) {
    try {
      thumbUrl = await uploadFile(paths.thumbPath, thumbFile, undefined, signal);
    } catch (error) {
      if (error instanceof UploadCancelledError) throw error;
      thumbUrl = undefined;
    }
  }

  const url = await uploadFile(paths.path, mainFile, onProgress, signal);
  throwIfAborted(signal);

  const doc: MediaDoc = {
    url,
    type: check.kind,
    timestamp: null,
    storagePath: paths.path,
    uid,
    hidden: false,
    thumbUrl,
    thumbPath: thumbUrl ? paths.thumbPath : undefined,
    caption: cleanText(meta.caption, eventConfig.limits.captionMax),
    guestName: cleanText(meta.guestName, eventConfig.limits.guestNameMax),
  };

  const created = await addDoc(collection(db, 'media').withConverter(mediaConverter), {
    ...doc,
    timestamp: serverTimestamp(),
  });
  return created.id;
}
