import type { Exercise } from "../domain/exercise";
import { normalizeExerciseName } from "../domain/exerciseRules";

function starterExercise(
  id: string,
  name: string,
  primaryMuscleCode: Exercise["primaryMuscleCode"],
  secondaryMuscleCodes: Exercise["secondaryMuscleCodes"],
  equipmentCode: Exercise["equipmentCode"],
  description: string,
): Exercise {
  return {
    id,
    name,
    normalizedName: normalizeExerciseName(name),
    primaryMuscleCode,
    secondaryMuscleCodes,
    equipmentCode,
    description,
    source: "starter",
    archivedAt: null,
    version: 1,
  };
}

export const temporaryExercises: Exercise[] = [
  starterExercise(
    "bench-press",
    "Barbell Bench Press",
    "chest",
    ["triceps", "shoulders"],
    "barbell",
    "Compound horizontal press performed on a flat bench.",
  ),
  starterExercise(
    "back-squat",
    "Back Squat",
    "quadriceps",
    ["glutes", "hamstrings", "core"],
    "barbell",
    "Barbell squat with the load supported across the upper back.",
  ),
  starterExercise(
    "romanian-deadlift",
    "Romanian Deadlift",
    "hamstrings",
    ["glutes", "back"],
    "barbell",
    "Hip-hinge movement emphasizing the posterior chain.",
  ),
  starterExercise(
    "lat-pulldown",
    "Lat Pulldown",
    "back",
    ["biceps"],
    "cable",
    "Vertical cable pull performed from a seated position.",
  ),
  starterExercise(
    "overhead-press",
    "Barbell Overhead Press",
    "shoulders",
    ["triceps", "core"],
    "barbell",
    "Standing vertical press with a barbell.",
  ),
  starterExercise(
    "pull-up",
    "Pull-up",
    "back",
    ["biceps", "core"],
    "bodyweight",
    "Bodyweight vertical pull from a hanging position.",
  ),
  {
    id: "cable-lateral-raise",
    name: "Cable Lateral Raise",
    normalizedName: normalizeExerciseName("Cable Lateral Raise"),
    primaryMuscleCode: "shoulders",
    secondaryMuscleCodes: [],
    equipmentCode: "cable",
    description: "Single-arm lateral raise using a low cable.",
    source: "custom",
    archivedAt: null,
    version: 1,
  },
];
