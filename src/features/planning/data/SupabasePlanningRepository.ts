import {
  expandGroupedTarget,
  hasPlanningValidationErrors,
  validateRoutineDraft,
  validateWorkoutTemplateDraft,
} from "../domain/planningRules";
import type {
  ActiveRoutinePreview,
  EffortMetric,
  Routine,
  RoutineDay,
  RoutineDraft,
  SetKind,
  SetPrescription,
  TemplateExercise,
  WeightUnit,
  WorkoutTemplate,
  WorkoutTemplateDraft,
  WorkoutTemplateSummary,
} from "../domain/planning";
import {
  PlanningRepositoryError,
  type PlanningRepository,
} from "./PlanningRepository";
import {
  SupabaseRequestError,
  SupabaseRestClient,
  type SupabaseDataClient,
} from "../../../lib/supabase/SupabaseRestClient";

type RecordValue = Record<string, unknown>;

const TEMPLATE_SELECT = [
  "id",
  "name",
  "notes",
  "revision",
  "archived_at",
  "template_exercises(id,exercise_id,sequence_no,notes,exercise:exercises!template_exercises_exercise_id_fkey(name,archived_at),template_set_prescriptions(id,sequence_no,set_kind_code,is_to_failure,target_reps_min,target_reps_max,target_weight_value,target_weight_unit,target_weight_kg,target_effort_metric,target_effort_value,target_rest_seconds))",
].join(",");

const ROUTINE_SELECT = [
  "id",
  "name",
  "weekly_frequency_target",
  "next_workout_index",
  "is_active",
  "revision",
  "archived_at",
  "routine_days(id,template_id,sequence_no,label,notes,template:workout_templates!routine_days_template_id_fkey(name,archived_at))",
].join(",");

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new PlanningRepositoryError("unknown", `Planning response missing ${field}`);
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value, field);
}

function integer(value: unknown, field: string, minimum = 0): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < minimum) throw new PlanningRepositoryError("unknown", `Planning response has invalid ${field}`);
  return parsed;
}

function decimal(value: unknown, field: string, nullable = false): number | null {
  if (nullable && (value === null || value === undefined)) return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) throw new PlanningRepositoryError("unknown", `Planning response has invalid ${field}`);
  return parsed;
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new PlanningRepositoryError("unknown", `Planning response has invalid ${field}`);
  return value;
}

function arrayValue(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new PlanningRepositoryError("unknown", `Planning response has invalid ${field}`);
  return value;
}

function parseSet(value: unknown): SetPrescription {
  const row = asRecord(value);
  if (!row) throw new PlanningRepositoryError("unknown", "Planning set response is not an object");
  const kind = requiredString(row.set_kind_code, "set_kind_code");
  if (kind !== "WARM_UP" && kind !== "WORKING" && kind !== "DROP") throw new PlanningRepositoryError("unknown", "Planning response has invalid set kind");
  const effort = nullableString(row.target_effort_metric, "target_effort_metric");
  if (effort !== null && effort !== "RPE" && effort !== "RIR") throw new PlanningRepositoryError("unknown", "Planning response has invalid effort metric");
  const weightUnit = nullableString(row.target_weight_unit, "target_weight_unit");
  if (weightUnit !== null && weightUnit !== "KG" && weightUnit !== "LB") throw new PlanningRepositoryError("unknown", "Planning response has invalid weight unit");
  return {
    id: requiredString(row.id, "id"),
    sequence: integer(row.sequence_no, "sequence_no", 1),
    kind: kind as SetKind,
    isToFailure: booleanValue(row.is_to_failure, "is_to_failure"),
    repsMin: integer(row.target_reps_min, "target_reps_min", 1),
    repsMax: integer(row.target_reps_max, "target_reps_max", 1),
    targetWeightValue: decimal(row.target_weight_value, "target_weight_value", true),
    targetWeightUnit: weightUnit as WeightUnit | null,
    targetWeightKg: decimal(row.target_weight_kg, "target_weight_kg", true),
    targetEffortMetric: effort as EffortMetric | null,
    targetEffortValue: decimal(row.target_effort_value, "target_effort_value", true),
    restSeconds: integer(row.target_rest_seconds, "target_rest_seconds"),
  };
}

