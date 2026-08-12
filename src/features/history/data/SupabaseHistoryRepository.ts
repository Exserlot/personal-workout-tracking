import { SupabaseRestClient, type SupabaseDataClient } from "../../../lib/supabase/SupabaseRestClient";
import { SupabaseRequestError } from "../../../lib/supabase/SupabaseRestClient";
import { parseWorkoutSession, WORKOUT_SESSION_SELECT } from "../../workout/data/WorkoutRepository";
import type { WorkoutSession } from "../../workout/domain/workout";
import { HistoryRepositoryError, historySummaryFromSession, type HistoryDeleteInput, type HistoryPageResult, type HistoryQuery, type HistoryRepository, type HistoryUpdateInput } from "../domain/history";
import { historyListItemFromRow } from "./HistoryRepository";
import { cacheHistoryDetail, cacheHistoryPage, loadCachedHistory, loadCachedHistoryDetail, removeCachedHistory } from "./historyCache";

type RecordValue = Record<string, unknown>;

function authUserId(): string {
  if (typeof localStorage === "undefined") return "anonymous";
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.endsWith("-auth-token")) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null") as { user?: { id?: unknown }; access_token?: string } | null;
      if (typeof value?.user?.id === "string") return value.user.id;
      if (typeof value?.access_token === "string") {
        const payload = JSON.parse(atob(value.access_token.split(".")[1])) as { sub?: unknown };
        if (typeof payload.sub === "string") return payload.sub;
      }
    } catch { /* ignore unrelated auth values */ }
  }
  return "anonymous";
}

function rows(value: unknown): RecordValue[] {
  if (!Array.isArray(value)) throw new HistoryRepositoryError("unknown", "History response ไม่ใช่รายการ");
  return value.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new HistoryRepositoryError("unknown", "History response มีแถวไม่ถูกต้อง");
    return row as RecordValue;
  });
}

function rpcVersion(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && Number.isInteger(Number(value))) return Number(value);
  if (Array.isArray(value)) return rpcVersion(value[0]);
  if (value && typeof value === "object" && "result_version" in value) return rpcVersion((value as RecordValue).result_version);
  throw new HistoryRepositoryError("unknown", "History mutation ไม่คืน version");
}

