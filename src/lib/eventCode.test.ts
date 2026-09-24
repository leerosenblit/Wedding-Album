import { describe, expect, it } from 'vitest';
import { codeMatches, resolveInitialUnlock } from './eventCode';

describe('codeMatches', () => {
  it('ignores case and surrounding whitespace', () => {
    expect(codeMatches('  Roni2026 ', 'roni2026')).toBe(true);
  });

  it('never matches when no code is configured', () => {
    expect(codeMatches('', '')).toBe(false);
  });
});

describe('resolveInitialUnlock', () => {
  it('is open when the gate is not configured', () => {
    expect(resolveInitialUnlock('', '?code=x', null)).toEqual({ unlocked: true, fromUrl: false });
  });

  it('opens from a matching QR link', () => {
    expect(resolveInitialUnlock('abc', '?code=ABC', null)).toEqual({
      unlocked: true,
      fromUrl: true,
    });
  });

  it('opens from a previously stored code', () => {
    expect(resolveInitialUnlock('abc', '', 'abc')).toEqual({ unlocked: true, fromUrl: false });
  });

  it('re-locks when the configured code changed', () => {
    expect(resolveInitialUnlock('new', '', 'old')).toEqual({ unlocked: false, fromUrl: false });
  });

  it('stays locked on a wrong URL code', () => {
    expect(resolveInitialUnlock('abc', '?code=nope', null).unlocked).toBe(false);
  });
});