function parseTemplateExercise(value: unknown): TemplateExercise {
  const row = asRecord(value);
  if (!row) throw new PlanningRepositoryError("unknown", "Planning template exercise response is not an object");
  const exercise = asRecord(row.exercise);
  const prescriptions = arrayValue(row.template_set_prescriptions, "template_set_prescriptions")
    .map(parseSet)
    .sort((a, b) => a.sequence - b.sequence);
  return {
    id: requiredString(row.id, "id"),
    exerciseId: requiredString(row.exercise_id, "exercise_id"),
    exerciseName: requiredString(exercise?.name, "exercise.name"),
    exerciseArchivedAt: nullableString(exercise?.archived_at, "exercise.archived_at"),
    sequence: integer(row.sequence_no, "sequence_no", 1),
    notes: typeof row.notes === "string" ? row.notes : "",
    prescriptions,
  };
}

function parseTemplate(value: unknown): WorkoutTemplate {
  const row = asRecord(value);
  if (!row) throw new PlanningRepositoryError("unknown", "Planning template response is not an object");
  return {
    id: requiredString(row.id, "id"),
    name: requiredString(row.name, "name"),
    notes: typeof row.notes === "string" ? row.notes : "",
    revision: integer(row.revision, "revision", 1),
    archivedAt: nullableString(row.archived_at, "archived_at"),
    exercises: arrayValue(row.template_exercises, "template_exercises")
      .map(parseTemplateExercise)
      .sort((a, b) => a.sequence - b.sequence),
  };
}

function parseTemplateRows(value: unknown): WorkoutTemplate[] {
  return arrayValue(value, "templates").map(parseTemplate);
}

function parseRoutineDay(value: unknown): RoutineDay {
  const row = asRecord(value);
  if (!row) throw new PlanningRepositoryError("unknown", "Planning routine day response is not an object");
  const template = asRecord(row.template);
  return {
    id: requiredString(row.id, "id"),
    templateId: requiredString(row.template_id, "template_id"),
    templateName: requiredString(template?.name, "template.name"),
    templateArchivedAt: nullableString(template?.archived_at, "template.archived_at"),
    sequence: integer(row.sequence_no, "sequence_no", 1),
    label: typeof row.label === "string" ? row.label : "",
    notes: typeof row.notes === "string" ? row.notes : "",
  };
}

function parseRoutine(value: unknown): Routine {
  const row = asRecord(value);
  if (!row) throw new PlanningRepositoryError("unknown", "Planning routine response is not an object");
  return {
    id: requiredString(row.id, "id"),
    name: requiredString(row.name, "name"),
    weeklyFrequencyTarget: integer(row.weekly_frequency_target, "weekly_frequency_target", 1),
    nextWorkoutIndex: integer(row.next_workout_index, "next_workout_index"),
    isActive: booleanValue(row.is_active, "is_active"),
    revision: integer(row.revision, "revision", 1),
    archivedAt: nullableString(row.archived_at, "archived_at"),
    days: arrayValue(row.routine_days, "routine_days").map(parseRoutineDay).sort((a, b) => a.sequence - b.sequence),
  };
}

function parseRoutineRows(value: unknown): Routine[] {
  return arrayValue(value, "routines").map(parseRoutine);
}

function rpcId(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) return rpcId(value[0]);
  const row = asRecord(value);
  if (row && typeof row.id === "string") return row.id;
  throw new PlanningRepositoryError("unknown", "Planning mutation did not return an id");
}

