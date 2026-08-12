import { describe, expect, it } from "vitest";
import { SupabaseRequestError, type SupabaseDataClient, type SupabaseRequest } from "../../../lib/supabase/SupabaseRestClient";
import type { OfflineSetCommand } from "../domain/workout";
import { SupabaseWorkoutRepository } from "./WorkoutRepository";

function sessionRow() {
  return {
    id: "session-1",
    owner_device_id: "device-1",
    source_type: "PLANNED",
    source_routine_id: "routine-1",
    source_routine_day_id: "day-1",
    source_template_id: "template-1",
    source_routine_revision: 1,
    source_template_revision: 1,
    routine_name_snapshot: "A B C",
    day_label_snapshot: "Day A",
    template_name_snapshot: "Push A",
    status: "ACTIVE",
    started_at: "2026-08-09T10:00:00.000Z",
    completed_at: null,
    notes: "",
    version: 1,
    edited_at: null,
    workout_session_exercises: [{
      id: "session-exercise-1",
      source_template_exercise_id: "template-exercise-1",
      source_exercise_id: "exercise-1",
      sequence_no: 1,
      exercise_name_snapshot: "Barbell Bench Press",
      equipment_code_snapshot: "barbell",
      notes: "",
      workout_session_exercise_muscles: [{ role: "PRIMARY", sequence_no: 1, muscle_name_snapshot: "Chest" }],
      workout_session_sets: [{
        id: "session-set-1",
        source_template_set_id: "template-set-1",
        sequence_no: 1,
        set_kind_code: "WORKING",
        is_to_failure: false,
        target_reps_min: 8,
        target_reps_max: 10,
        target_weight_value: 70,
        target_weight_unit: "KG",
        target_weight_kg: 70,
        target_effort_metric: "RPE",
        target_effort_value: 8,
        target_rest_seconds: 90,
        actual_weight_value: null,
        actual_weight_unit: null,
        actual_weight_kg: null,
        actual_reps: null,
        actual_effort_metric: null,
        actual_effort_value: null,
        actual_rest_seconds: null,
        status: "PENDING",
        completed_at: null,
        notes: "",
      }],
    }],
  };
}

