import { describe, expect, it, vi } from "vitest";
import { SupabaseAuthClient } from "./SupabaseAuthClient";

function sessionResponse() {
  return new Response(JSON.stringify({
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3_600,
    user: { id: "owner-id", email: "owner@example.test" },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("SupabaseAuthClient", () => {
  it("signs in with the publishable key and password grant", async () => {
    const fetchImpl = vi.fn(async () => sessionResponse());
    const client = new SupabaseAuthClient({
      url: "http://127.0.0.1:54321",
      publishableKey: "sb_publishable_test",
      fetchImpl,
    });

    const session = await client.signIn("owner@example.test", "password123");
    expect(session.user.email).toBe("owner@example.test");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/auth/v1/token?grant_type=password",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ apikey: "sb_publishable_test" }),
        body: JSON.stringify({ email: "owner@example.test", password: "password123" }),
      }),
    );
  });

  it("uses the user JWT when signing out", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const client = new SupabaseAuthClient({
      url: "http://127.0.0.1:54321/",
      publishableKey: "sb_publishable_test",
      fetchImpl,
    });

    await client.signOut("user-jwt");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/auth/v1/logout",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer user-jwt" }),
      }),
    );
  });

  it("maps invalid credentials to a safe user-facing error", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ error_code: "invalid_credentials", msg: "Invalid login credentials" }),
      { status: 400 },
    ));
    const client = new SupabaseAuthClient({
      url: "http://127.0.0.1:54321",
      publishableKey: "sb_publishable_test",
      fetchImpl,
    });

    await expect(client.signIn("wrong@example.test", "wrong-password")).rejects.toMatchObject({
      code: "invalid-credentials",
      message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    });
  });

  it("distinguishes a network failure", async () => {
    const client = new SupabaseAuthClient({
      url: "http://127.0.0.1:54321",
      publishableKey: "sb_publishable_test",
      fetchImpl: vi.fn(async () => { throw new TypeError("fetch failed"); }),
    });

    await expect(client.signIn("owner@example.test", "password123")).rejects.toMatchObject({
      code: "network",
    });
  });
});
