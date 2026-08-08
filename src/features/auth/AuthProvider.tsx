import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthStatus } from "./AuthContext";
import { clearAuthSession, loadAuthSession, saveAuthSession, type AuthSession } from "./authSession";
import { createSupabaseAuthClient, type AuthClient } from "./SupabaseAuthClient";

const REFRESH_MARGIN_SECONDS = 60;

interface AuthProviderProps {
  children: ReactNode;
  client?: AuthClient;
}

export function AuthProvider({ children, client: providedClient }: AuthProviderProps) {
  const client = useMemo(() => providedClient ?? createSupabaseAuthClient(), [providedClient]);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);

  const acceptSession = useCallback((nextSession: AuthSession) => {
    saveAuthSession(nextSession);
    setSession(nextSession);
    setStatus("authenticated");
  }, []);

  const expireSession = useCallback(() => {
    clearAuthSession();
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    let active = true;
    const stored = loadAuthSession();
    if (!stored) {
      setStatus("unauthenticated");
      return () => { active = false; };
    }

    const now = Math.floor(Date.now() / 1000);
    if (stored.expiresAt > now + REFRESH_MARGIN_SECONDS) {
      setSession(stored);
      setStatus("authenticated");
      return () => { active = false; };
    }

    void client.refresh(stored.refreshToken)
      .then((refreshed) => {
        if (active) acceptSession(refreshed);
      })
      .catch(() => {
        if (active) expireSession();
      });
    return () => { active = false; };
  }, [acceptSession, client, expireSession]);

  useEffect(() => {
    if (!session) return undefined;
    const delay = Math.max(
      1_000,
      (session.expiresAt - Math.floor(Date.now() / 1000) - REFRESH_MARGIN_SECONDS) * 1_000,
    );
    const timer = window.setTimeout(() => {
      void client.refresh(session.refreshToken)
        .then(acceptSession)
        .catch(expireSession);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [acceptSession, client, expireSession, session]);

  const signIn = useCallback(async (email: string, password: string) => {
    acceptSession(await client.signIn(email.trim(), password));
  }, [acceptSession, client]);

  const signOut = useCallback(async () => {
    const accessToken = session?.accessToken;
    try {
      if (accessToken) await client.signOut(accessToken);
    } catch {
      // Local sign-out must still complete if Supabase is temporarily unavailable.
    } finally {
      expireSession();
    }
  }, [client, expireSession, session]);

  const value = useMemo(() => ({ status, session, signIn, signOut }), [session, signIn, signOut, status]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
