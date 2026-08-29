import {
  WorkoutRepositoryError,
  type EffortMetric,
  type EffortValue,
  type PreviousExerciseValues,
  type SessionExercise,
  type SessionMuscle,
  type SessionSet,
  type SessionSetKind,
  type SessionSetStatus,
  type StartAdHocInput,
  type StartPlannedInput,
  type WeightUnit,
  type WorkoutCommand,
  type OfflineWorkoutCommand,
  type WorkoutCompletionSummary,
  type WorkoutDevice,
  type WorkoutRepository,
  type WorkoutSession,
  completionSummaryFromSession,
} from "../domain/workout";
import {
  SupabaseRequestError,
  type SupabaseDataClient,
} from "../../../lib/supabase/SupabaseRestClient";

type RecordValue = Record<string, unknown>;

export const WORKOUT_SESSION_SELECT = [
  "id",
  "owner_device_id",
  "source_type",
  "source_routine_id",
  "source_routine_day_id",
  "source_routine_week_plan_id",
  "source_routine_week_plan_day_id",
  "source_template_id",
  "source_routine_revision",
  "source_template_revision",
  "routine_name_snapshot",
  "day_label_snapshot",
  "template_name_snapshot",
  "status",
  "started_at",
  "completed_at",
  "notes",
  "version",
  "edited_at",
  "deleted_at",
  "workout_session_exercises(id,source_template_exercise_id,source_exercise_id,sequence_no,exercise_name_snapshot,equipment_code_snapshot,notes,workout_session_exercise_muscles(role,sequence_no,muscle_name_snapshot),workout_session_sets(id,source_template_set_id,sequence_no,set_kind_code,is_to_failure,target_reps_min,target_reps_max,target_weight_value,target_weight_unit,target_weight_kg,target_effort_metric,target_effort_value,target_rest_seconds,actual_weight_value,actual_weight_unit,actual_weight_kg,actual_reps,actual_effort_metric,actual_effort_value,actual_rest_seconds,status,completed_at,notes))",
].join(",");

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkoutRepositoryError("unknown", `Workout response missing ${field}`);
  return value as RecordValue;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new WorkoutRepositoryError("unknown", `Workout response has invalid ${field}`);
  return value;
}

function stringValue(value: unknown, field: string, nullable = false): string | null {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== "string" || !value.trim()) throw new WorkoutRepositoryError("unknown", `Workout response has invalid ${field}`);
  return value;
}

function integer(value: unknown, field: string, minimum = 0, nullable = false): number | null {
  if (nullable && (value === null || value === undefined)) return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < minimum) throw new WorkoutRepositoryError("unknown", `Workout response has invalid ${field}`);
  return parsed;
}

function decimal(value: unknown, field: string, nullable = false): number | null {
  if (nullable && (value === null || value === undefined)) return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) throw new WorkoutRepositoryError("unknown", `Workout response has invalid ${field}`);
  return parsed;
}

function effort(metric: unknown, value: unknown, field: string): EffortValue | null {
  const parsedMetric = stringValue(metric, `${field}.metric`, true);
  const parsedValue = decimal(value, `${field}.value`, true);
  if (parsedMetric === null && parsedValue === null) return null;
  if (parsedMetric !== "RPE" && parsedMetric !== "RIR" || parsedValue === null) throw new WorkoutRepositoryError("unknown", `Workout response has invalid ${field}`);
  if (parsedMetric === "RPE" && (parsedValue < 1 || parsedValue > 10 || !Number.isInteger(parsedValue * 2))) throw new WorkoutRepositoryError("unknown", `Workout response has invalid ${field}`);
  if (parsedMetric === "RIR" && (parsedValue < 0 || parsedValue > 10 || !Number.isInteger(parsedValue))) throw new WorkoutRepositoryError("unknown", `Workout response has invalid ${field}`);
  return { metric: parsedMetric as EffortMetric, value: parsedValue };
}

