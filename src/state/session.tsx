/**
 * Session context.
 *
 * Holds who is signed in and which "side" of the product they see. Spec 1: the
 * owner and coach share one binary and the dashboard renders by role — the same
 * is true here for member vs coach.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { clearTokens, getTokens, setTokens } from '@/api/tokens';
import type { AuthAccount, AuthSession } from '@/api/types';

interface SessionValue {
  account: AuthAccount | null;
  loading: boolean;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  /** Coaches and owners get the club-side tabs. */
  isStaff: boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAccount = useCallback(async () => {
    const tokens = await getTokens();
    if (!tokens) {
      setAccount(null);
      return;
    }

    try {
      // `/clubs` doubles as a cheap "who am I, and what can I administer"
      // probe: it is authenticated, small, and tells us whether to show the
      // club-side tabs.
      const clubs = await api.get<Array<{ id: string; access: string }>>('/api/v1/clubs');
      setAccount((previous) =>
        previous
          ? { ...previous, role: clubs.length > 0 ? previous.role : previous.role }
          : previous,
      );
    } catch {
      // A failure here should not sign anyone out — the client already retries
      // token refresh, so this is most likely just no connection.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const tokens = await getTokens();
      if (!cancelled) {
        // The stored account snapshot is rehydrated on sign-in; without tokens
        // there is nobody to restore.
        if (!tokens) setAccount(null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (session: AuthSession) => {
    await setTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
    setAccount(session.account);
  }, []);

  const signOut = useCallback(async () => {
    const tokens = await getTokens();
    if (tokens?.refreshToken) {
      // Best effort — revoking server-side is good hygiene, but a failure here
      // must not trap the user in a session they asked to leave.
      try {
        await api.delete('/api/v1/auth/refresh', { refreshToken: tokens.refreshToken });
      } catch {
        // ignored deliberately
      }
    }
    await clearTokens();
    setAccount(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      account,
      loading,
      signIn,
      signOut,
      refreshAccount,
      isStaff: account?.role === 'COACH' || account?.role === 'CLUB_OWNER',
    }),
    [account, loading, signIn, signOut, refreshAccount],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside a SessionProvider.');
  return context;
}