function mapError(error: unknown, fallback: string): PlanningRepositoryError {
  if (error instanceof PlanningRepositoryError) return error;
  if (error instanceof SupabaseRequestError) {
    const payload = asRecord(error.payload);
    const code = typeof payload?.code === "string" ? payload.code : "";
    const message = typeof payload?.message === "string" ? payload.message : "";
    if (code === "40001" || message === "revision_conflict") return new PlanningRepositoryError("conflict", "ข้อมูลถูกแก้ไขจากหน้าต่างอื่นแล้ว กรุณาโหลดใหม่");
    if (code === "23503" && message.includes("referenced")) return new PlanningRepositoryError("referenced", "รายการนี้ยังถูกใช้งานอยู่");
    if (code === "P0002" || error.status === 404) return new PlanningRepositoryError("not-found", "ไม่พบข้อมูลที่ต้องการ");
    if (code === "23514" || code === "22P02") return new PlanningRepositoryError("validation", message || "ข้อมูลแผนซ้อมไม่ถูกต้อง");
    if (error.status === 401 || error.status === 403) return new PlanningRepositoryError("unknown", "ต้องเข้าสู่ระบบเพื่อจัดการแผนซ้อม");
  }
  if (error instanceof TypeError || (error instanceof Error && /fetch|network|offline/i.test(error.message))) {
    return new PlanningRepositoryError("offline", "ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณาตรวจสอบอินเทอร์เน็ต");
  }
  return new PlanningRepositoryError("unknown", fallback);
}

function templatePayload(draft: WorkoutTemplateDraft) {
  return draft.exercises.map((exercise, exerciseIndex) => ({
    exercise_id: exercise.exerciseId,
    sequence_no: exerciseIndex + 1,
    notes: exercise.notes,
    sets: expandGroupedTarget(exercise),
  }));
}

function routinePayload(draft: RoutineDraft) {
  return draft.days.map((day, index) => ({
    template_id: day.templateId,
    sequence_no: index + 1,
    label: day.label,
    notes: day.notes,
  }));
}

export class SupabasePlanningRepository implements PlanningRepository {
  constructor(private readonly client: SupabaseDataClient) {}

  private async templates(includeArchived: boolean) {
    const params = new URLSearchParams({ select: TEMPLATE_SELECT, order: "created_at.desc" });
    if (!includeArchived) params.set("archived_at", "is.null");
    return parseTemplateRows(await this.client.request<unknown[]>({ method: "GET", path: `workout_templates?${params.toString()}` }));
  }

  async listTemplates(includeArchived = false): Promise<WorkoutTemplateSummary[]> {
    try {
      return (await this.templates(includeArchived)).map((template) => ({
        id: template.id,
        name: template.name,
        notes: template.notes,
        revision: template.revision,
        archivedAt: template.archivedAt,
        exerciseCount: template.exercises.length,
        setCount: template.exercises.reduce((count, exercise) => count + exercise.prescriptions.length, 0),
      }));
    } catch (error) {
      throw mapError(error, "โหลด Workout Templates ไม่สำเร็จ");
    }
  }

  async getTemplate(id: string): Promise<WorkoutTemplate | null> {
    try {
      const params = new URLSearchParams({ select: TEMPLATE_SELECT, id: `eq.${id}` });
      const rows = await this.client.request<unknown[]>({ method: "GET", path: `workout_templates?${params.toString()}` });
      return rows.length === 0 ? null : parseTemplate(rows[0]);
    } catch (error) {
      throw mapError(error, "โหลด Workout Template ไม่สำเร็จ");
    }
  }

  async createTemplate(draft: WorkoutTemplateDraft): Promise<WorkoutTemplate> {
    try {
      const errors = validateWorkoutTemplateDraft(draft);
      if (hasPlanningValidationErrors(errors)) throw new PlanningRepositoryError("validation", "กรุณาตรวจสอบข้อมูล Template", errors);
      const id = rpcId(await this.client.request<unknown>({ method: "POST", path: "rpc/planning_create_template", body: { p_name: draft.name.trim(), p_notes: draft.notes, p_exercises: templatePayload(draft) } }));
      const created = await this.getTemplate(id);
      if (!created) throw new PlanningRepositoryError("unknown", "สร้าง Template แล้วแต่โหลดข้อมูลกลับไม่สำเร็จ");
      return created;
    } catch (error) {
      throw mapError(error, "สร้าง Workout Template ไม่สำเร็จ");
    }
  }

