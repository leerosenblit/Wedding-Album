export const EVENT_CODE_STORAGE_KEY = 'wedding:eventCode';
export const EVENT_CODE_QUERY_PARAM = 'code';

export function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

export function codeMatches(input: string, expected: string): boolean {
  return expected !== '' && normalizeCode(input) === normalizeCode(expected);
}

/**
 * Decides whether the gate is already open, without touching the DOM:
 *  - no configured code → always open;
 *  - `?code=` in the URL (QR links) → open when it matches;
 *  - previously stored code → open when it still matches (so changing the code re-locks).
 */
export function resolveInitialUnlock(
  expected: string,
  search: string,
  stored: string | null,
): { unlocked: boolean; fromUrl: boolean } {
  if (!expected) return { unlocked: true, fromUrl: false };
  const fromUrl = new URLSearchParams(search).get(EVENT_CODE_QUERY_PARAM);
  if (fromUrl !== null && codeMatches(fromUrl, expected)) return { unlocked: true, fromUrl: true };
  if (stored !== null && codeMatches(stored, expected)) return { unlocked: true, fromUrl: false };
  return { unlocked: false, fromUrl: false };
}
