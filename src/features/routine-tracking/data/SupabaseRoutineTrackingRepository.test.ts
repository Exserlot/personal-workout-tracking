import { describe, expect, it } from "vitest";
import type { SupabaseDataClient } from "../../../lib/supabase/SupabaseRestClient";
import { SupabaseRoutineTrackingRepository, parseRoutineWeek } from "./SupabaseRoutineTrackingRepository";

const week = {
  id: "week-1", routine_id: "routine-1", routine_name: "PPL", routine_revision: 2,
  week_start: "2026-08-17", week_end: "2026-08-23", timezone: "Asia/Bangkok",
  frequency_actual: 3, frequency_target: 3, coverage_actual: 2, coverage_target: 3,
  status: "OPEN", locked_at: "2026-08-18T10:00:00Z", finalized_at: null,
  days: [{ id: "day-1", routine_day_id: "routine-day-1", template_id: "template-1", display_order: 1, day_label: "Push", template_name: "Push", completed_count: 2 }],
};

class FakeClient implements SupabaseDataClient {
  calls: Array<{ method: string; path: string; body?: unknown }> = [];
  constructor(private readonly responses: unknown[]) {}
  async request<T>(request: { method: "GET" | "POST" | "PATCH"; path: string; body?: unknown }): Promise<T> { this.calls.push(request); return this.responses.shift() as T; }
}

describe("SupabaseRoutineTrackingRepository", () => {
  it("parses independent Frequency and Coverage totals", () => {
    expect(parseRoutineWeek(week)).toMatchObject({ frequencyActual: 3, frequencyTarget: 3, coverageActual: 2, coverageTarget: 3 });
  });

  it("initializes timezone with the browser IANA value", async () => {
    const client = new FakeClient(["Asia/Bangkok"]);
    const result = await new SupabaseRoutineTrackingRepository(client).getTimezone("Asia/Bangkok");
    expect(result).toBe("Asia/Bangkok");
    expect(client.calls[0]).toMatchObject({ path: "rpc/preferences_get_or_create_timezone", body: { p_detected_timezone: "Asia/Bangkok" } });
  });
});
