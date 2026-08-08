export interface SupabaseRequest {
  method: "GET" | "POST" | "PATCH";
  path: string;
  body?: unknown;
}

export interface SupabaseDataClient {
  request<T>(request: SupabaseRequest): Promise<T>;
}

export class SupabaseRequestError extends Error {
  constructor(public readonly status: number, public readonly payload: unknown) {
    super("Supabase request failed");
    this.name = "SupabaseRequestError";
  }
}

export interface SupabaseRestClientOptions {
  url: string;
  anonKey: string;
  fetchImpl?: typeof fetch;
  accessToken?: () => string | null;
}

function readSupabaseAccessToken() {
  if (typeof localStorage === "undefined") return null;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.endsWith("-auth-token")) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null") as { access_token?: unknown } | null;
      if (typeof value?.access_token === "string" && value.access_token) return value.access_token;
    } catch {
      // Ignore unrelated localStorage values.
    }
  }
  return null;
}

export class SupabaseRestClient implements SupabaseDataClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SupabaseRestClientOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async request<T>({ method, path, body }: SupabaseRequest): Promise<T> {
    const accessToken = this.options.accessToken?.() ?? readSupabaseAccessToken();
    const headers = new Headers({
      apikey: this.options.anonKey,
      Accept: "application/json",
      Prefer: "return=representation",
    });
    if (body !== undefined) headers.set("Content-Type", "application/json");
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    } else if (this.options.anonKey.split(".").length === 3) {
      headers.set("Authorization", `Bearer ${this.options.anonKey}`);
    }

    const response = await this.fetchImpl(`${this.options.url.replace(/\/$/, "")}/rest/v1/${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = text;
      }
    }
    if (!response.ok) throw new SupabaseRequestError(response.status, payload);
    return payload as T;
  }
}
