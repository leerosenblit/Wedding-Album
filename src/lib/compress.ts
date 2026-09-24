import imageCompression, { type Options } from 'browser-image-compression';
import { eventConfig } from '../config/event';

export type CompressKind = 'full' | 'thumb';

/** Pure helper so the options are unit-testable. */
export function buildCompressOptions(kind: CompressKind): Options {
  if (kind === 'thumb') {
    return {
      maxSizeMB: eventConfig.thumb.maxSizeMB,
      maxWidthOrHeight: eventConfig.thumb.maxWidthOrHeight,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.8,
    };
  }
  return {
    maxSizeMB: eventConfig.compression.maxSizeMB,
    maxWidthOrHeight: eventConfig.compression.maxWidthOrHeight,
    useWebWorker: true,
    initialQuality: 0.85,
  };
}

/**
 * Compresses an image for upload. Returns the original file if compression
 * fails (for example HEIC on browsers that cannot decode it).
 */
export async function compressImage(file: File, kind: CompressKind = 'full'): Promise<File> {
  try {
    return await imageCompression(file, buildCompressOptions(kind));
  } catch {
    return file;
  }
}

/**
 * Builds a small JPEG thumbnail. Returns `null` when it cannot be produced or
 * would exceed the thumbnail size limit, so callers can skip it safely.
 */
export async function makeThumbnail(file: File): Promise<File | null> {
  try {
    const thumb = await imageCompression(file, buildCompressOptions('thumb'));
    if (thumb.size > eventConfig.limits.thumbMaxBytes) return null;
    return thumb;
  } catch {
    return null;
  }
}
