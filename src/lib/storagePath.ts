/** Keep in sync with the `storagePath` regex in firestore.rules. */
export const UPLOAD_PATH_RE = /^uploads\/[A-Za-z0-9-]+\.[a-z0-9]{1,5}$/;
export const THUMB_PATH_RE = /^uploads\/thumbs\/[A-Za-z0-9-]+\.[a-z0-9]{1,5}$/;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
  'video/3gpp': '3gp',
};

/** File extension (no dot, lowercase, 1–5 chars) chosen from MIME first, then the name. */
export function extensionFor(file: Pick<File, 'name' | 'type'>): string {
  const byMime = MIME_EXTENSIONS[file.type.toLowerCase()];
  if (byMime) return byMime;
  const match = /\.([a-z0-9]{1,5})$/i.exec(file.name);
  return match ? match[1].toLowerCase() : 'bin';
}

export interface UploadPaths {
  id: string;
  path: string;
  thumbPath: string;
}

export function newUploadId(): string {
  return crypto.randomUUID();
}

/** Random, collision-free storage paths; the original file name is never used. */
export function buildUploadPath(
  file: Pick<File, 'name' | 'type'>,
  id = newUploadId(),
): UploadPaths {
  return {
    id,
    path: `uploads/${id}.${extensionFor(file)}`,
    thumbPath: `uploads/thumbs/${id}.jpg`,
  };
}