function weight(value: unknown, unit: unknown, kg: unknown, field: string): WorkoutSession["exercises"][number]["sets"][number]["actualWeight"] {
  const parsedValue = decimal(value, `${field}.value`, true);
  const parsedUnit = stringValue(unit, `${field}.unit`, true);
  const parsedKg = decimal(kg, `${field}.kg`, true);
  if (parsedValue === null && parsedUnit === null && parsedKg === null) return null;
  if (parsedValue === null || parsedKg === null || (parsedUnit !== "KG" && parsedUnit !== "LB")) throw new WorkoutRepositoryError("unknown", `Workout response has invalid ${field}`);
  if (parsedValue < 0 || parsedKg < 0) throw new WorkoutRepositoryError("unknown", `Workout response has invalid ${field}`);
  const expectedKg = Math.round((parsedUnit === "LB" ? parsedValue * 0.45359237 : parsedValue) * 10000) / 10000;
  if (parsedKg !== expectedKg) throw new WorkoutRepositoryError("unknown", `Workout response has invalid ${field} canonical value`);
  return { value: parsedValue, unit: parsedUnit as WeightUnit, kg: parsedKg };
}

function parseMuscles(value: unknown): SessionMuscle[] {
  return array(value, "workout_session_exercise_muscles").map((item) => {
    const row = record(item, "session muscle");
    const role = stringValue(row.role, "role");
    if (role !== "PRIMARY" && role !== "SECONDARY") throw new WorkoutRepositoryError("unknown", "Workout response has invalid muscle role");
    return {
      role: role as SessionMuscle["role"],
      sequence: integer(row.sequence_no, "sequence_no", 1) as number,
      name: stringValue(row.muscle_name_snapshot, "muscle_name_snapshot") as string,
    };
  }).sort((a, b) => a.role.localeCompare(b.role) || a.sequence - b.sequence);
}

function parseSet(value: unknown): SessionSet {
  const row = record(value, "session set");
  const kind = stringValue(row.set_kind_code, "set_kind_code");
  const status = stringValue(row.status, "status");
  if (!["WARM_UP", "WORKING", "DROP"].includes(kind as string)) throw new WorkoutRepositoryError("unknown", "Workout response has invalid set kind");
  if (!["PENDING", "COMPLETED", "SKIPPED"].includes(status as string)) throw new WorkoutRepositoryError("unknown", "Workout response has invalid set status");
  return {
    id: stringValue(row.id, "id") as string,
    sourceTemplateSetId: stringValue(row.source_template_set_id, "source_template_set_id", true),
    sequence: integer(row.sequence_no, "sequence_no", 1) as number,
    kind: kind as SessionSetKind,
    isToFailure: row.is_to_failure === true,
    targetRepsMin: integer(row.target_reps_min, "target_reps_min", 1, true),
    targetRepsMax: integer(row.target_reps_max, "target_reps_max", 1, true),
    targetWeight: weight(row.target_weight_value, row.target_weight_unit, row.target_weight_kg, "targetWeight"),
    targetEffort: effort(row.target_effort_metric, row.target_effort_value, "targetEffort"),
    targetRestSeconds: integer(row.target_rest_seconds, "target_rest_seconds", 0) as number,
    actualWeight: weight(row.actual_weight_value, row.actual_weight_unit, row.actual_weight_kg, "actualWeight"),
    actualReps: integer(row.actual_reps, "actual_reps", 1, true),
    actualEffort: effort(row.actual_effort_metric, row.actual_effort_value, "actualEffort"),
    actualRestSeconds: integer(row.actual_rest_seconds, "actual_rest_seconds", 0, true),
    status: status as SessionSetStatus,
    completedAt: stringValue(row.completed_at, "completed_at", true),
    notes: typeof row.notes === "string" ? row.notes : "",
  };
}

function parseExercise(value: unknown): SessionExercise {
  const row = record(value, "session exercise");
  return {
    id: stringValue(row.id, "id") as string,
    sourceTemplateExerciseId: stringValue(row.source_template_exercise_id, "source_template_exercise_id", true),
    sourceExerciseId: stringValue(row.source_exercise_id, "source_exercise_id", true),
    sequence: integer(row.sequence_no, "sequence_no", 1) as number,
    name: stringValue(row.exercise_name_snapshot, "exercise_name_snapshot") as string,
    equipmentCode: stringValue(row.equipment_code_snapshot, "equipment_code_snapshot", true),
    muscles: parseMuscles(row.workout_session_exercise_muscles),
    notes: typeof row.notes === "string" ? row.notes : "",
    sets: array(row.workout_session_sets, "workout_session_sets").map(parseSet).sort((a, b) => a.sequence - b.sequence),
  };
}

