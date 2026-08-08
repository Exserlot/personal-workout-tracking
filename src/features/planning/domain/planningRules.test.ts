import { describe, expect, it } from "vitest";
import {
  clampNextWorkoutIndex,
  expandGroupedTarget,
  moveItem,
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

  it("clamps the next workout index after a routine shrinks", () => {
    expect(clampNextWorkoutIndex(4, 3)).toBe(2);
    expect(clampNextWorkoutIndex(4, 0)).toBe(0);
  });
});
