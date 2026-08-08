export const AUTH_STORAGE_KEY = "fitness-auth-token";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

interface StoredAuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAuthUser(value: unknown): value is AuthUser {
  return isRecord(value)
    && typeof value.id === "string"
    && value.id.length > 0
    && typeof value.email === "string"
    && value.email.length > 0;
}

export function parseAuthSessionResponse(value: unknown, nowSeconds = Math.floor(Date.now() / 1000)): AuthSession {
  if (!isRecord(value)) throw new Error("Supabase Auth response must be an object");

  const accessToken = value.access_token;
  const refreshToken = value.refresh_token;
  const expiresAt = typeof value.expires_at === "number"
    ? value.expires_at
    : typeof value.expires_in === "number"
      ? nowSeconds + value.expires_in
      : null;

  if (typeof accessToken !== "string" || !accessToken) throw new Error("Supabase Auth response has no access token");
  if (typeof refreshToken !== "string" || !refreshToken) throw new Error("Supabase Auth response has no refresh token");
  if (!Number.isFinite(expiresAt) || Number(expiresAt) <= nowSeconds) throw new Error("Supabase Auth response has an invalid expiry");
  if (!isAuthUser(value.user)) throw new Error("Supabase Auth response has an invalid user");

  return {
    accessToken,
    refreshToken,
    expiresAt: Number(expiresAt),
    user: value.user,
  };
}

export function saveAuthSession(session: AuthSession, storage: Storage = localStorage) {
  const stored: StoredAuthSession = {
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expires_at: session.expiresAt,
    user: session.user,
  };
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(stored));
}

export function loadAuthSession(storage: Storage = localStorage): AuthSession | null {
  const raw = storage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)) return null;
    return parseAuthSessionResponse(value, 0);
  } catch {
    return null;
  }
}

export function clearAuthSession(storage: Storage = localStorage) {
  storage.removeItem(AUTH_STORAGE_KEY);
}