export function parseWorkoutSession(value: unknown): WorkoutSession {
  const row = record(value, "session");
  const sourceType = stringValue(row.source_type, "source_type");
  const status = stringValue(row.status, "status");
  if (sourceType !== "PLANNED" && sourceType !== "AD_HOC") throw new WorkoutRepositoryError("unknown", "Workout response has invalid source type");
  if (!["ACTIVE", "COMPLETED", "DISCARDED"].includes(status as string)) throw new WorkoutRepositoryError("unknown", "Workout response has invalid session status");
  return {
    id: stringValue(row.id, "id") as string,
    ownerDeviceId: stringValue(row.owner_device_id, "owner_device_id") as string,
    sourceType,
    sourceRoutineId: stringValue(row.source_routine_id, "source_routine_id", true),
    sourceRoutineDayId: stringValue(row.source_routine_day_id, "source_routine_day_id", true),
    sourceRoutineWeekPlanId: stringValue(row.source_routine_week_plan_id, "source_routine_week_plan_id", true),
    sourceRoutineWeekPlanDayId: stringValue(row.source_routine_week_plan_day_id, "source_routine_week_plan_day_id", true),
    sourceTemplateId: stringValue(row.source_template_id, "source_template_id", true),
    sourceRoutineRevision: integer(row.source_routine_revision, "source_routine_revision", 1, true),
    sourceTemplateRevision: integer(row.source_template_revision, "source_template_revision", 1, true),
    routineNameSnapshot: stringValue(row.routine_name_snapshot, "routine_name_snapshot", true),
    dayLabelSnapshot: stringValue(row.day_label_snapshot, "day_label_snapshot", true),
    templateNameSnapshot: stringValue(row.template_name_snapshot, "template_name_snapshot", true),
    status: status as WorkoutSession["status"],
    startedAt: stringValue(row.started_at, "started_at") as string,
    completedAt: stringValue(row.completed_at, "completed_at", true),
    notes: typeof row.notes === "string" ? row.notes : "",
    version: integer(row.version, "version", 1) as number,
    editedAt: stringValue(row.edited_at, "edited_at", true),
    deletedAt: stringValue(row.deleted_at, "deleted_at", true),
    exercises: array(row.workout_session_exercises, "workout_session_exercises").map(parseExercise).sort((a, b) => a.sequence - b.sequence),
  };
}

function parseRows(value: unknown): unknown[] {
  return array(value, "rows");
}

function rpcId(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) return rpcId(value[0]);
  const row = value && typeof value === "object" ? value as RecordValue : null;
  if (row && typeof row.id === "string") return row.id;
  throw new WorkoutRepositoryError("unknown", "Workout mutation did not return an id");
}

function rpcVersion(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && Number.isInteger(Number(value))) return Number(value);
  if (Array.isArray(value)) return rpcVersion(value[0]);
  const row = value && typeof value === "object" ? value as RecordValue : null;
  if (row && "result_version" in row) return rpcVersion(row.result_version);
  throw new WorkoutRepositoryError("unknown", "Workout mutation did not return a valid version");
}

