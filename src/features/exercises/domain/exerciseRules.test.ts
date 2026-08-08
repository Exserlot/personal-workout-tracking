import { describe, expect, it } from "vitest";
import type { Exercise } from "./exercise";
import { defaultExerciseQuery } from "./exercise";
import {
  filterExercises,
  normalizeExerciseName,
  validateExerciseDraft,
} from "./exerciseRules";

const exercises: Exercise[] = [
  {
    id: "starter-bench",
    name: "Barbell Bench Press",
    normalizedName: "barbell bench press",
    primaryMuscleCode: "chest",
    secondaryMuscleCodes: ["triceps", "shoulders"],
    equipmentCode: "barbell",
    description: "",
    source: "starter",
    archivedAt: null,
    version: 1,
  },
  {
    id: "custom-raise",
    name: "Cable Lateral Raise",
    normalizedName: "cable lateral raise",
    primaryMuscleCode: "shoulders",
    secondaryMuscleCodes: [],
    equipmentCode: "cable",
    description: "",
    source: "custom",
    archivedAt: "2026-08-07T00:00:00.000Z",
    version: 2,
  },
];

describe("exercise rules", () => {
  it("normalizes case and repeated whitespace for duplicate checks", () => {
    expect(normalizeExerciseName("  CABLE   Lateral Raise ")).toBe("cable lateral raise");
  });

  it("rejects a case-insensitive duplicate custom name, including archived records", () => {
    const errors = validateExerciseDraft(
      {
        name: " cable lateral RAISE ",
        primaryMuscleCode: "shoulders",
        secondaryMuscleCodes: [],
        equipmentCode: "cable",
        description: "",
      },
      exercises,
    );

    expect(errors.name).toBeDefined();
  });

  it("allows a custom exercise to share a name with a starter exercise", () => {
    const errors = validateExerciseDraft(
      {
        name: "Barbell Bench Press",
        primaryMuscleCode: "chest",
        secondaryMuscleCodes: ["triceps"],
        equipmentCode: "barbell",
        description: "",
      },
      exercises,
    );

    expect(errors.name).toBeUndefined();
  });

  it("matches a muscle filter against primary and secondary muscles", () => {
    const results = filterExercises(exercises, {
      ...defaultExerciseQuery,
      muscleCode: "triceps",
    });

    expect(results.map((exercise) => exercise.id)).toEqual(["starter-bench"]);
  });

  it("combines search, equipment and archived status filters", () => {
    const results = filterExercises(exercises, {
      search: "lateral",
      muscleCode: "all",
      equipmentCode: "cable",
      status: "archived",
    });

    expect(results.map((exercise) => exercise.id)).toEqual(["custom-raise"]);
  });
});