function mapError(error: unknown, fallback: string): HistoryRepositoryError {
  if (error instanceof HistoryRepositoryError) return error;
  if (error instanceof SupabaseRequestError) {
    const payload = error.payload && typeof error.payload === "object" ? error.payload as RecordValue : {};
    const code = typeof payload.code === "string" ? payload.code : "";
    const message = typeof payload.message === "string" ? payload.message : "";
    if (error.status >= 500) return new HistoryRepositoryError("server", "ฐานข้อมูลขัดข้องชั่วคราว");
    if (error.status === 401 || error.status === 403) return new HistoryRepositoryError("authorization", "กรุณาเข้าสู่ระบบเพื่อดูประวัติ");
    if (code === "40001" || message === "revision_conflict") return new HistoryRepositoryError("conflict", "ข้อมูล Session เปลี่ยนจากหน้าต่างอื่น กรุณาโหลดใหม่");
    if (message.includes("not_found") || code === "P0002" || error.status === 404) return new HistoryRepositoryError("not-found", "ไม่พบ Workout Session");
    if (code === "22023" || code === "23514" || message.includes("invalid")) return new HistoryRepositoryError("validation", message || "ข้อมูล History ไม่ถูกต้อง");
  }
  if (error instanceof TypeError || (error instanceof Error && /fetch|network|offline/i.test(error.message))) return new HistoryRepositoryError("offline", "ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
  return new HistoryRepositoryError("unknown", fallback);
}

function setPayload(set: WorkoutSession["exercises"][number]["sets"][number]) {
  return {
    id: set.id,
    source_template_set_id: set.sourceTemplateSetId,
    sequence_no: set.sequence,
    set_kind_code: set.kind,
    is_to_failure: set.isToFailure,
    target_reps_min: set.targetRepsMin,
    target_reps_max: set.targetRepsMax,
    target_weight_value: set.targetWeight?.value ?? null,
    target_weight_unit: set.targetWeight?.unit ?? null,
    target_weight_kg: set.targetWeight?.kg ?? null,
    target_effort_metric: set.targetEffort?.metric ?? null,
    target_effort_value: set.targetEffort?.value ?? null,
    target_rest_seconds: set.targetRestSeconds,
    actual_weight_value: set.actualWeight?.value ?? null,
    actual_weight_unit: set.actualWeight?.unit ?? null,
    actual_weight_kg: set.actualWeight?.kg ?? null,
    actual_reps: set.actualReps,
    actual_effort_metric: set.actualEffort?.metric ?? null,
    actual_effort_value: set.actualEffort?.value ?? null,
    actual_rest_seconds: set.actualRestSeconds,
    status: set.status,
    completed_at: set.completedAt,
    notes: set.notes,
  };
}

function draftPayload(input: HistoryUpdateInput) {
  return {
    notes: input.draft.notes,
    exercises: input.draft.exercises.map((exercise) => ({
      id: exercise.id,
      source_exercise_id: exercise.sourceExerciseId,
      sequence_no: exercise.sequence,
      notes: exercise.notes,
      sets: exercise.sets.map(setPayload),
    })),
  };
}

export class SupabaseHistoryRepository implements HistoryRepository {
  constructor(private readonly client: SupabaseDataClient) {}

  private async getRemoteSession(sessionId: string): Promise<WorkoutSession | null> {
    const params = new URLSearchParams({ select: WORKOUT_SESSION_SELECT, id: `eq.${sessionId}`, deleted_at: "is.null", limit: "1" });
    const response = await this.client.request<unknown[]>({ method: "GET", path: `workout_sessions?${params.toString()}` });
    const values = rows(response);
    return values.length === 0 ? null : parseWorkoutSession(values[0]);
  }

  async listSessions(query: HistoryQuery): Promise<HistoryPageResult> {
    try {
      const body = {
        p_from: query.from,
        p_to: query.to,
        p_cursor_completed_at: query.cursor?.completedAt ?? null,
        p_cursor_id: query.cursor?.sessionId ?? null,
        p_limit: query.limit,
      };
      const response = rows(await this.client.request<unknown>({ method: "POST", path: "rpc/history_list_sessions", body }));
      const items = response.slice(0, query.limit).map(historyListItemFromRow);
      const nextCursor = response.length > query.limit && items.length > 0
        ? { completedAt: items.at(-1)?.completedAt ?? "", sessionId: items.at(-1)?.sessionId ?? "" }
        : null;
      try { await cacheHistoryPage(authUserId(), items); } catch { /* caching is optional */ }
      return { items, nextCursor };
    } catch (error) {
      try {
        const cached = await loadCachedHistory(authUserId());
        if (cached.length > 0) {
          const from = query.from ? Date.parse(query.from) : Number.NEGATIVE_INFINITY;
          const to = query.to ? Date.parse(query.to) : Number.POSITIVE_INFINITY;
          const items = cached.filter((item) => {
            const completedAt = Date.parse(item.completedAt);
            return completedAt >= from && completedAt < to;
          });
          return { items, nextCursor: null, fromCache: true };
        }
      } catch { /* cache is optional */ }
      throw mapError(error, "โหลดประวัติการฝึกไม่สำเร็จ");
    }
  }

  async getSession(sessionId: string): Promise<WorkoutSession | null> {
    try {
      const session = await this.getRemoteSession(sessionId);
      if (session) { try { await cacheHistoryDetail(authUserId(), session); } catch { /* caching is optional */ } }
      return session;
    } catch (error) {
      try {
        const cached = await loadCachedHistoryDetail(authUserId(), sessionId);
        if (cached) return cached;
      } catch { /* cache is optional */ }
      throw mapError(error, "โหลดรายละเอียด History ไม่สำเร็จ");
    }
  }

  async updateSession(input: HistoryUpdateInput): Promise<WorkoutSession> {
    try {
      const result = await this.client.request<unknown>({ method: "POST", path: "rpc/history_update_session", body: { p_operation_id: input.operationId, p_session_id: input.sessionId, p_expected_version: input.expectedVersion, p_draft: draftPayload(input) } });
      const resultVersion = rpcVersion(result);
      const session = await this.getRemoteSession(input.sessionId);
      if (!session || session.version < resultVersion) throw new HistoryRepositoryError("server", "บันทึกแล้วแต่โหลด History ที่ยืนยันไม่ได้");
      try { await cacheHistoryDetail(authUserId(), session); await cacheHistoryPage(authUserId(), [historySummaryFromSession(session)]); } catch { /* caching is optional */ }
      return session;
    } catch (error) {
      throw mapError(error, "แก้ไข History ไม่สำเร็จ");
    }
  }

  async softDeleteSession(input: HistoryDeleteInput): Promise<void> {
    try {
      await this.client.request<unknown>({ method: "POST", path: "rpc/history_soft_delete_session", body: { p_operation_id: input.operationId, p_session_id: input.sessionId, p_expected_version: input.expectedVersion } });
      await removeCachedHistory(authUserId(), input.sessionId);
    } catch (error) {
      throw mapError(error, "ลบ History ไม่สำเร็จ");
    }
  }
}

class UnconfiguredHistoryRepository implements HistoryRepository {
  private readonly error = new HistoryRepositoryError("unknown", "ยังไม่ได้ตั้งค่า Supabase กรุณาตรวจสอบ .env.local");
  listSessions(): Promise<never> { return Promise.reject(this.error); }
  getSession(): Promise<never> { return Promise.reject(this.error); }
  updateSession(): Promise<never> { return Promise.reject(this.error); }
  softDeleteSession(): Promise<never> { return Promise.reject(this.error); }
}

export function createSupabaseHistoryRepository(client?: SupabaseDataClient): HistoryRepository {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!client && (!url || !anonKey)) return new UnconfiguredHistoryRepository();
  return new SupabaseHistoryRepository(client ?? new SupabaseRestClient({ url, anonKey }));
}