function mapError(error: unknown, fallback: string): WorkoutRepositoryError {
  if (error instanceof WorkoutRepositoryError) return error;
  if (error instanceof SupabaseRequestError) {
    const payload = error.payload && typeof error.payload === "object" ? error.payload as RecordValue : null;
    if (error.status >= 500) return new WorkoutRepositoryError("server", "Supabase ขัดข้องชั่วคราว การบันทึกจะลองใหม่อัตโนมัติ");
    if (error.status === 401 || error.status === 403) return new WorkoutRepositoryError("authorization", "กรุณาเข้าสู่ระบบเพื่อบันทึก Workout");
    const code = typeof payload?.code === "string" ? payload.code : "";
    const message = typeof payload?.message === "string" ? payload.message : "";
    if (message === "session_not_active") return new WorkoutRepositoryError("conflict", "Session นี้ถูกปิดไปแล้วหรือมีการเปลี่ยนแปลงจากอุปกรณ์อื่น");
    if (message === "operation_id_conflict") return new WorkoutRepositoryError("conflict", "คิวการบันทึกนี้ไม่ตรงกับข้อมูลบน server และถูกหยุดไว้เพื่อป้องกันข้อมูลทับกัน");
    if (message === "active_session_exists" || code === "23505") return new WorkoutRepositoryError("active-exists", "มี Active Session อยู่แล้ว กรุณา Resume หรือ Discard ก่อน");
    if (message === "device_locked") return new WorkoutRepositoryError("device-locked", "Session นี้กำลังถูกใช้งานจากอุปกรณ์อื่น");
    if (message === "revision_conflict" || message === "active_routine_changed" || code === "40001") return new WorkoutRepositoryError("conflict", "ข้อมูล Session เปลี่ยนจากอุปกรณ์อื่น กรุณาโหลดใหม่");
    if (message.includes("not_found") || code === "P0002" || error.status === 404) return new WorkoutRepositoryError("not-found", "ไม่พบ Workout Session ที่ต้องการ");
    if (code === "22023" || code === "23514") return new WorkoutRepositoryError("validation", message || "ข้อมูล Workout ไม่ถูกต้อง");
    if (error.status === 401 || error.status === 403) return new WorkoutRepositoryError("unknown", "กรุณาเข้าสู่ระบบเพื่อบันทึก Workout");
  }
  if (error instanceof TypeError || (error instanceof Error && /fetch|network|offline/i.test(error.message))) return new WorkoutRepositoryError("offline", "ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณาลองใหม่เมื่อออนไลน์");
  return new WorkoutRepositoryError("unknown", fallback);
}

function commandPayload(command: WorkoutCommand | OfflineWorkoutCommand) {
  switch (command.action) {
    case "complete_set":
    case "edit_set":
      return {
        action: command.action,
        set_id: command.setId,
        actual_weight_value: command.actualWeight.value,
        actual_weight_unit: command.actualWeight.unit,
        actual_weight_kg: command.actualWeight.kg,
        actual_reps: command.actualReps,
        actual_effort_metric: command.actualEffort?.metric ?? null,
        actual_effort_value: command.actualEffort?.value ?? null,
      };
    case "skip_set":
    case "delete_set":
      return { action: command.action, set_id: command.setId };
    case "move_set":
      return { action: command.action, set_id: command.setId, sequence_no: command.sequence };
    case "add_set":
      return {
        action: command.action,
        session_exercise_id: command.sessionExerciseId,
        set_id: command.setId,
        sequence_no: command.sequence,
        set_kind_code: command.kind,
        target_reps_min: command.targetRepsMin,
        target_reps_max: command.targetRepsMax,
        target_weight_value: command.targetWeight?.value ?? null,
        target_weight_unit: command.targetWeight?.unit ?? null,
        target_weight_kg: command.targetWeight?.kg ?? null,
        target_effort_metric: command.targetEffort?.metric ?? null,
        target_effort_value: command.targetEffort?.value ?? null,
        target_rest_seconds: command.targetRestSeconds,
      };
    case "set_kind":
      return { action: command.action, set_id: command.setId, set_kind_code: command.kind };
    case "add_exercise":
      return { action: command.action, session_exercise_id: command.sessionExerciseId, exercise_id: command.exerciseId, sequence_no: command.sequence, set_id: command.setId, notes: command.notes };
    case "remove_exercise":
      return { action: command.action, session_exercise_id: command.sessionExerciseId };
    case "move_exercise":
      return { action: command.action, session_exercise_id: command.sessionExerciseId, sequence_no: command.sequence };
    case "update_session_notes":
      return { action: command.action, notes: command.notes };
    case "update_exercise_notes":
      return { action: command.action, session_exercise_id: command.sessionExerciseId, notes: command.notes };
    case "finish_session":
    case "discard_session":
      return { action: command.action };
  }
}

