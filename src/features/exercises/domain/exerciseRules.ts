import {
  equipmentOptions,
  muscleOptions,
  type Exercise,
  type ExerciseDraft,
  type ExerciseQuery,
} from "./exercise";

export type ExerciseField =
  | "name"
  | "primaryMuscleCode"
  | "secondaryMuscleCodes"
  | "equipmentCode";

export type ExerciseValidationErrors = Partial<Record<ExerciseField, string>>;

export function normalizeExerciseName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function validateExerciseDraft(
  draft: ExerciseDraft,
  exercises: Exercise[],
  currentExerciseId?: string,
): ExerciseValidationErrors {
  const errors: ExerciseValidationErrors = {};
  const normalizedName = normalizeExerciseName(draft.name);
  const muscleCodes = new Set(muscleOptions.map((option) => option.code));
  const equipmentCodes = new Set(equipmentOptions.map((option) => option.code));

  if (!normalizedName) {
    errors.name = "กรุณากรอกชื่อท่าฝึก";
  } else if (
    exercises.some(
      (exercise) =>
        exercise.source === "custom" &&
        exercise.id !== currentExerciseId &&
        exercise.normalizedName === normalizedName,
    )
  ) {
    errors.name = "มี Custom Exercise ชื่อนี้อยู่แล้ว";
  }

  if (!draft.primaryMuscleCode) {
    errors.primaryMuscleCode = "กรุณาเลือกกล้ามเนื้อหลัก";
  } else if (!muscleCodes.has(draft.primaryMuscleCode)) {
    errors.primaryMuscleCode = "กล้ามเนื้อหลักไม่อยู่ในรายการที่รองรับ";
  }

  if (!draft.equipmentCode) {
    errors.equipmentCode = "กรุณาเลือกอุปกรณ์";
  } else if (!equipmentCodes.has(draft.equipmentCode)) {
    errors.equipmentCode = "อุปกรณ์ไม่อยู่ในรายการที่รองรับ";
  }

  const secondaryCodes = new Set(draft.secondaryMuscleCodes);
  if (secondaryCodes.size !== draft.secondaryMuscleCodes.length) {
    errors.secondaryMuscleCodes = "กล้ามเนื้อรองต้องไม่ซ้ำกัน";
  } else if (draft.secondaryMuscleCodes.some((code) => !muscleCodes.has(code))) {
    errors.secondaryMuscleCodes = "มีกล้ามเนื้อรองที่ไม่อยู่ในรายการที่รองรับ";
  } else if (
    draft.primaryMuscleCode &&
    draft.secondaryMuscleCodes.includes(draft.primaryMuscleCode)
  ) {
    errors.secondaryMuscleCodes = "กล้ามเนื้อหลักและรองต้องไม่เป็นรายการเดียวกัน";
  }

  return errors;
}

export function filterExercises(exercises: Exercise[], query: ExerciseQuery) {
  const normalizedSearch = normalizeExerciseName(query.search);

  return exercises
    .filter((exercise) => {
      if (query.status === "active" && exercise.archivedAt) return false;
      if (query.status === "archived" && !exercise.archivedAt) return false;
      if (normalizedSearch && !exercise.normalizedName.includes(normalizedSearch)) return false;
      if (
        query.muscleCode !== "all" &&
        exercise.primaryMuscleCode !== query.muscleCode &&
        !exercise.secondaryMuscleCodes.includes(query.muscleCode)
      ) {
        return false;
      }
      if (query.equipmentCode !== "all" && exercise.equipmentCode !== query.equipmentCode) {
        return false;
      }
      return true;
    })
    .sort((left, right) => left.name.localeCompare(right.name, ["en", "th"]));
}

export interface ExercisePage {
  items: Exercise[];
  page: number;
  pageCount: number;
  startIndex: number;
  endIndex: number;
}

export function paginateExercises(
  exercises: Exercise[],
  requestedPage: number,
  pageSize = 10,
): ExercisePage {
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const pageCount = Math.max(1, Math.ceil(exercises.length / safePageSize));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage)), pageCount);
  const startIndex = (page - 1) * safePageSize;
  const items = exercises.slice(startIndex, startIndex + safePageSize);

  return {
    items,
    page,
    pageCount,
    startIndex,
    endIndex: startIndex + items.length,
  };
}

export function hasExerciseValidationErrors(errors: ExerciseValidationErrors) {
  return Object.keys(errors).length > 0;
}
