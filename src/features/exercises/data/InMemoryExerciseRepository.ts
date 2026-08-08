import type { Exercise, ExerciseDraft, ExerciseQuery } from "../domain/exercise";
import {
  filterExercises,
  hasExerciseValidationErrors,
  normalizeExerciseName,
  validateExerciseDraft,
} from "../domain/exerciseRules";
import {
  ExerciseRepositoryError,
  type ExerciseRepository,
} from "./ExerciseRepository";

function cloneExercise(exercise: Exercise): Exercise {
  return {
    ...exercise,
    secondaryMuscleCodes: [...exercise.secondaryMuscleCodes],
  };
}

export class InMemoryExerciseRepository implements ExerciseRepository {
  private exercises: Exercise[];

  constructor(seed: Exercise[], private readonly latencyMs = 80) {
    this.exercises = seed.map(cloneExercise);
  }

  async list(query: ExerciseQuery) {
    await this.wait();
    return filterExercises(this.exercises, query).map(cloneExercise);
  }

  async getById(id: string) {
    await this.wait();
    const exercise = this.exercises.find((candidate) => candidate.id === id);
    return exercise ? cloneExercise(exercise) : null;
  }

  async create(draft: ExerciseDraft) {
    await this.wait();
    const fieldErrors = validateExerciseDraft(draft, this.exercises);
    if (hasExerciseValidationErrors(fieldErrors)) {
      throw new ExerciseRepositoryError(
        "validation",
        "ตรวจสอบข้อมูลท่าฝึกที่ระบุ",
        fieldErrors,
      );
    }

    const exercise: Exercise = {
      id: globalThis.crypto.randomUUID(),
      name: draft.name.normalize("NFKC").trim().replace(/\s+/g, " "),
      normalizedName: normalizeExerciseName(draft.name),
      primaryMuscleCode: this.requirePrimaryMuscle(draft),
      secondaryMuscleCodes: [...draft.secondaryMuscleCodes],
      equipmentCode: this.requireEquipment(draft),
      description: draft.description.trim(),
      source: "custom",
      archivedAt: null,
      version: 1,
    };

    this.exercises.push(exercise);
    return cloneExercise(exercise);
  }

  async update(id: string, draft: ExerciseDraft) {
    await this.wait();
    const index = this.exercises.findIndex((candidate) => candidate.id === id);
    if (index < 0) {
      throw new ExerciseRepositoryError("not-found", "ไม่พบท่าฝึกที่ต้องการแก้ไข");
    }

    const current = this.exercises[index];
    if (current.source === "starter") {
      throw new ExerciseRepositoryError("read-only", "Starter Exercise แก้ไขไม่ได้");
    }
    if (current.archivedAt) {
      throw new ExerciseRepositoryError("archived", "Exercise ที่ archive แล้วแก้ไขไม่ได้");
    }

    const fieldErrors = validateExerciseDraft(draft, this.exercises, id);
    if (hasExerciseValidationErrors(fieldErrors)) {
      throw new ExerciseRepositoryError(
        "validation",
        "ตรวจสอบข้อมูลท่าฝึกที่ระบุ",
        fieldErrors,
      );
    }

    const updated: Exercise = {
      ...current,
      name: draft.name.normalize("NFKC").trim().replace(/\s+/g, " "),
      normalizedName: normalizeExerciseName(draft.name),
      primaryMuscleCode: this.requirePrimaryMuscle(draft),
      secondaryMuscleCodes: [...draft.secondaryMuscleCodes],
      equipmentCode: this.requireEquipment(draft),
      description: draft.description.trim(),
      version: current.version + 1,
    };

    this.exercises[index] = updated;
    return cloneExercise(updated);
  }

  async archive(id: string) {
    await this.wait();
    const index = this.exercises.findIndex((candidate) => candidate.id === id);
    if (index < 0) {
      throw new ExerciseRepositoryError("not-found", "ไม่พบท่าฝึกที่ต้องการ archive");
    }

    const current = this.exercises[index];
    if (current.source === "starter") {
      throw new ExerciseRepositoryError("read-only", "Starter Exercise archive ไม่ได้");
    }
    if (current.archivedAt) return cloneExercise(current);

    const archived: Exercise = {
      ...current,
      archivedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    this.exercises[index] = archived;
    return cloneExercise(archived);
  }

  private requirePrimaryMuscle(draft: ExerciseDraft) {
    if (!draft.primaryMuscleCode) {
      throw new ExerciseRepositoryError("validation", "กรุณาเลือกกล้ามเนื้อหลัก");
    }
    return draft.primaryMuscleCode;
  }

  private requireEquipment(draft: ExerciseDraft) {
    if (!draft.equipmentCode) {
      throw new ExerciseRepositoryError("validation", "กรุณาเลือกอุปกรณ์");
    }
    return draft.equipmentCode;
  }

  private wait() {
    if (this.latencyMs <= 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, this.latencyMs);
    });
  }
}
