import { parseAuthSessionResponse, type AuthSession } from "./authSession";
import { runtimeConfigState } from "../../config/runtimeConfig";
import { telemetry } from "../../lib/telemetry/telemetry";

export type AuthErrorCode = "configuration" | "invalid-credentials" | "network" | "unknown";

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthClient {
  signIn(email: string, password: string): Promise<AuthSession>;
  refresh(refreshToken: string): Promise<AuthSession>;
  signOut(accessToken: string): Promise<void>;
}

interface SupabaseAuthClientOptions {
  url: string;
  publishableKey: string;
  fetchImpl?: typeof fetch;
}

function errorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Supabase Auth request failed";
  const record = payload as Record<string, unknown>;
  const message = record.msg ?? record.message ?? record.error_description ?? record.error;
  return typeof message === "string" ? message : "Supabase Auth request failed";
}

export class SupabaseAuthClient implements AuthClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SupabaseAuthClientOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private async request(path: string, body: unknown, accessToken?: string) {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.url.replace(/\/$/, "")}/auth/v1/${path}`, {
        method: "POST",
        headers: {
          apikey: this.options.publishableKey,
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      telemetry.captureEvent("auth_request_failed", { category: "network", operation: path.split("?")[0] });
      throw new AuthError("network", "เชื่อมต่อ Supabase ไม่สำเร็จ โปรดตรวจสอบว่า local services กำลังทำงาน");
    }

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const message = errorMessage(payload);
      const invalidCredentials = response.status === 400 && message.toLowerCase().includes("invalid login credentials");
      telemetry.captureEvent("auth_request_failed", {
        category: invalidCredentials ? "invalid-credentials" : "server",
        operation: path.split("?")[0],
        status: response.status,
      });
      throw new AuthError(
        invalidCredentials ? "invalid-credentials" : "unknown",
        invalidCredentials ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : "เข้าสู่ระบบไม่สำเร็จ โปรดลองอีกครั้ง",
      );
    }
    return payload;
  }

  async signIn(email: string, password: string) {
    const payload = await this.request("token?grant_type=password", { email, password });
    try {
      return parseAuthSessionResponse(payload);
    } catch {
      throw new AuthError("unknown", "Supabase ส่งข้อมูล session ที่ไม่ถูกต้อง");
    }
  }

  async refresh(refreshToken: string) {
    const payload = await this.request("token?grant_type=refresh_token", { refresh_token: refreshToken });
    try {
      return parseAuthSessionResponse(payload);
    } catch {
      throw new AuthError("unknown", "Supabase ส่งข้อมูล session ที่ไม่ถูกต้อง");
    }
  }

  async signOut(accessToken: string) {
    await this.request("logout", {}, accessToken);
  }
}

class UnconfiguredAuthClient implements AuthClient {
  private error() {
    return new AuthError("configuration", "ยังไม่ได้ตั้งค่า Supabase ใน .env.local");
  }

  signIn(): Promise<AuthSession> { return Promise.reject(this.error()); }
  refresh(): Promise<AuthSession> { return Promise.reject(this.error()); }
  signOut(): Promise<void> { return Promise.reject(this.error()); }
}

export function createSupabaseAuthClient(): AuthClient {
  const config = runtimeConfigState.config;
  if (!config) return new UnconfiguredAuthClient();
  return new SupabaseAuthClient({ url: config.supabaseUrl, publishableKey: config.supabasePublishableKey });
}
