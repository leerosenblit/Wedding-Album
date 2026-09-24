import { useCallback, useState } from 'react';

/** Per-device convenience storage; every access is guarded because storage can be blocked. */
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore: private mode / blocked storage
  }
}

export function useLocalStorage(key: string, initial = ''): [string, (value: string) => void] {
  const [value, setValue] = useState(() => readLocal(key) ?? initial);
  const update = useCallback(
    (next: string) => {
      setValue(next);
      writeLocal(key, next);
    },
    [key],
  );
  return [value, update];
}
