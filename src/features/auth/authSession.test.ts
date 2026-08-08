import { describe, expect, it } from "vitest";
import {
  AUTH_STORAGE_KEY,
  clearAuthSession,
  loadAuthSession,
  parseAuthSessionResponse,
  saveAuthSession,
  type AuthSession,
} from "./authSession";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const session: AuthSession = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: 4_600,
  user: { id: "owner-id", email: "owner@example.test" },
};

describe("auth session", () => {
  it("validates and maps a Supabase password response", () => {
    expect(parseAuthSessionResponse({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3_600,
      user: { id: "owner-id", email: "owner@example.test" },
    }, 1_000)).toEqual(session);
  });

  it("rejects malformed responses before they reach application state", () => {
    expect(() => parseAuthSessionResponse({
      access_token: "access-token",
      expires_in: 3_600,
      user: { id: "owner-id", email: "owner@example.test" },
    }, 1_000)).toThrow("refresh token");
  });

  it("persists in the Supabase-compatible local storage shape", () => {
    const storage = new MemoryStorage();
    saveAuthSession(session, storage);

    expect(storage.getItem(AUTH_STORAGE_KEY)).toContain("\"access_token\":\"access-token\"");
    expect(loadAuthSession(storage)).toEqual(session);

    clearAuthSession(storage);
    expect(loadAuthSession(storage)).toBeNull();
  });

  it("ignores corrupt stored sessions", () => {
    const storage = new MemoryStorage();
    storage.setItem(AUTH_STORAGE_KEY, "not-json");
    expect(loadAuthSession(storage)).toBeNull();
  });
});