  async updateTemplate(id: string, expectedRevision: number, draft: WorkoutTemplateDraft): Promise<WorkoutTemplate> {
    try {
      const errors = validateWorkoutTemplateDraft(draft);
      if (hasPlanningValidationErrors(errors)) throw new PlanningRepositoryError("validation", "กรุณาตรวจสอบข้อมูล Template", errors);
      const updatedId = rpcId(await this.client.request<unknown>({ method: "POST", path: "rpc/planning_update_template", body: { p_id: id, p_expected_revision: expectedRevision, p_name: draft.name.trim(), p_notes: draft.notes, p_exercises: templatePayload(draft) } }));
      const updated = await this.getTemplate(updatedId);
      if (!updated) throw new PlanningRepositoryError("unknown", "แก้ไข Template แล้วแต่โหลดข้อมูลกลับไม่สำเร็จ");
      return updated;
    } catch (error) {
      throw mapError(error, "แก้ไข Workout Template ไม่สำเร็จ");
    }
  }

  async duplicateTemplate(id: string): Promise<WorkoutTemplate> {
    try {
      const newId = rpcId(await this.client.request<unknown>({ method: "POST", path: "rpc/planning_duplicate_template", body: { p_id: id } }));
      const duplicate = await this.getTemplate(newId);
      if (!duplicate) throw new PlanningRepositoryError("unknown", "คัดลอก Template แล้วแต่โหลดข้อมูลกลับไม่สำเร็จ");
      return duplicate;
    } catch (error) {
      throw mapError(error, "คัดลอก Workout Template ไม่สำเร็จ");
    }
  }

  async archiveTemplate(id: string, expectedRevision: number): Promise<void> {
    try {
      await this.client.request({ method: "POST", path: "rpc/planning_archive_template", body: { p_id: id, p_expected_revision: expectedRevision } });
    } catch (error) {
      throw mapError(error, "Archive Workout Template ไม่สำเร็จ");
    }
  }

  async listRoutines(includeArchived = false): Promise<Routine[]> {
    try {
      const params = new URLSearchParams({ select: ROUTINE_SELECT, order: "created_at.desc" });
      if (!includeArchived) params.set("archived_at", "is.null");
      return parseRoutineRows(await this.client.request<unknown[]>({ method: "GET", path: `routines?${params.toString()}` }));
    } catch (error) {
      throw mapError(error, "โหลด Routines ไม่สำเร็จ");
    }
  }

  async getRoutine(id: string): Promise<Routine | null> {
    try {
      const params = new URLSearchParams({ select: ROUTINE_SELECT, id: `eq.${id}` });
      const rows = await this.client.request<unknown[]>({ method: "GET", path: `routines?${params.toString()}` });
      return rows.length === 0 ? null : parseRoutine(rows[0]);
    } catch (error) {
      throw mapError(error, "โหลด Routine ไม่สำเร็จ");
    }
  }

  async createRoutine(draft: RoutineDraft): Promise<Routine> {
    try {
      const errors = validateRoutineDraft(draft);
      if (hasPlanningValidationErrors(errors)) throw new PlanningRepositoryError("validation", "กรุณาตรวจสอบข้อมูล Routine", errors);
      const id = rpcId(await this.client.request<unknown>({ method: "POST", path: "rpc/planning_create_routine", body: { p_name: draft.name.trim(), p_weekly_frequency_target: draft.weeklyFrequencyTarget, p_days: routinePayload(draft) } }));
      const created = await this.getRoutine(id);
      if (!created) throw new PlanningRepositoryError("unknown", "สร้าง Routine แล้วแต่โหลดข้อมูลกลับไม่สำเร็จ");
      return created;
    } catch (error) {
      throw mapError(error, "สร้าง Routine ไม่สำเร็จ");
    }
  }

