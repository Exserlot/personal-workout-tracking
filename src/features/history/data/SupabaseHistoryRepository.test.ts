import { describe, expect, it } from "vitest";
import { SupabaseRequestError, type SupabaseDataClient } from "../../../lib/supabase/SupabaseRestClient";
import { SupabaseHistoryRepository } from "./SupabaseHistoryRepository";

class FakeClient implements SupabaseDataClient {
  requests: Array<{ path: string; body?: unknown }> = [];
  constructor(private readonly responses: unknown[]) {}
  async request<T>(request: { method: "GET" | "POST" | "PATCH"; path: string; body?: unknown }): Promise<T> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (response instanceof Error) throw response;
    return response as T;
  }
}

const row = {
  session_id: "session-1", label: "Push A", source_type: "PLANNED", completed_at: "2026-08-10T11:00:00Z", duration_seconds: 3600, exercise_count: 2, completed_working_set_count: 6, volume_kg: 420, edited_at: null,
};

describe("SupabaseHistoryRepository", () => {
  it("maps cursor pages and sends the cursor to the RPC", async () => {
    const client = new FakeClient([[row, { ...row, session_id: "session-2", completed_at: "2026-08-09T11:00:00Z" }, { ...row, session_id: "session-3" }]]);
    const repository = new SupabaseHistoryRepository(client);
    const page = await repository.listSessions({ from: null, to: null, cursor: { completedAt: "2026-08-11T00:00:00Z", sessionId: "cursor" }, limit: 20 });
    expect(page.items).toHaveLength(3);
    expect(client.requests[0].body).toMatchObject({ p_cursor_id: "cursor", p_limit: 20 });
  });

  it("maps revision conflicts and preserves the mutation request shape", async () => {
    const client = new FakeClient([new SupabaseRequestError(409, { code: "40001", message: "revision_conflict" })]);
    const repository = new SupabaseHistoryRepository(client);
    await expect(repository.updateSession({ operationId: "operation-1", sessionId: "session-1", expectedVersion: 2, draft: { notes: "", exercises: [] } })).rejects.toMatchObject({ code: "conflict" });
    expect(client.requests[0].path).toBe("rpc/history_update_session");
    expect(client.requests[0].body).toMatchObject({ p_operation_id: "operation-1", p_session_id: "session-1", p_expected_version: 2 });
  });
});
