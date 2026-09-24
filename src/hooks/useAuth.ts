import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';

export type AuthStatus = 'loading' | 'ready' | 'error';

export interface AuthState {
  user: User | null;
  status: AuthStatus;
  error?: string;
}

/**
 * Keeps a Firebase session alive. Guests get an anonymous user automatically;
 * if an admin signs out, a fresh anonymous session is created again.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, status: 'loading' });
  const signingIn = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        signingIn.current = false;
        setState({ user, status: 'ready' });
        return;
      }
      if (signingIn.current) return;
      signingIn.current = true;
      setState({ user: null, status: 'loading' });
      signInAnonymously(auth).catch((error: unknown) => {
        signingIn.current = false;
        setState({
          user: null,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });
    return unsubscribe;
  }, []);

  return state;
}
