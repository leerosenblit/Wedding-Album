import { eventConfig } from '../config/event';
import type { MediaType } from '../types/media';

export type ValidationResult = { ok: true; kind: MediaType } | { ok: false; reason: string };

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

/**
 * Client-side pre-flight check. Images are validated for size again after
 * compression (see `assertImageSize`); videos are uploaded as-is.
 */
export function validateFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
  limits = eventConfig.limits,
): ValidationResult {
  const type = file.type.toLowerCase();
  if (!type) {
    return { ok: false, reason: 'לא הצלחנו לזהות את סוג הקובץ. נסו לבחור אותו שוב.' };
  }
  if (type.startsWith('image/')) {
    return { ok: true, kind: 'image' };
  }
  if (type.startsWith('video/')) {
    if (file.size > limits.videoMaxBytes) {
      return {
        ok: false,
        reason: `הסרטון גדול מדי (${formatBytes(file.size)}). המקסימום הוא ${formatBytes(limits.videoMaxBytes)}.`,
      };
    }
    return { ok: true, kind: 'video' };
  }
  return { ok: false, reason: 'אפשר להעלות רק תמונות וסרטונים.' };
}

/** Post-compression size check for images. Throws a user-facing Hebrew message. */
export function assertImageSize(file: Pick<File, 'size'>, limits = eventConfig.limits): void {
  if (file.size > limits.imageMaxBytes) {
    throw new Error(
      `התמונה גדולה מדי (${formatBytes(file.size)}). המקסימום הוא ${formatBytes(limits.imageMaxBytes)}.`,
    );
  }
}
