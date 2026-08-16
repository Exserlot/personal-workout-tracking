import { describe, expect, it } from "vitest";
import { assertBrowserSafeSupabaseKey, resolveRuntimeConfig } from "./runtimeConfig";

function jwtWithRole(role: string) {
  const payload = btoa(JSON.stringify({ role })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `header.${payload}.signature`;
}

describe("runtime config", () => {
  it("loads a local browser-safe configuration", () => {
    const state = resolveRuntimeConfig({
      VITE_APP_ENV: "local",
      VITE_APP_VERSION: "test-release",
      VITE_SUPABASE_URL: "http://127.0.0.1:54321/",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(state.error).toBeNull();
    expect(state.config).toMatchObject({
      environment: "local",
      version: "test-release",
      supabaseUrl: "http://127.0.0.1:54321",
      supabasePublishableKey: "sb_publishable_test",
    });
  });

  it("requires HTTPS in staging and production", () => {
    const state = resolveRuntimeConfig({
      VITE_APP_ENV: "production",
      VITE_SUPABASE_URL: "http://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(state.config).toBeNull();
    expect(state.error).toContain("HTTPS");
  });

  it("rejects secret and service-role keys", () => {
    expect(() => assertBrowserSafeSupabaseKey("sb_secret_private")).toThrow(/ห้ามใช้/);
    expect(() => assertBrowserSafeSupabaseKey(jwtWithRole("service_role"))).toThrow(/service_role/);
    expect(assertBrowserSafeSupabaseKey(jwtWithRole("anon"))).toContain(".");
  });

  it("returns an unconfigured state when required values are absent", () => {
    expect(resolveRuntimeConfig({}).config).toBeNull();
  });
});
