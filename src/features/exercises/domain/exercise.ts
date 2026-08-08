export const muscleOptions = [
  { code: "chest", label: "Chest" },
  { code: "back", label: "Back" },
  { code: "shoulders", label: "Shoulders" },
  { code: "biceps", label: "Biceps" },
  { code: "triceps", label: "Triceps" },
  { code: "quadriceps", label: "Quadriceps" },
  { code: "hamstrings", label: "Hamstrings" },
  { code: "glutes", label: "Glutes" },
  { code: "calves", label: "Calves" },
  { code: "core", label: "Core" },
] as const;

export const equipmentOptions = [
  { code: "barbell", label: "Barbell" },
  { code: "dumbbell", label: "Dumbbell" },
  { code: "cable", label: "Cable" },
  { code: "machine", label: "Machine" },
  { code: "bodyweight", label: "Bodyweight" },
  { code: "kettlebell", label: "Kettlebell" },
] as const;

export type MuscleCode = (typeof muscleOptions)[number]["code"];
export type EquipmentCode = (typeof equipmentOptions)[number]["code"];
export type ExerciseSource = "starter" | "custom";
export type ExerciseStatusFilter = "active" | "archived" | "all";

export interface Exercise {
  id: string;
  name: string;
  normalizedName: string;
  primaryMuscleCode: MuscleCode;
  secondaryMuscleCodes: MuscleCode[];
  equipmentCode: EquipmentCode;
  description: string;
  source: ExerciseSource;
  archivedAt: string | null;
  version: number;
}

export interface ExerciseDraft {
  name: string;
  primaryMuscleCode: MuscleCode | "";
  secondaryMuscleCodes: MuscleCode[];
  equipmentCode: EquipmentCode | "";
  description: string;
}

export interface ExerciseQuery {
  search: string;
  muscleCode: MuscleCode | "all";
  equipmentCode: EquipmentCode | "all";
  status: ExerciseStatusFilter;
}

export const defaultExerciseQuery: ExerciseQuery = {
  search: "",
  muscleCode: "all",
  equipmentCode: "all",
  status: "active",
};

export function getMuscleLabel(code: MuscleCode) {
  return muscleOptions.find((option) => option.code === code)?.label ?? code;
}

export function getEquipmentLabel(code: EquipmentCode) {
  return equipmentOptions.find((option) => option.code === code)?.label ?? code;
}
