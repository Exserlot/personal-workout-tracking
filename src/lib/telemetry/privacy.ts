import type { Breadcrumb, Event } from "@sentry/react";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const UUID_SEGMENT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const SUPABASE_SECRET_PATTERN = /\bsb_secret_[A-Za-z0-9_-]+\b/g;
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g;

export function sanitizeTelemetryText(value: string) {
  return value
    .replace(JWT_PATTERN, "[token]")
    .replace(SUPABASE_SECRET_PATTERN, "[secret]")
    .replace(EMAIL_PATTERN, "[email]")
    .replace(UUID_PATTERN, "[id]")
    .replace(NUMBER_PATTERN, "[number]");
}

export function sanitizeTelemetryUrl(value: string) {
  try {
    const url = new URL(value, typeof window === "undefined" ? "https://form.invalid" : window.location.origin);
    const segments = url.pathname.split("/").map((segment) => {
      if (!segment) return segment;
      if (UUID_SEGMENT_PATTERN.test(segment) || /^\d+$/.test(segment)) return ":id";
      return segment;
    });
    return `${url.origin === "https://form.invalid" ? "" : url.origin}${segments.join("/")}`;
  } catch {
    return "[url]";
  }
}

export function sanitizeSentryEvent<T extends Event>(event: T): T {
  const exceptions = event.exception?.values?.map((exception) => ({
    ...exception,
    value: exception.value ? sanitizeTelemetryText(exception.value) : exception.value,
  }));
  return {
    ...event,
    user: undefined,
    message: event.message ? sanitizeTelemetryText(event.message) : event.message,
    transaction: event.transaction ? sanitizeTelemetryUrl(event.transaction) : event.transaction,
    extra: undefined,
    request: event.request
      ? {
          method: event.request.method,
          url: event.request.url ? sanitizeTelemetryUrl(event.request.url) : undefined,
        }
      : undefined,
    exception: event.exception ? { ...event.exception, values: exceptions } : undefined,
    breadcrumbs: event.breadcrumbs?.map(sanitizeSentryBreadcrumb).filter((value): value is Breadcrumb => value !== null),
  } as T;
}

export function sanitizeSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === "ui.input" || breadcrumb.category === "console") return null;
  const requestUrl = typeof breadcrumb.data?.url === "string" ? sanitizeTelemetryUrl(breadcrumb.data.url) : undefined;
  return {
    ...breadcrumb,
    message: breadcrumb.message ? sanitizeTelemetryText(breadcrumb.message) : breadcrumb.message,
    data: requestUrl ? { url: requestUrl, method: breadcrumb.data?.method } : undefined,
  };
}
