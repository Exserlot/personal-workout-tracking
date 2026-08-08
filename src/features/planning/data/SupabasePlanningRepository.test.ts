import { describe, expect, it } from "vitest";
import { SupabaseRequestError, type SupabaseDataClient } from "../../../lib/supabase/SupabaseRestClient";
import { PlanningRepositoryError } from "./PlanningRepository";
import { SupabasePlanningRepository } from "./SupabasePlanningRepository";

const templateRow = {
  id: "template-1",
  name: "Push A",
  notes: "",
  revision: 1,
  archived_at: null,
  template_exercises: [{
    id: "template-exercise-1",
    exercise_id: "exercise-1",
    sequence_no: 1,
    notes: "",
    exercise: { name: "Bench Press", archived_at: null },
    template_set_prescriptions: [{
      id: "set-1",
      sequence_no: 1,
      set_kind_code: "WORKING",
      is_to_failure: false,
      target_reps_min: 6,
      target_reps_max: 8,
      target_weight_value: 72.5,
      target_weight_unit: "KG",
      target_weight_kg: 72.5,
      target_effort_metric: "RPE",
      target_effort_value: 8.5,
      target_rest_seconds: 120,
    }],
  }],
};

class FakeClient implements SupabaseDataClient {
  public calls: Array<{ method: string; path: string; body?: unknown }> = [];
  constructor(private readonly responses: unknown[]) {}
  async request<T>(request: { method: "GET" | "POST" | "PATCH"; path: string; body?: unknown }): Promise<T> {
    this.calls.push(request);
    const response = this.responses.shift();
    if (response instanceof Error) throw response;
    return response as T;
  }
}

describe("SupabasePlanningRepository", () => {
  it("maps nested template rows and preserves decimal targets", async () => {
    const client = new FakeClient([[templateRow]]);
    const template = await new SupabasePlanningRepository(client).getTemplate("template-1");
    expect(template?.exercises[0].prescriptions[0].targetWeightValue).toBe(72.5);
    expect(template?.exercises[0].prescriptions[0].targetEffortValue).toBe(8.5);
  });

  it("rejects malformed nested responses before exposing them to UI", async () => {
    const client = new FakeClient([[{ ...templateRow, template_exercises: [{ ...templateRow.template_exercises[0], template_set_prescriptions: "broken" }] }]]);
    await expect(new SupabasePlanningRepository(client).getTemplate("template-1")).rejects.toMatchObject({ code: "unknown" });
  });

  it("sends grouped targets to the transactional RPC and reloads the aggregate", async () => {
    const client = new FakeClient(["template-2", [{ ...templateRow, id: "template-2", name: "Pull B" }]]);
    const result = await new SupabasePlanningRepository(client).createTemplate({
      name: "Pull B",
      notes: "",
      exercises: [{
        clientId: "row-1",
        exerciseId: "exercise-1",
        exerciseName: "Bench Press",
        exerciseArchivedAt: null,
        notes: "",
        setCount: 2,
        repsMin: 8,
        repsMax: 10,
        targetWeightValue: 72.5,
        targetWeightUnit: "KG",
        targetEffortMetric: "RIR",
        targetEffortValue: 2,
        restSeconds: 90,
      }],
    });
    expect(result.id).toBe("template-2");
    expect(client.calls[0].path).toBe("rpc/planning_create_template");
    expect((client.calls[0].body as { p_exercises: Array<{ sets: unknown[] }> }).p_exercises[0].sets).toHaveLength(2);
  });

  it("maps revision conflicts to a stable repository error", async () => {
    const client = new FakeClient([new SupabaseRequestError(409, { code: "40001", message: "revision_conflict" })]);
    const repository = new SupabasePlanningRepository(client);
    const result = repository.archiveTemplate("template-1", 1);
    await expect(result).rejects.toEqual(expect.any(PlanningRepositoryError));
    await expect(result).rejects.toMatchObject({ code: "conflict" });
  });
});