  async updateRoutine(id: string, expectedRevision: number, draft: RoutineDraft): Promise<Routine> {
    try {
      const errors = validateRoutineDraft(draft);
      if (hasPlanningValidationErrors(errors)) throw new PlanningRepositoryError("validation", "กรุณาตรวจสอบข้อมูล Routine", errors);
      const updatedId = rpcId(await this.client.request<unknown>({ method: "POST", path: "rpc/planning_update_routine", body: { p_id: id, p_expected_revision: expectedRevision, p_name: draft.name.trim(), p_weekly_frequency_target: draft.weeklyFrequencyTarget, p_days: routinePayload(draft) } }));
      const updated = await this.getRoutine(updatedId);
      if (!updated) throw new PlanningRepositoryError("unknown", "แก้ไข Routine แล้วแต่โหลดข้อมูลกลับไม่สำเร็จ");
      return updated;
    } catch (error) {
      throw mapError(error, "แก้ไข Routine ไม่สำเร็จ");
    }
  }

  async activateRoutine(id: string, expectedRevision: number): Promise<Routine> {
    try {
      const activatedId = rpcId(await this.client.request<unknown>({ method: "POST", path: "rpc/planning_activate_routine", body: { p_id: id, p_expected_revision: expectedRevision } }));
      const routine = await this.getRoutine(activatedId);
      if (!routine) throw new PlanningRepositoryError("unknown", "เปิดใช้งาน Routine แล้วแต่โหลดข้อมูลกลับไม่สำเร็จ");
      return routine;
    } catch (error) {
      throw mapError(error, "เปิดใช้งาน Routine ไม่สำเร็จ");
    }
  }

  async archiveRoutine(id: string, expectedRevision: number): Promise<void> {
    try {
      await this.client.request({ method: "POST", path: "rpc/planning_archive_routine", body: { p_id: id, p_expected_revision: expectedRevision } });
    } catch (error) {
      throw mapError(error, "Archive Routine ไม่สำเร็จ");
    }
  }

  async getActiveRoutinePreview(): Promise<ActiveRoutinePreview | null> {
    try {
      const active = (await this.listRoutines()).find((routine) => routine.isActive);
      if (!active || active.days.length === 0) return null;
      const nextDay = active.days[Math.min(active.nextWorkoutIndex, active.days.length - 1)];
      const template = await this.getTemplate(nextDay.templateId);
      if (!template) throw new PlanningRepositoryError("not-found", "ไม่พบ Template ของ Routine ที่เปิดใช้งาน");
      return {
        routineId: active.id,
        routineName: active.name,
        weeklyFrequencyTarget: active.weeklyFrequencyTarget,
        nextWorkoutIndex: active.nextWorkoutIndex,
        dayCount: active.days.length,
        dayLabel: nextDay.label || `Day ${nextDay.sequence}`,
        template,
      };
    } catch (error) {
      throw mapError(error, "โหลด Today's Workout ไม่สำเร็จ");
    }
  }
}

class UnconfiguredPlanningRepository implements PlanningRepository {
  private readonly error = new PlanningRepositoryError("unknown", "ยังไม่ได้ตั้งค่า Supabase กรุณาตรวจสอบ .env.local");
  listTemplates(): Promise<WorkoutTemplateSummary[]> { return Promise.reject(this.error); }
  getTemplate(): Promise<WorkoutTemplate | null> { return Promise.reject(this.error); }
  createTemplate(): Promise<WorkoutTemplate> { return Promise.reject(this.error); }
  updateTemplate(): Promise<WorkoutTemplate> { return Promise.reject(this.error); }
  duplicateTemplate(): Promise<WorkoutTemplate> { return Promise.reject(this.error); }
  archiveTemplate(): Promise<void> { return Promise.reject(this.error); }
  listRoutines(): Promise<Routine[]> { return Promise.reject(this.error); }
  getRoutine(): Promise<Routine | null> { return Promise.reject(this.error); }
  createRoutine(): Promise<Routine> { return Promise.reject(this.error); }
  updateRoutine(): Promise<Routine> { return Promise.reject(this.error); }
  activateRoutine(): Promise<Routine> { return Promise.reject(this.error); }
  archiveRoutine(): Promise<void> { return Promise.reject(this.error); }
  getActiveRoutinePreview(): Promise<ActiveRoutinePreview | null> { return Promise.reject(this.error); }
}

export function createSupabasePlanningRepository(): PlanningRepository {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return new UnconfiguredPlanningRepository();
  return new SupabasePlanningRepository(new SupabaseRestClient({ url, anonKey }));
}
