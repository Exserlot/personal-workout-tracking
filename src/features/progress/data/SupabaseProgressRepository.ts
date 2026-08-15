import { SupabaseRequestError, SupabaseRestClient, type SupabaseDataClient } from "../../../lib/supabase/SupabaseRestClient";
import {
  ProgressRepositoryError,
  type ExerciseProgressDetail,
  type ExerciseProgressQuery,
  type ProgressExercisePage,
  type ProgressExerciseQuery,
  type ProgressExerciseSummary,
  type ProgressOverview,
  type ProgressRecord,
  type ProgressRecordKind,
  type ProgressRepository,
  type ProgressTrendPoint,
  type RepsAtWeightRecord,
} from "../domain/progress";

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProgressRepositoryError("unknown", `${label} ไม่ถูกต้อง`);
  return value as JsonObject;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new ProgressRepositoryError("unknown", `${label} ไม่ใช่รายการ`);
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new ProgressRepositoryError("unknown", `${label} ไม่ถูกต้อง`);
  return value;
}

function number(value: unknown, label: string): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) throw new ProgressRepositoryError("unknown", `${label} ไม่ถูกต้อง`);
  return parsed;
}

function nullableNumber(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  return number(value, label);
}

function date(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (Number.isNaN(Date.parse(parsed))) throw new ProgressRepositoryError("unknown", `${label} ไม่ใช่วันที่`);
  return parsed;
}

function recordKind(value: unknown): ProgressRecordKind {
  if (value === "BEST_WEIGHT" || value === "BEST_REPS_AT_WEIGHT" || value === "ESTIMATED_1RM") return value;
  throw new ProgressRepositoryError("unknown", "ชนิด PR ไม่ถูกต้อง");
}

export function parseProgressRecord(value: unknown): ProgressRecord {
  const row = object(value, "PR");
  return {
    kind: recordKind(row.kind),
    exerciseId: string(row.exercise_id, "Exercise ID"),
    exerciseName: string(row.exercise_name, "ชื่อ Exercise"),
    sessionId: string(row.session_id, "Session ID"),
    setId: string(row.set_id, "Set ID"),
    achievedAt: date(row.achieved_at, "เวลา PR"),
    weightKg: number(row.weight_kg, "น้ำหนัก PR"),
    reps: number(row.reps, "จำนวน reps"),
    estimated1RmKg: nullableNumber(row.estimated_1rm_kg, "e1RM"),
    previousValue: nullableNumber(row.previous_value, "ค่าก่อนหน้า"),
  };
}

function parseTrendPoint(value: unknown): ProgressTrendPoint {
  const row = object(value, "Trend point");
  return {
    sessionId: string(row.session_id, "Session ID"),
    completedAt: date(row.completed_at, "วันที่ฝึก"),
    volumeKg: number(row.volume_kg, "Volume"),
    bestWeightKg: number(row.best_weight_kg, "Best weight"),
    bestReps: number(row.best_reps, "Best reps"),
    bestEstimated1RmKg: nullableNumber(row.best_estimated_1rm_kg, "Best e1RM"),
  };
}

function parseExerciseSummary(value: unknown): ProgressExerciseSummary {
  const row = object(value, "Exercise summary");
  return {
    exerciseId: string(row.exercise_id, "Exercise ID"),
    exerciseName: string(row.exercise_name, "ชื่อ Exercise"),
    lastTrainedAt: date(row.last_trained_at, "วันที่ฝึกล่าสุด"),
    sessionCount: number(row.session_count, "จำนวน Session"),
    workingSetCount: number(row.working_set_count, "จำนวน Working Set"),
    allTimeBestWeightKg: number(row.all_time_best_weight_kg, "Best weight"),
    allTimeBestEstimated1RmKg: nullableNumber(row.all_time_best_estimated_1rm_kg, "Best e1RM"),
    latestSessionVolumeKg: number(row.latest_session_volume_kg, "Latest volume"),
  };
}

function mapError(error: unknown, fallback: string): ProgressRepositoryError {
  if (error instanceof ProgressRepositoryError) return error;
  if (error instanceof SupabaseRequestError) {
    const payload = error.payload && typeof error.payload === "object" ? error.payload as JsonObject : {};
    const message = typeof payload.message === "string" ? payload.message : "";
    if (error.status === 401 || error.status === 403) return new ProgressRepositoryError("authorization", "กรุณาเข้าสู่ระบบเพื่อดู Progress");
    if (error.status === 404 || message.includes("not_found")) return new ProgressRepositoryError("not-found", "ไม่พบข้อมูล Progress");
    if (error.status >= 500) return new ProgressRepositoryError("server", "ฐานข้อมูลขัดข้องชั่วคราว");
  }
  if (error instanceof TypeError || (error instanceof Error && /fetch|network|offline/i.test(error.message))) {
    return new ProgressRepositoryError("offline", "Progress ต้องเชื่อมต่ออินเทอร์เน็ต");
  }
  return new ProgressRepositoryError("unknown", fallback);
}

export class SupabaseProgressRepository implements ProgressRepository {
  constructor(private readonly client: SupabaseDataClient) {}

