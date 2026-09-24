import { useState, type FormEvent, type ReactNode } from 'react';
import { eventConfig } from '../config/event';
import { readLocal, writeLocal } from '../hooks/useLocalStorage';
import {
  codeMatches,
  EVENT_CODE_QUERY_PARAM,
  EVENT_CODE_STORAGE_KEY,
  normalizeCode,
  resolveInitialUnlock,
} from '../lib/eventCode';

function initialUnlock(): boolean {
  const { unlocked, fromUrl } = resolveInitialUnlock(
    eventConfig.eventCode,
    window.location.search,
    readLocal(EVENT_CODE_STORAGE_KEY),
  );
  if (unlocked && eventConfig.eventCode) {
    writeLocal(EVENT_CODE_STORAGE_KEY, normalizeCode(eventConfig.eventCode));
  }
  if (fromUrl) {
    // Keep the address bar clean once the code has been consumed.
    const url = new URL(window.location.href);
    url.searchParams.delete(EVENT_CODE_QUERY_PARAM);
    window.history.replaceState(null, '', url);
  }
  return unlocked;
}

/**
 * UX gate: guests coming from the QR code never see it. It is not a security
 * boundary; Firebase rules and App Check are.
 */
export function EventCodeGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(initialUnlock);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (unlocked) return <>{children}</>;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (codeMatches(value, eventConfig.eventCode)) {
      writeLocal(EVENT_CODE_STORAGE_KEY, normalizeCode(eventConfig.eventCode));
      setUnlocked(true);
      return;
    }
    setError('הקוד לא נכון. הוא מופיע על הכרטיס שעל השולחן 🙂');
  };

  return (
    <section className="card card--center gate">
      <h2>ברוכים הבאים!</h2>
      <p className="lead">הקלידו את קוד האירוע שמופיע על הכרטיס כדי להיכנס לאלבום.</p>
      <form className="gate__form" onSubmit={onSubmit}>
        <label className="visually-hidden" htmlFor="event-code">
          קוד האירוע
        </label>
        <input
          id="event-code"
          className="input input--code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? 'event-code-error' : undefined}
        />
        <button type="submit" className="btn btn--primary" disabled={value.trim() === ''}>
          כניסה
        </button>
      </form>
      {error && (
        <p id="event-code-error" className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