describe("SupabaseWorkoutRepository contract", () => {
  it("validates and maps a nested session response", async () => {
    const client: SupabaseDataClient = { request: async <T>() => [sessionRow()] as T };
    const session = await new SupabaseWorkoutRepository(client).getActiveSession("device-1");
    expect(session).toMatchObject({ id: "session-1", status: "ACTIVE", exercises: [{ name: "Barbell Bench Press", sets: [{ targetWeight: { value: 70, unit: "KG", kg: 70 } }] }] });
  });

  it("maps active-session and malformed-response errors", async () => {
    const conflictClient: SupabaseDataClient = {
      request: <T>() => Promise.reject<T>(new SupabaseRequestError(409, { code: "23505", message: "active_session_exists" })),
    };
    await expect(new SupabaseWorkoutRepository(conflictClient).startAdHoc({ sessionId: "session-2", deviceId: "device-1", templateId: null })).rejects.toMatchObject({ code: "active-exists" });

    const malformedClient: SupabaseDataClient = { request: async <T>() => [{}] as T };
    await expect(new SupabaseWorkoutRepository(malformedClient).getActiveSession("device-1")).rejects.toMatchObject({ code: "unknown" });
  });

  it("sends a stable operation ID and validates the acknowledged Session", async () => {
    const requests: Array<{ path: string; body?: unknown }> = [];
    const client: SupabaseDataClient = {
      request: async <T>(request: SupabaseRequest) => {
        requests.push(request);
        if (request.path.startsWith("rpc/workout_apply_command_idempotent")) return 2 as T;
        return [{ ...sessionRow(), version: 2 }] as T;
      },
    };
    const session = await new SupabaseWorkoutRepository(client).applyIdempotentCommand({
      operationId: "operation-1",
      sessionId: "session-1",
      deviceId: "device-1",
      expectedVersion: 1,
      command: {
        action: "complete_set",
        setId: "session-set-1",
        actualWeight: { value: 72.5, unit: "KG", kg: 72.5 },
        actualReps: 8,
        actualEffort: { metric: "RPE", value: 8.5 },
      },
    });
    expect(session.version).toBe(2);
    expect(requests[0]).toMatchObject({ path: "rpc/workout_apply_command_idempotent", body: { p_operation_id: "operation-1", p_expected_version: 1 } });
  });

  it.each<[string, OfflineSetCommand, Record<string, unknown>]>([
    ["edit", { action: "edit_set", setId: "session-set-1", actualWeight: { value: 75, unit: "KG", kg: 75 }, actualReps: 9, actualEffort: { metric: "RIR", value: 2 } }, { action: "edit_set", set_id: "session-set-1", actual_reps: 9 }],
    ["skip", { action: "skip_set", setId: "session-set-1" }, { action: "skip_set", set_id: "session-set-1" }],
    ["add", { action: "add_set", sessionExerciseId: "session-exercise-1", setId: "session-set-2", sequence: 2, kind: "WORKING", targetRepsMin: 8, targetRepsMax: 10, targetWeight: null, targetEffort: null, targetRestSeconds: 90 }, { action: "add_set", set_id: "session-set-2", sequence_no: 2 }],
    ["delete", { action: "delete_set", setId: "session-set-1" }, { action: "delete_set", set_id: "session-set-1" }],
  ])("serializes the offline %s command", async (_name, command, expectedPayload) => {
    const requests: SupabaseRequest[] = [];
    const client: SupabaseDataClient = {
      request: async <T>(request: SupabaseRequest) => {
        requests.push(request);
        if (request.path.startsWith("rpc/workout_apply_command_idempotent")) return 2 as T;
        return [{ ...sessionRow(), version: 2 }] as T;
      },
    };
    await new SupabaseWorkoutRepository(client).applyIdempotentCommand({
      operationId: `operation-${_name}`,
      sessionId: "session-1",
      deviceId: "device-1",
      expectedVersion: 1,
      command,
    });
    expect(requests[0].body).toMatchObject({ p_command: expectedPayload });
  });

  it.each(["finish_session", "discard_session"] as const)("serializes the offline %s lifecycle command", async (action) => {
    const requests: SupabaseRequest[] = [];
    const client: SupabaseDataClient = {
      request: async <T>(request: SupabaseRequest) => {
        requests.push(request);
        if (request.path.startsWith("rpc/workout_apply_command_idempotent")) return 2 as T;
        return [{ ...sessionRow(), version: 2, status: action === "finish_session" ? "COMPLETED" : "DISCARDED" }] as T;
      },
    };
    await new SupabaseWorkoutRepository(client).applyIdempotentCommand({
      operationId: `operation-${action}`,
      sessionId: "session-1",
      deviceId: "device-1",
      expectedVersion: 1,
      command: { action },
    });
    expect(requests[0].body).toMatchObject({ p_command: { action } });
  });

  it("classifies authorization and server responses for the coordinator", async () => {
    const authorizationClient: SupabaseDataClient = {
      request: () => Promise.reject(new SupabaseRequestError(401, { message: "expired" })),
    };
    await expect(new SupabaseWorkoutRepository(authorizationClient).applyIdempotentCommand({
      operationId: "operation-1", sessionId: "session-1", deviceId: "device-1", expectedVersion: 1,
      command: { action: "complete_set", setId: "session-set-1", actualWeight: { value: 1, unit: "KG", kg: 1 }, actualReps: 1, actualEffort: null },
    })).rejects.toMatchObject({ code: "authorization" });
  });

  it("keeps an applied operation retryable when the acknowledgement read fails", async () => {
    let call = 0;
    const client: SupabaseDataClient = {
      request: async <T>(request: SupabaseRequest) => {
        call += 1;
        if (request.path.startsWith("rpc/workout_apply_command_idempotent")) return 2 as T;
        throw new SupabaseRequestError(503, { message: "temporary read failure" });
      },
    };
    await expect(new SupabaseWorkoutRepository(client).applyIdempotentCommand({
      operationId: "operation-2", sessionId: "session-1", deviceId: "device-1", expectedVersion: 1,
      command: { action: "complete_set", setId: "session-set-1", actualWeight: { value: 1, unit: "KG", kg: 1 }, actualReps: 1, actualEffort: null },
    })).rejects.toMatchObject({ code: "server" });
    expect(call).toBe(2);
  });

  it("validates devices and sends the remote abandon receipt payload", async () => {
    const requests: SupabaseRequest[] = [];
    const client: SupabaseDataClient = {
      request: async <T>(request: SupabaseRequest) => {
        requests.push(request);
        if (request.path.startsWith("rpc/workout_remote_abandon_session")) return 2 as T;
        if (request.path.startsWith("devices?")) return [{ id: "device-1", label: "Owner", last_seen_at: "2026-08-09T10:00:00.000Z", revoked_at: null }] as T;
        return [{ ...sessionRow(), status: "DISCARDED", version: 2 }] as T;
      },
    };
    const repository = new SupabaseWorkoutRepository(client);
    await expect(repository.listDevices()).resolves.toEqual([{ id: "device-1", label: "Owner", lastSeenAt: "2026-08-09T10:00:00.000Z" }]);
    const session = await repository.remoteAbandonSession({ operationId: "operation-abandon", sessionId: "session-1", expectedVersion: 1 });
    expect(session.status).toBe("DISCARDED");
    expect(requests[1]).toMatchObject({ path: "rpc/workout_remote_abandon_session", body: { p_operation_id: "operation-abandon", p_session_id: "session-1", p_expected_version: 1 } });
  });
});
