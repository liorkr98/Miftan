import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Capabilities, PublicUser } from '@miftan/shared';
import { api, onSignedOut } from './client';
import { keys } from './query';

/**
 * Session state for the app.
 *
 * `restoring` matters: on a cold load the refresh cookie may still be valid, so
 * the app has to ask the server before it can know whether to show a login
 * screen. Rendering "signed out" during that beat would flash a login form at
 * somebody who is already signed in.
 */
interface AuthState {
  user: PublicUser | null;
  capabilities: Capabilities | null;
  restoring: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<PublicUser | null>(null);
  const [capabilities, setCapabilities] = React.useState<Capabilities | null>(null);
  const [restoring, setRestoring] = React.useState(true);
  const queryClient = useQueryClient();

  const clear = React.useCallback(() => {
    setUser(null);
    setCapabilities(null);
    queryClient.clear();
  }, [queryClient]);

  React.useEffect(() => {
    onSignedOut(clear);
  }, [clear]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await api.restore();
        if (!cancelled && me) {
          setUser(me.user);
          setCapabilities(me.capabilities);
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = React.useCallback(
    async (email: string, password: string) => {
      const result = await api.login({ email, password });
      setUser(result.user);
      setCapabilities(result.capabilities);
      await queryClient.invalidateQueries({ queryKey: keys.me });
    },
    [queryClient],
  );

  const signOut = React.useCallback(async () => {
    await api.logout();
    clear();
  }, [clear]);

  const value = React.useMemo(
    () => ({ user, capabilities, restoring, signIn, signOut }),
    [user, capabilities, restoring, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
