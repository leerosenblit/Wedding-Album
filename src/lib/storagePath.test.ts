import { describe, expect, it } from 'vitest';
import { buildUploadPath, extensionFor, THUMB_PATH_RE, UPLOAD_PATH_RE } from './storagePath';

describe('extensionFor', () => {
  it('prefers the MIME type over the file name', () => {
    expect(extensionFor({ name: 'IMG_0001.HEIC', type: 'image/jpeg' })).toBe('jpg');
    expect(extensionFor({ name: 'clip.MOV', type: 'video/quicktime' })).toBe('mov');
  });

  it('falls back to a sanitized name extension', () => {
    expect(extensionFor({ name: 'photo.PNG', type: 'image/x-unknown' })).toBe('png');
    expect(extensionFor({ name: 'weird.tar.gz', type: '' })).toBe('gz');
  });

  it('uses "bin" when nothing usable is available', () => {
    expect(extensionFor({ name: 'noext', type: '' })).toBe('bin');
    expect(extensionFor({ name: 'too.longextension', type: '' })).toBe('bin');
  });
});

describe('buildUploadPath', () => {
  it('produces random paths that satisfy the security-rule regexes', () => {
    const a = buildUploadPath({ name: 'a.jpg', type: 'image/jpeg' });
    const b = buildUploadPath({ name: 'a.jpg', type: 'image/jpeg' });
    expect(a.path).not.toBe(b.path);
    expect(a.path).toMatch(UPLOAD_PATH_RE);
    expect(a.thumbPath).toMatch(THUMB_PATH_RE);
  });

  it('never leaks the original file name and shares one id between file and thumb', () => {
    const paths = buildUploadPath({ name: 'my secret name.jpg', type: 'image/jpeg' }, 'fixed-id');
    expect(paths).toEqual({
      id: 'fixed-id',
      path: 'uploads/fixed-id.jpg',
      thumbPath: 'uploads/thumbs/fixed-id.jpg',
    });
  });
});
