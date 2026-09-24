import { beforeEach, describe, expect, it, vi } from 'vitest';

const compressionMock = vi.fn();
vi.mock('browser-image-compression', () => ({ default: compressionMock }));

const { buildCompressOptions, compressImage, makeThumbnail } = await import('./compress');
const { eventConfig } = await import('../config/event');

function fakeFile(size: number, name = 'a.jpg', type = 'image/jpeg'): File {
  const file = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('buildCompressOptions', () => {
  it('uses the configured full-size limits and a web worker', () => {
    const opts = buildCompressOptions('full');
    expect(opts.maxSizeMB).toBe(eventConfig.compression.maxSizeMB);
    expect(opts.maxWidthOrHeight).toBe(eventConfig.compression.maxWidthOrHeight);
    expect(opts.useWebWorker).toBe(true);
    expect(opts.fileType).toBeUndefined();
  });

  it('forces JPEG and the small thumbnail dimensions', () => {
    const opts = buildCompressOptions('thumb');
    expect(opts.maxSizeMB).toBe(eventConfig.thumb.maxSizeMB);
    expect(opts.maxWidthOrHeight).toBe(eventConfig.thumb.maxWidthOrHeight);
    expect(opts.fileType).toBe('image/jpeg');
  });
});

describe('compressImage', () => {
  // Braces matter: a hook that *returns* the mock registers it as a cleanup callback.
  beforeEach(() => {
    compressionMock.mockReset();
  });

  it('returns the compressed file', async () => {
    const original = fakeFile(5_000_000);
    const smaller = fakeFile(800_000);
    compressionMock.mockResolvedValue(smaller);
    await expect(compressImage(original)).resolves.toBe(smaller);
  });

  it('falls back to the original when the library throws (e.g. HEIC)', async () => {
    const original = fakeFile(5_000_000, 'a.heic', 'image/heic');
    compressionMock.mockRejectedValue(new Error('unsupported'));
    await expect(compressImage(original)).resolves.toBe(original);
  });
});

describe('makeThumbnail', () => {
  beforeEach(() => {
    compressionMock.mockReset();
  });

  it('returns the thumbnail when it is under the limit', async () => {
    const thumb = fakeFile(40_000);
    compressionMock.mockResolvedValue(thumb);
    await expect(makeThumbnail(fakeFile(1_000_000))).resolves.toBe(thumb);
  });

  it('returns null when the thumbnail would break the storage rule limit', async () => {
    compressionMock.mockResolvedValue(fakeFile(eventConfig.limits.thumbMaxBytes + 1));
    await expect(makeThumbnail(fakeFile(1_000_000))).resolves.toBeNull();
  });

  it('returns null when generation fails', async () => {
    compressionMock.mockRejectedValue(new Error('boom'));
    await expect(makeThumbnail(fakeFile(1_000_000))).resolves.toBeNull();
  });
});
