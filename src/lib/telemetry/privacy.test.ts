import { describe, expect, it } from "vitest";
import { sanitizeSentryBreadcrumb, sanitizeSentryEvent, sanitizeTelemetryText, sanitizeTelemetryUrl } from "./privacy";

describe("telemetry privacy", () => {
  it("removes health-adjacent values and identifiers from text", () => {
    const text = sanitizeTelemetryText("user@example.com session 28309c7a-7172-43f4-8108-9df2d76622bf lifted 72.5 reps 10");
    expect(text).not.toContain("user@example.com");
    expect(text).not.toContain("28309c7a");
    expect(text).not.toContain("72.5");
    expect(text).toContain("[email]");
  });

  it("drops query strings and replaces route identifiers", () => {
    expect(sanitizeTelemetryUrl("https://form.test/history/28309c7a-7172-43f4-8108-9df2d76622bf?token=secret"))
      .toBe("https://form.test/history/:id");
  });

  it("removes input and console breadcrumbs", () => {
    expect(sanitizeSentryBreadcrumb({ category: "ui.input", message: "72.5" })).toBeNull();
    expect(sanitizeSentryBreadcrumb({ category: "console", message: "secret" })).toBeNull();
  });

  it("removes user, request data, and arbitrary extras from events", () => {
    const sanitized = sanitizeSentryEvent({
      user: { email: "owner@example.com" },
      extra: { workout: "Bench Press 72.5" },
      transaction: "/history/28309c7a-7172-43f4-8108-9df2d76622bf?set=1",
      request: { url: "https://form.test/history/28309c7a-7172-43f4-8108-9df2d76622bf?set=1", data: "private" },
    });
    expect(sanitized.user).toBeUndefined();
    expect(sanitized.extra).toBeUndefined();
    expect(sanitized.transaction).toBe("/history/:id");
    expect(sanitized.request).toEqual({ method: undefined, url: "https://form.test/history/:id" });
  });
});