export class SupabaseWorkoutRepository implements WorkoutRepository {
  constructor(private readonly client: SupabaseDataClient) {}

  private async getSessionById(sessionId: string): Promise<WorkoutSession | null> {
    const params = new URLSearchParams({ select: WORKOUT_SESSION_SELECT, id: `eq.${sessionId}`, limit: "1" });
    const rows = parseRows(await this.client.request<unknown[]>({ method: "GET", path: `workout_sessions?${params.toString()}` }));
    return rows.length === 0 ? null : parseWorkoutSession(rows[0]);
  }

  async registerDevice(deviceId: string, label = "This browser"): Promise<WorkoutDevice> {
    try {
      const id = rpcId(await this.client.request<unknown>({ method: "POST", path: "rpc/workout_register_device", body: { p_device_id: deviceId, p_label: label } }));
      const params = new URLSearchParams({ select: "id,label,last_seen_at", id: `eq.${id}`, limit: "1" });
      const rows = parseRows(await this.client.request<unknown[]>({ method: "GET", path: `devices?${params.toString()}` }));
      const row = record(rows[0], "device");
      return { id: stringValue(row.id, "id") as string, label: stringValue(row.label, "label", true), lastSeenAt: stringValue(row.last_seen_at, "last_seen_at") as string };
    } catch (error) {
      throw mapError(error, "ลงทะเบียนอุปกรณ์ไม่สำเร็จ");
    }
  }

  async listDevices(): Promise<WorkoutDevice[]> {
    try {
      const params = new URLSearchParams({ select: "id,label,last_seen_at,revoked_at", order: "last_seen_at.desc" });
      const rows = parseRows(await this.client.request<unknown[]>({ method: "GET", path: `devices?${params.toString()}` }));
      return rows.map((value) => {
        const row = record(value, "device");
        if (row.revoked_at !== null && row.revoked_at !== undefined) throw new WorkoutRepositoryError("unknown", "Workout response has revoked device");
        return {
          id: stringValue(row.id, "id") as string,
          label: stringValue(row.label, "label", true),
          lastSeenAt: stringValue(row.last_seen_at, "last_seen_at") as string,
        };
      });
    } catch (error) {
      throw mapError(error, "โหลดอุปกรณ์ไม่สำเร็จ");
    }
  }

  async getActiveSession(deviceId: string): Promise<WorkoutSession | null> {
    void deviceId;
    try {
      const params = new URLSearchParams({ select: WORKOUT_SESSION_SELECT, status: "eq.ACTIVE", deleted_at: "is.null", order: "started_at.desc", limit: "1" });
      const rows = parseRows(await this.client.request<unknown[]>({ method: "GET", path: `workout_sessions?${params.toString()}` }));
      return rows.length === 0 ? null : parseWorkoutSession(rows[0]);
    } catch (error) {
      throw mapError(error, "โหลด Active Workout ไม่สำเร็จ");
    }
  }

  async getSession(sessionId: string, deviceId: string): Promise<WorkoutSession | null> {
    void deviceId;
    try {
      return await this.getSessionById(sessionId);
    } catch (error) {
      throw mapError(error, "โหลด Workout Session ไม่สำเร็จ");
    }
  }

