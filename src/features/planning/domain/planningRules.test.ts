import { describe, expect, it } from "vitest";
import {
  expandGroupedTarget,
  moveItem,
  eligibleTemplates,
  otherRoutines,
  plansPageActions,
  validateRoutineDraft,
  validateWorkoutTemplateDraft,
} from "./planningRules";

const target = {
  clientId: "bench",
  exerciseId: "exercise-1",
  exerciseName: "Bench Press",
  exerciseArchivedAt: null,
  notes: "",
  setCount: 3,
  repsMin: 6,
  repsMax: 8,
  targetWeightValue: 72.5,
  targetWeightUnit: "KG" as const,
  targetEffortMetric: "RPE" as const,
  targetEffortValue: 8.5,
  restSeconds: 120,
};

describe("planning rules", () => {
  const template = (id: string, exerciseCount = 1, setCount = 3, archivedAt: string | null = null) => ({ id, name: id, notes: "", revision: 1, archivedAt, exerciseCount, setCount });
  const routine = (id: string, archivedAt: string | null = null) => ({ id, name: id, weeklyFrequencyTarget: 3, revision: 1, archivedAt, days: [] });

  it("selects eligible templates and state-aware page actions", () => {
    expect(eligibleTemplates([template("empty", 0, 0), template("archived", 1, 3, "2026-01-01"), template("ready")])).toHaveLength(1);
    expect(plansPageActions([], [])).toEqual([{ key: "create-template", label: "สร้าง Template", variant: "primary" }]);
    expect(plansPageActions([template("ready")], [])).toMatchObject([{ key: "create-routine" }, { key: "create-template" }]);
    expect(plansPageActions([template("ready")], [routine("old")])[0]).toMatchObject({ key: "activate-routine", target: "routines" });
    expect(plansPageActions([template("ready")], [routine("archived", "2026-01-01")])[0]).toMatchObject({ key: "create-routine", variant: "primary" });
    expect(plansPageActions([template("ready")], [routine("active")], "active")[0]).toMatchObject({ key: "create-template" });
  });

  it("keeps active and archived routines out of the other-routines list", () => {
    expect(otherRoutines([routine("active"), routine("archived", "2026-01-01"), routine("other")], "active").map((item) => item.id)).toEqual(["other"]);
  });

  it("expands a grouped target into ordered working sets", () => {
    expect(expandGroupedTarget(target)).toEqual([
      expect.objectContaining({ sequence_no: 1, set_kind_code: "WORKING", target_weight_value: 72.5 }),
      expect.objectContaining({ sequence_no: 2, set_kind_code: "WORKING" }),
      expect.objectContaining({ sequence_no: 3, set_kind_code: "WORKING" }),
    ]);
  });

  it("rejects invalid reps, weight, effort and rest values", () => {
    const errors = validateWorkoutTemplateDraft({
      name: "Upper",
      notes: "",
      exercises: [{ ...target, setCount: 0, repsMin: 10, repsMax: 8, targetWeightValue: -1, targetEffortValue: 8.3, restSeconds: -1 }],
    });
    expect(errors.exerciseErrors?.bench).toHaveLength(5);
  });

  it("validates routine frequency and requires at least one day", () => {
    const errors = validateRoutineDraft({ name: "A-B-C", weeklyFrequencyTarget: 8, days: [] });
    expect(errors.weeklyFrequencyTarget).toBeDefined();
    expect(errors.days).toBeDefined();
  });

  it("moves ordered routine items without mutating the source", () => {
    const source = ["A", "B", "C"];
    expect(moveItem(source, 2, 0)).toEqual(["C", "A", "B"]);
    expect(source).toEqual(["A", "B", "C"]);
  });

});
