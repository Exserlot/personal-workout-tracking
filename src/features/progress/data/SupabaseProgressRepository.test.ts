import { describe, expect, it } from "vitest";
import type { SupabaseDataClient, SupabaseRequest } from "../../../lib/supabase/SupabaseRestClient";
import { SupabaseProgressRepository } from "./SupabaseProgressRepository";

class FakeClient implements SupabaseDataClient {
  requests: SupabaseRequest[] = [];
  constructor(private readonly responses: unknown[]) {}
  async request<T>(request: SupabaseRequest): Promise<T> {
    this.requests.push(request);
    return this.responses.shift() as T;
  }
}

const record = { kind: "BEST_WEIGHT", exercise_id: "exercise-1", exercise_name: "Bench Press", session_id: "session-1", set_id: "set-1", achieved_at: "2026-08-15T00:00:00.000Z", weight_kg: "80", reps: 5, estimated_1rm_kg: "93.3333", previous_value: "75" };

describe("SupabaseProgressRepository", () => {
  it("validates and maps overview responses", async () => {
    const client = new FakeClient([{ source_revision: "4", stats: { tracked_exercise_count: 1, recent_session_count: 1, recent_volume_kg: "400", recent_pr_count: 1 }, recent_records: [record], featured_exercise: null }]);
    const result = await new SupabaseProgressRepository(client).getOverview();
    expect(result.sourceRevision).toBe(4);
    expect(result.recentRecords[0]?.weightKg).toBe(80);
    expect(client.requests[0]?.path).toBe("rpc/progress_get_overview");
  });

  it("sends cursor and search to the exercise list RPC", async () => {
    const client = new FakeClient([{ source_revision: 1, items: [], next_cursor: null }]);
    await new SupabaseProgressRepository(client).listExercises({ search: "bench", cursor: { lastTrainedAt: "2026-08-15T00:00:00.000Z", exerciseId: "exercise-1" }, limit: 20 });
    expect(client.requests[0]?.body).toMatchObject({ p_search: "bench", p_cursor_exercise_id: "exercise-1", p_limit: 20 });
  });

  it("rejects malformed nested data", async () => {
    const client = new FakeClient([{ source_revision: 1, stats: {}, recent_records: [], featured_exercise: null }]);
    await expect(new SupabaseProgressRepository(client).getOverview()).rejects.toMatchObject({ code: "unknown" });
  });

  it("returns null for an unknown Exercise detail", async () => {
    const client = new FakeClient([null]);
    await expect(new SupabaseProgressRepository(client).getExerciseDetail({ exerciseId: "missing", from: null, to: null, pointLimit: 250 })).resolves.toBeNull();
  });
});
