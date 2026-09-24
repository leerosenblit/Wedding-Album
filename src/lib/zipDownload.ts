import type { MediaItem } from '../types/media';

export const ZIP_BATCH_SIZE = 50;

export interface ZipProgress {
  fetched: number;
  total: number;
  zipsCreated: number;
}

export function fileNameFor(item: MediaItem): string {
  const base = item.storagePath.split('/').pop() ?? item.id;
  const prefix = item.timestamp ? item.timestamp.toDate().toISOString().slice(0, 19) : 'pending';
  return `${prefix.replace(/[:T]/g, '-')}_${base}`;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Fetches the given items in the browser and hands the user one zip per batch.
 * Requires the Storage bucket to allow CORS for this origin (see cors.json).
 */
export async function downloadAsZips(
  items: MediaItem[],
  onProgress?: (progress: ZipProgress) => void,
): Promise<{ added: number; skipped: number }> {
  const { default: JSZip } = await import('jszip');
  let added = 0;
  let skipped = 0;
  let zipsCreated = 0;

  for (let start = 0; start < items.length; start += ZIP_BATCH_SIZE) {
    const zip = new JSZip();
    for (const item of items.slice(start, start + ZIP_BATCH_SIZE)) {
      try {
        const response = await fetch(item.url);
        if (!response.ok) throw new Error(String(response.status));
        zip.file(fileNameFor(item), await response.blob());
        added += 1;
      } catch {
        skipped += 1;
      }
      onProgress?.({ fetched: added + skipped, total: items.length, zipsCreated });
    }
    if (Object.keys(zip.files).length === 0) continue;
    const blob = await zip.generateAsync({ type: 'blob' });
    zipsCreated += 1;
    triggerDownload(blob, `wedding-album-${zipsCreated}.zip`);
    onProgress?.({ fetched: added + skipped, total: items.length, zipsCreated });
  }

  return { added, skipped };
}
