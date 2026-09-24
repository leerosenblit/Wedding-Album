import { describe, expect, it } from 'vitest';
import { eventConfig } from '../config/event';
import { assertImageSize, formatBytes, validateFile } from './validateFile';

const MB = 1024 * 1024;

describe('validateFile', () => {
  it('accepts images of any raw size (they are compressed later)', () => {
    expect(validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 80 * MB })).toEqual({
      ok: true,
      kind: 'image',
    });
  });

  it('accepts videos up to the limit and rejects larger ones', () => {
    const limit = eventConfig.limits.videoMaxBytes;
    expect(validateFile({ name: 'v.mp4', type: 'video/mp4', size: limit })).toEqual({
      ok: true,
      kind: 'video',
    });
    const result = validateFile({ name: 'v.mp4', type: 'video/mp4', size: limit + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('גדול מדי');
  });

  it('rejects unknown and empty MIME types', () => {
    expect(validateFile({ name: 'x.pdf', type: 'application/pdf', size: 10 }).ok).toBe(false);
    expect(validateFile({ name: 'x', type: '', size: 10 }).ok).toBe(false);
  });
});

describe('assertImageSize', () => {
  it('throws only above the post-compression limit', () => {
    expect(() => assertImageSize({ size: eventConfig.limits.imageMaxBytes })).not.toThrow();
    expect(() => assertImageSize({ size: eventConfig.limits.imageMaxBytes + 1 })).toThrow();
  });
});

describe('formatBytes', () => {
  it('formats in the most readable unit', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(1.5 * MB)).toBe('1.5MB');
  });
});