  async getPreviousValues(exerciseIds: string[]): Promise<Record<string, PreviousExerciseValues>> {
    if (exerciseIds.length === 0) return {};
    try {
      const params = new URLSearchParams({
        select: "source_exercise_id,workout_sessions!inner(started_at,status,deleted_at),workout_session_sets(actual_weight_value,actual_weight_unit,actual_weight_kg,actual_reps,actual_effort_metric,actual_effort_value,completed_at,set_kind_code,status)",
        source_exercise_id: `in.(${exerciseIds.join(",")})`,
        "workout_sessions.status": "eq.COMPLETED",
        "workout_sessions.deleted_at": "is.null",
      });
      const rows = parseRows(await this.client.request<unknown[]>({ method: "GET", path: `workout_session_exercises?${params.toString()}` }));
      const result: Record<string, PreviousExerciseValues & { startedAt?: string }> = {};
      for (const value of rows) {
        const row = record(value, "previous exercise");
        const exerciseId = stringValue(row.source_exercise_id, "source_exercise_id", true);
        const session = record(row.workout_sessions, "workout_sessions");
        if (!exerciseId || typeof session.started_at !== "string") continue;
        const existing = result[exerciseId];
        if (existing?.startedAt && existing.startedAt >= session.started_at) continue;
        const sets = array(row.workout_session_sets, "workout_session_sets").map((item) => record(item, "previous set")).filter((item) => item.status === "COMPLETED" && item.set_kind_code === "WORKING").sort((a, b) => Date.parse(String(a.completed_at ?? "")) - Date.parse(String(b.completed_at ?? "")));
        const last = sets.at(-1);
        result[exerciseId] = {
          weight: last ? weight(last.actual_weight_value, last.actual_weight_unit, last.actual_weight_kg, "previousWeight") : null,
          reps: last ? integer(last.actual_reps, "actual_reps", 1, true) : null,
          effort: last ? effort(last.actual_effort_metric, last.actual_effort_value, "previousEffort") : null,
          completedAt: last ? stringValue(last.completed_at, "completed_at", true) : null,
          startedAt: session.started_at,
        };
      }
      return result;
    } catch (error) {
      throw mapError(error, "โหลด previous values ไม่สำเร็จ");
    }
  }

  async startPlanned(input: StartPlannedInput): Promise<WorkoutSession> {
    try {
      const id = rpcId(await this.client.request<unknown>({ method: "POST", path: "rpc/workout_start_planned", body: { p_session_id: input.sessionId, p_device_id: input.deviceId, p_week_plan_id: input.routineWeekPlanId, p_week_plan_day_id: input.routineWeekPlanDayId, p_expected_template_revision: input.templateRevision } }));
      const session = await this.getSessionById(id);
      if (!session) throw new WorkoutRepositoryError("unknown", "สร้าง Workout Session แล้วแต่โหลด snapshot ไม่สำเร็จ");
      return session;
    } catch (error) {
      throw mapError(error, "เริ่ม Planned Workout ไม่สำเร็จ");
    }
  }

  async startAdHoc(input: StartAdHocInput): Promise<WorkoutSession> {
    try {
      const id = rpcId(await this.client.request<unknown>({ method: "POST", path: "rpc/workout_start_adhoc", body: { p_session_id: input.sessionId, p_device_id: input.deviceId, p_template_id: input.templateId, p_expected_template_revision: input.templateRevision ?? null, p_name: input.name ?? null } }));
      const session = await this.getSessionById(id);
      if (!session) throw new WorkoutRepositoryError("unknown", "สร้าง Ad-hoc Workout แล้วแต่โหลด snapshot ไม่สำเร็จ");
      return session;
    } catch (error) {
      throw mapError(error, "เริ่ม Ad-hoc Workout ไม่สำเร็จ");
    }
  }

  async applyCommand(sessionId: string, deviceId: string, expectedVersion: number, command: WorkoutCommand): Promise<WorkoutSession> {
    try {
      await this.client.request({ method: "POST", path: "rpc/workout_apply_command", body: { p_session_id: sessionId, p_device_id: deviceId, p_expected_version: expectedVersion, p_command: commandPayload(command) } });
      const session = await this.getSessionById(sessionId);
      if (!session) throw new WorkoutRepositoryError("not-found", "ไม่พบ Session หลังบันทึก");
      return session;
    } catch (error) {
      throw mapError(error, "บันทึก Workout ไม่สำเร็จ");
    }
  }

