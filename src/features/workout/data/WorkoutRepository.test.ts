import { describe, expect, it } from "vitest";
import { SupabaseRequestError, type SupabaseDataClient } from "../../../lib/supabase/SupabaseRestClient";
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
});
