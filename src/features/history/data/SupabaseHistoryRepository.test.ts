import { describe, expect, it } from "vitest";
import { SupabaseRequestError, type SupabaseDataClient } from "../../../lib/supabase/SupabaseRestClient";
import { SupabaseHistoryRepository, historyEditablePayload } from "./SupabaseHistoryRepository";

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

function detailRow(version: number) {
  return {
    id: "session-1", owner_device_id: "device-1", source_type: "AD_HOC", source_routine_id: null, source_routine_day_id: null, source_template_id: null, source_routine_revision: null, source_template_revision: null, routine_name_snapshot: null, day_label_snapshot: null, template_name_snapshot: "Push A", status: "COMPLETED", started_at: "2026-08-10T10:00:00Z", completed_at: "2026-08-10T11:00:00Z", notes: "", version, edited_at: null, deleted_at: null, workout_session_exercises: [],
  };
}

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

  it("serializes only editable history fields", () => {
    const payload = historyEditablePayload({
      operationId: "operation-1", sessionId: "session-1", expectedVersion: 2,
      draft: { notes: "note", exercises: [{
        id: "exercise-1", sourceTemplateExerciseId: "template-exercise", sourceExerciseId: "exercise-source", sequence: 1, name: "Old snapshot", equipmentCode: "barbell", muscles: [], notes: "cue", sets: [{
          id: "set-1", sourceTemplateSetId: "template-set", sequence: 1, kind: "WORKING", isToFailure: true, targetRepsMin: 8, targetRepsMax: 10, targetWeight: { value: 100, unit: "KG", kg: 100 }, targetEffort: { metric: "RPE", value: 8 }, targetRestSeconds: 90, actualWeight: { value: 70, unit: "KG", kg: 70 }, actualReps: 8, actualEffort: null, actualRestSeconds: 60, status: "COMPLETED", completedAt: "2026-08-10T10:00:00Z", notes: "set note",
        }],
      }] },
    });
    const serialized = payload.exercises[0].sets[0] as Record<string, unknown>;
    expect(serialized).not.toHaveProperty("target_weight_kg");
    expect(serialized).not.toHaveProperty("completed_at");
    expect(serialized).toMatchObject({ actual_weight_value: 70, actual_weight_unit: "KG", status: "COMPLETED" });
  });

  it("rejects a result-version mismatch instead of acknowledging an unverified session", async () => {
    const client = new FakeClient([{ result_version: 5 }]);
    const repository = new SupabaseHistoryRepository(client);
    await expect(repository.updateSession({ operationId: "operation-version", sessionId: "session-1", expectedVersion: 1, draft: { notes: "", exercises: [] } })).rejects.toMatchObject({ code: "server" });
    expect(client.requests).toHaveLength(1);
  });

  it("keeps the same operation id when canonical reload fails after a mutation", async () => {
    const client = new FakeClient([{ result_version: 2 }, [], { result_version: 2 }, []]);
    const repository = new SupabaseHistoryRepository(client);
    const input = { operationId: "operation-retry", sessionId: "session-1", expectedVersion: 1, draft: { notes: "retry", exercises: [] } };
    await expect(repository.updateSession(input)).rejects.toMatchObject({ code: "server" });
    await expect(repository.updateSession(input)).rejects.toMatchObject({ code: "server" });
    const mutationRequests = client.requests.filter((request) => request.path === "rpc/history_update_session");
    expect(mutationRequests).toHaveLength(2);
    expect((mutationRequests[0].body as Record<string, unknown>).p_operation_id).toBe("operation-retry");
    expect((mutationRequests[1].body as Record<string, unknown>).p_operation_id).toBe("operation-retry");
  });

  it("maps a newer canonical session after receipt retry to conflict recovery", async () => {
    const client = new FakeClient([{ result_version: 2 }, [detailRow(3)]]);
    const repository = new SupabaseHistoryRepository(client);

    await expect(repository.updateSession({
      operationId: "operation-newer-session",
      sessionId: "session-1",
      expectedVersion: 1,
      draft: { notes: "retry", exercises: [] },
    })).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects a delete result-version mismatch before removing cached history", async () => {
    const client = new FakeClient([{ result_version: 5 }]);
    const repository = new SupabaseHistoryRepository(client);

    await expect(repository.softDeleteSession({
      operationId: "delete-version",
      sessionId: "session-1",
      expectedVersion: 1,
    })).rejects.toMatchObject({ code: "server" });

    expect(client.requests).toHaveLength(1);
    expect(client.requests[0].path).toBe("rpc/history_soft_delete_session");
  });
});
