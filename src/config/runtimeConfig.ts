export type AppEnvironment = "local" | "staging" | "production";

export interface RuntimeConfig {
  environment: AppEnvironment;
  version: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  sentryDsn: string | null;
}

export interface RuntimeConfigState {
  config: RuntimeConfig | null;
  error: string | null;
}

type EnvironmentSource = Record<string, string | boolean | undefined>;

function parseEnvironment(value: unknown): AppEnvironment {
  if (value === undefined || value === "" || value === "local") return "local";
  if (value === "staging" || value === "production") return value;
  throw new Error("VITE_APP_ENV ต้องเป็น local, staging หรือ production");
}

function parseUrl(value: string, label: string, requireHttps: boolean) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} ต้องเป็น URL ที่ถูกต้อง`);
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error(`${label} ต้องใช้ HTTP หรือ HTTPS`);
  if (requireHttps && parsed.protocol !== "https:") throw new Error(`${label} ต้องใช้ HTTPS นอก local`);
  return parsed.toString().replace(/\/$/, "");
}

function jwtRole(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const payload = JSON.parse(atob(base64)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function assertBrowserSafeSupabaseKey(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error("Supabase publishable key ห้ามว่าง");
  if (normalized.startsWith("sb_secret_") || /service[_-]?role/i.test(normalized) || jwtRole(normalized) === "service_role") {
    throw new Error("ห้ามใช้ Supabase Secret หรือ service_role key ใน browser");
  }
  return normalized;
}

export function resolveRuntimeConfig(source: EnvironmentSource): RuntimeConfigState {
  try {
    const environment = parseEnvironment(source.VITE_APP_ENV);
    const rawUrl = typeof source.VITE_SUPABASE_URL === "string" ? source.VITE_SUPABASE_URL.trim() : "";
    const rawKey = typeof source.VITE_SUPABASE_PUBLISHABLE_KEY === "string" && source.VITE_SUPABASE_PUBLISHABLE_KEY.trim()
      ? source.VITE_SUPABASE_PUBLISHABLE_KEY
      : typeof source.VITE_SUPABASE_ANON_KEY === "string"
        ? source.VITE_SUPABASE_ANON_KEY
        : "";
    if (!rawUrl || !rawKey) {
      return { config: null, error: "ยังไม่ได้ตั้งค่า Supabase โปรดตรวจสอบ environment variables" };
    }

    const requireHttps = environment !== "local";
    const rawSentryDsn = typeof source.VITE_SENTRY_DSN === "string" ? source.VITE_SENTRY_DSN.trim() : "";
    const config: RuntimeConfig = {
      environment,
      version: typeof source.VITE_APP_VERSION === "string" && source.VITE_APP_VERSION.trim()
        ? source.VITE_APP_VERSION.trim()
        : "dev",
      supabaseUrl: parseUrl(rawUrl, "VITE_SUPABASE_URL", requireHttps),
      supabasePublishableKey: assertBrowserSafeSupabaseKey(rawKey),
      sentryDsn: rawSentryDsn ? parseUrl(rawSentryDsn, "VITE_SENTRY_DSN", requireHttps) : null,
    };
    return { config, error: null };
  } catch (error) {
    return { config: null, error: error instanceof Error ? error.message : "Environment configuration ไม่ถูกต้อง" };
  }
}

export const runtimeConfigState = resolveRuntimeConfig(import.meta.env);