  async getOverview(): Promise<ProgressOverview> {
    try {
      const root = object(await this.client.request({ method: "POST", path: "rpc/progress_get_overview", body: {} }), "Progress overview");
      const stats = object(root.stats, "Progress stats");
      const featured = root.featured_exercise === null ? null : object(root.featured_exercise, "Featured Exercise");
      return {
        sourceRevision: number(root.source_revision, "Source revision"),
        stats: {
          trackedExerciseCount: number(stats.tracked_exercise_count, "Tracked Exercises"),
          recentSessionCount: number(stats.recent_session_count, "Recent Sessions"),
          recentVolumeKg: number(stats.recent_volume_kg, "Recent Volume"),
          recentPrCount: number(stats.recent_pr_count, "Recent PR"),
        },
        recentRecords: array(root.recent_records, "Recent PR").map(parseProgressRecord),
        featuredExercise: featured ? {
          exerciseId: string(featured.exercise_id, "Exercise ID"),
          exerciseName: string(featured.exercise_name, "ชื่อ Exercise"),
          lastTrainedAt: date(featured.last_trained_at, "วันที่ฝึกล่าสุด"),
          trend: array(featured.trend, "Featured trend").map(parseTrendPoint),
        } : null,
      };
    } catch (error) {
      throw mapError(error, "โหลดภาพรวม Progress ไม่สำเร็จ");
    }
  }

  async listExercises(query: ProgressExerciseQuery): Promise<ProgressExercisePage> {
    try {
      const root = object(await this.client.request({
        method: "POST",
        path: "rpc/progress_list_exercises",
        body: {
          p_search: query.search.trim() || null,
          p_cursor_last_trained_at: query.cursor?.lastTrainedAt ?? null,
          p_cursor_exercise_id: query.cursor?.exerciseId ?? null,
          p_limit: query.limit,
        },
      }), "Exercise Progress list");
      const cursor = root.next_cursor === null ? null : object(root.next_cursor, "Progress cursor");
      return {
        sourceRevision: number(root.source_revision, "Source revision"),
        items: array(root.items, "Exercise Progress").map(parseExerciseSummary),
        nextCursor: cursor ? {
          lastTrainedAt: date(cursor.last_trained_at, "Cursor date"),
          exerciseId: string(cursor.exercise_id, "Cursor Exercise ID"),
        } : null,
      };
    } catch (error) {
      throw mapError(error, "โหลดรายการ Exercise Progress ไม่สำเร็จ");
    }
  }

  async getExerciseDetail(input: ExerciseProgressQuery): Promise<ExerciseProgressDetail | null> {
    try {
      const response = await this.client.request({
        method: "POST",
        path: "rpc/progress_get_exercise_detail",
        body: { p_exercise_id: input.exerciseId, p_from: input.from, p_to: input.to, p_point_limit: input.pointLimit },
      });
      if (response === null) return null;
      const root = object(response, "Exercise Progress detail");
      const metrics = object(root.metrics, "Progress metrics");
      return {
        sourceRevision: number(root.source_revision, "Source revision"),
        exerciseId: string(root.exercise_id, "Exercise ID"),
        exerciseName: string(root.exercise_name, "ชื่อ Exercise"),
        metrics: {
          sessionCount: number(metrics.session_count, "Session count"),
          workingSetCount: number(metrics.working_set_count, "Working Set count"),
          bestWeightKg: number(metrics.best_weight_kg, "Best weight"),
          bestReps: number(metrics.best_reps, "Best reps"),
          bestRepsWeightKg: number(metrics.best_reps_weight_kg, "Best reps weight"),
          bestEstimated1RmKg: nullableNumber(metrics.best_estimated_1rm_kg, "Best e1RM"),
          totalVolumeKg: number(metrics.total_volume_kg, "Total volume"),
        },
        trend: array(root.trend, "Progress trend").map(parseTrendPoint),
        allTimeRecords: array(root.all_time_records, "All-time records").map(parseProgressRecord),
        repsAtWeight: array(root.reps_at_weight, "Reps at weight").map((value): RepsAtWeightRecord => {
          const row = object(value, "Reps at weight");
          return { weightKg: number(row.weight_kg, "Weight"), reps: number(row.reps, "Reps"), sessionId: string(row.session_id, "Session ID"), setId: string(row.set_id, "Set ID"), achievedAt: date(row.achieved_at, "วันที่ทำสถิติ") };
        }),
        hasPositiveWeight: root.has_positive_weight === true,
        truncated: root.truncated === true,
      };
    } catch (error) {
      throw mapError(error, "โหลด Exercise Progress ไม่สำเร็จ");
    }
  }

  async listSessionRecords(sessionId: string): Promise<ProgressRecord[]> {
    try {
      const root = object(await this.client.request({ method: "POST", path: "rpc/progress_list_session_records", body: { p_session_id: sessionId } }), "Session PR");
      return array(root.records, "Session PR").map(parseProgressRecord);
    } catch (error) {
      throw mapError(error, "โหลด PR ของ Session ไม่สำเร็จ");
    }
  }
}

class UnconfiguredProgressRepository implements ProgressRepository {
  private readonly error = new ProgressRepositoryError("unknown", "ยังไม่ได้ตั้งค่า Supabase กรุณาตรวจสอบ .env.local");
  getOverview(): Promise<never> { return Promise.reject(this.error); }
  listExercises(): Promise<never> { return Promise.reject(this.error); }
  getExerciseDetail(): Promise<never> { return Promise.reject(this.error); }
  listSessionRecords(): Promise<never> { return Promise.reject(this.error); }
}

export function createSupabaseProgressRepository(client?: SupabaseDataClient): ProgressRepository {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!client && (!url || !anonKey)) return new UnconfiguredProgressRepository();
  return new SupabaseProgressRepository(client ?? new SupabaseRestClient({ url, anonKey }));
}