  async applyIdempotentCommand(input: { operationId: string; sessionId: string; deviceId: string; expectedVersion: number; command: OfflineWorkoutCommand }): Promise<WorkoutSession> {
    try {
      const resultVersion = rpcVersion(await this.client.request<unknown>({
        method: "POST",
        path: "rpc/workout_apply_command_idempotent",
        body: {
          p_operation_id: input.operationId,
          p_session_id: input.sessionId,
          p_device_id: input.deviceId,
          p_expected_version: input.expectedVersion,
          p_command: commandPayload(input.command),
        },
      }));
      let session: WorkoutSession | null;
      try {
        session = await this.getSessionById(input.sessionId);
      } catch (error) {
        // The RPC may already have committed. Keep the operation retryable so
        // the same receipt can be used when the acknowledgement read fails.
        throw mapError(error, "บันทึกสำเร็จแต่โหลด Session ที่ยืนยันแล้วไม่สำเร็จ");
      }
      if (!session || session.version < resultVersion) {
        throw new WorkoutRepositoryError("server", "บันทึกสำเร็จแต่ยังโหลด Session ที่ยืนยันแล้วไม่ได้");
      }
      return session;
    } catch (error) {
      throw mapError(error, "ซิงก์การบันทึก Set ไม่สำเร็จ");
    }
  }

  async finishSession(sessionId: string, deviceId: string, expectedVersion: number): Promise<WorkoutSession> {
    try {
      const id = rpcId(await this.client.request<unknown>({ method: "POST", path: "rpc/workout_finish_session", body: { p_session_id: sessionId, p_device_id: deviceId, p_expected_version: expectedVersion } }));
      const session = await this.getSessionById(id);
      if (!session) throw new WorkoutRepositoryError("not-found", "ไม่พบ Session หลัง Finish");
      return session;
    } catch (error) {
      throw mapError(error, "Finish Workout ไม่สำเร็จ");
    }
  }

  async discardSession(sessionId: string, deviceId: string, expectedVersion: number): Promise<void> {
    try {
      await this.client.request({ method: "POST", path: "rpc/workout_discard_session", body: { p_session_id: sessionId, p_device_id: deviceId, p_expected_version: expectedVersion } });
    } catch (error) {
      throw mapError(error, "Discard Workout ไม่สำเร็จ");
    }
  }

  async remoteAbandonSession(input: { operationId: string; sessionId: string; expectedVersion: number }): Promise<WorkoutSession> {
    try {
      const resultVersion = rpcVersion(await this.client.request<unknown>({
        method: "POST",
        path: "rpc/workout_remote_abandon_session",
        body: {
          p_operation_id: input.operationId,
          p_session_id: input.sessionId,
          p_expected_version: input.expectedVersion,
        },
      }));
      const session = await this.getSessionById(input.sessionId);
      if (!session || session.version < resultVersion) throw new WorkoutRepositoryError("server", "Abandon สำเร็จแต่โหลด Session ยืนยันไม่ได้");
      return session;
    } catch (error) {
      throw mapError(error, "Abandon Server Session ไม่สำเร็จ");
    }
  }

  async transferSessionOwnership(input: { operationId: string; sessionId: string; targetDeviceId: string; expectedVersion: number }): Promise<WorkoutSession> {
    try {
      const resultVersion = rpcVersion(await this.client.request<unknown>({
        method: "POST",
        path: "rpc/workout_transfer_session_ownership",
        body: {
          p_operation_id: input.operationId,
          p_session_id: input.sessionId,
          p_to_device_id: input.targetDeviceId,
          p_expected_version: input.expectedVersion,
        },
      }));
      const session = await this.getSessionById(input.sessionId);
      if (!session || session.version < resultVersion || session.ownerDeviceId !== input.targetDeviceId) {
        throw new WorkoutRepositoryError("server", "ย้าย Session สำเร็จแต่โหลดสิทธิ์ล่าสุดไม่ได้");
      }
      return session;
    } catch (error) {
      throw mapError(error, "ย้าย Session มาที่อุปกรณ์นี้ไม่สำเร็จ");
    }
  }

  async getCompletionSummary(sessionId: string): Promise<WorkoutCompletionSummary> {
    try {
      const session = await this.getSessionById(sessionId);
      if (!session || session.status !== "COMPLETED" || !session.completedAt) throw new WorkoutRepositoryError("not-found", "ไม่พบ Completed Session");
      return completionSummaryFromSession(session);
    } catch (error) {
      throw mapError(error, "คำนวณ Completion Summary ไม่สำเร็จ");
    }
  }
}
