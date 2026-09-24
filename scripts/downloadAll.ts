/**
 * Downloads every uploaded file (images and videos, full size) to ./export/.
 * Uses your Firebase CLI login; no service account and no bucket CORS needed.
 *
 *   npm run export                 # full-size files only
 *   npm run export -- --thumbs     # also thumbnails
 *   npm run export -- --out photos # different output folder
 */
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { accessToken, api, storageBucket } from './cliAuth';

interface StorageObject {
  name: string;
  size: string;
  contentType?: string;
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const bucket = arg('--bucket') ?? storageBucket();
const outDir = arg('--out') ?? 'export';
const includeThumbs = process.argv.includes('--thumbs');
const base = `https://storage.googleapis.com/storage/v1/b/${bucket}/o`;

const objects: StorageObject[] = [];
let pageToken: string | undefined;
do {
  const page = await api<{ items?: StorageObject[]; nextPageToken?: string }>(
    `${base}?prefix=uploads/&maxResults=1000${pageToken ? `&pageToken=${pageToken}` : ''}`,
  );
  objects.push(...(page.items ?? []));
  pageToken = page.nextPageToken;
} while (pageToken);

const targets = objects.filter((o) => includeThumbs || !o.name.startsWith('uploads/thumbs/'));
console.log(`Found ${targets.length} files in gs://${bucket}/uploads/`);

const token = await accessToken();
let downloaded = 0;
let skipped = 0;
for (const object of targets) {
  const destination = join(outDir, object.name);
  const existing = await stat(destination).catch(() => null);
  if (existing && existing.size === Number(object.size)) {
    skipped += 1;
    continue;
  }
  await mkdir(dirname(destination), { recursive: true });
  const response = await fetch(`${base}/${encodeURIComponent(object.name)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok || !response.body) {
    console.error(`Failed ${object.name}: ${response.status}`);
    continue;
  }
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(destination));
  downloaded += 1;
  if (downloaded % 25 === 0) console.log(`${downloaded} downloaded…`);
}

console.log(`Done. ${downloaded} downloaded, ${skipped} already present, in ./${outDir}`);
