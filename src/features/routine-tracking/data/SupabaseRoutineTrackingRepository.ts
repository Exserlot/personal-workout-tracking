import { runtimeConfigState } from "../../../config/runtimeConfig";
import {
  SupabaseRequestError,
  SupabaseRestClient,
  type SupabaseDataClient,
} from "../../../lib/supabase/SupabaseRestClient";
import type {
  CurrentRoutineWeek,
  RoutineWeekDayStatus,
  RoutineWeekStatus,
  RoutineWeekSummary,
  SessionRemovalImpact,
  WeeklyRoutineNotification,
} from "../domain/routineTracking";
import {
  RoutineTrackingRepositoryError,
  type RoutineTrackingRepository,
} from "./RoutineTrackingRepository";

type Row = Record<string, unknown>;

function record(value: unknown, label: string): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RoutineTrackingRepositoryError("unknown", `Routine tracking response has invalid ${label}`);
  return value as Row;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new RoutineTrackingRepositoryError("unknown", `Routine tracking response has invalid ${label}`);
  return value;
}

function string(value: unknown, label: string, nullable = false): string | null {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== "string" || !value) throw new RoutineTrackingRepositoryError("unknown", `Routine tracking response missing ${label}`);
  return value;
}

function integer(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new RoutineTrackingRepositoryError("unknown", `Routine tracking response has invalid ${label}`);
  return parsed;
}

function parseDay(value: unknown): RoutineWeekDayStatus {
  const row = record(value, "day");
  return {
    id: string(row.id, "day.id") as string,
    routineDayId: string(row.routine_day_id, "day.routine_day_id") as string,
    templateId: string(row.template_id, "day.template_id", true),
    displayOrder: integer(row.display_order, "day.display_order"),
    dayLabel: string(row.day_label, "day.day_label") as string,
    templateName: string(row.template_name, "day.template_name") as string,
    completedCount: integer(row.completed_count, "day.completed_count"),
    activeCount: integer(row.active_count, "day.active_count"),
  };
}

export function parseRoutineWeek(value: unknown): RoutineWeekSummary {
  const row = record(value, "week");
  const status = string(row.status, "week.status") as RoutineWeekStatus;
  if (!(["OPEN", "PROVISIONAL", "FINALIZED"] as string[]).includes(status)) throw new RoutineTrackingRepositoryError("unknown", "Routine tracking response has invalid status");
  return {
    id: string(row.id, "week.id") as string,
    routineId: string(row.routine_id, "week.routine_id") as string,
    routineName: string(row.routine_name, "week.routine_name") as string,
    routineRevision: integer(row.routine_revision, "week.routine_revision"),
    weekStart: string(row.week_start, "week.week_start") as string,
    weekEnd: string(row.week_end, "week.week_end") as string,
    timezone: string(row.timezone, "week.timezone") as string,
    frequencyActual: integer(row.frequency_actual, "week.frequency_actual"),
    frequencyTarget: integer(row.frequency_target, "week.frequency_target"),
    coverageActual: integer(row.coverage_actual, "week.coverage_actual"),
    coverageTarget: integer(row.coverage_target, "week.coverage_target"),
    status,
    lockedAt: string(row.locked_at, "week.locked_at", true),
    finalizedAt: string(row.finalized_at, "week.finalized_at", true),
    days: array(row.days, "week.days").map(parseDay).sort((a, b) => a.displayOrder - b.displayOrder),
  };
}

function parseCurrentWeek(value: unknown): CurrentRoutineWeek {
  const row = record(value, "current week");
  const scheduled = row.scheduled_activation === null ? null : record(row.scheduled_activation, "scheduled activation");
  return {
    timezone: string(row.timezone, "timezone") as string,
    currentWeekStart: string(row.current_week_start, "current_week_start") as string,
    nextWeekStart: string(row.next_week_start, "next_week_start") as string,
    currentPlan: row.current_plan === null ? null : parseRoutineWeek(row.current_plan),
    scheduledActivation: scheduled ? {
      routineId: string(scheduled.routine_id, "scheduled.routine_id", true),
      routineName: string(scheduled.routine_name, "scheduled.routine_name", true),
      effectiveWeekStart: string(scheduled.effective_week_start, "scheduled.effective_week_start") as string,
      isDeactivation: scheduled.is_deactivation === true,
    } : null,
  };
}

function parseNotification(value: unknown): WeeklyRoutineNotification {
  const row = record(value, "notification");
  return {
    id: string(row.id, "notification.id") as string,
    weekPlanId: string(row.week_plan_id, "notification.week_plan_id") as string,
    title: string(row.title, "notification.title") as string,
    content: string(row.content, "notification.content") as string,
    frequencyActual: integer(row.frequency_actual, "notification.frequency_actual"),
    frequencyTarget: integer(row.frequency_target, "notification.frequency_target"),
    coverageActual: integer(row.coverage_actual, "notification.coverage_actual"),
    coverageTarget: integer(row.coverage_target, "notification.coverage_target"),
    missingDayLabels: array(row.missing_day_labels, "notification.missing_day_labels").map((item) => string(item, "missing day") as string),
    readAt: string(row.read_at, "notification.read_at", true),
    dismissedAt: string(row.dismissed_at, "notification.dismissed_at", true),
    createdAt: string(row.created_at, "notification.created_at") as string,
    weekStart: string(row.week_start, "notification.week_start") as string,
    weekEnd: string(row.week_end, "notification.week_end") as string,
  };
}

function mapError(error: unknown, fallback: string) {
  if (error instanceof RoutineTrackingRepositoryError) return error;
  if (error instanceof SupabaseRequestError) {
    const payload = error.payload && typeof error.payload === "object" ? error.payload as Row : null;
    const code = typeof payload?.code === "string" ? payload.code : "";
    const message = typeof payload?.message === "string" ? payload.message : "";
    if (message === "invalid_timezone" || code === "22023" || code === "23514") return new RoutineTrackingRepositoryError("validation", message || "ข้อมูล Routine Week ไม่ถูกต้อง");
    if (message === "routine_week_locked" || code === "40001") return new RoutineTrackingRepositoryError("conflict", "Routine Week นี้เริ่มแล้ว การเปลี่ยนแปลงจะมีผลสัปดาห์หน้า");
    if (code === "P0002" || error.status === 404) return new RoutineTrackingRepositoryError("not-found", "ไม่พบข้อมูล Routine Week");
    if (error.status === 401 || error.status === 403) return new RoutineTrackingRepositoryError("authorization", "กรุณาเข้าสู่ระบบอีกครั้ง");
  }
  if (error instanceof TypeError || (error instanceof Error && /fetch|network|offline/i.test(error.message))) return new RoutineTrackingRepositoryError("offline", "ต้องเชื่อมต่ออินเทอร์เน็ตเพื่ออัปเดต Routine Week");
  return new RoutineTrackingRepositoryError("unknown", fallback);
}

export class SupabaseRoutineTrackingRepository implements RoutineTrackingRepository {
  private timezoneInitialization: Promise<void> | null = null;

  constructor(private readonly client: SupabaseDataClient) {}

  private async rpc<T>(name: string, body: Record<string, unknown> = {}) {
    return this.client.request<T>({ method: "POST", path: `rpc/${name}`, body });
  }

  private ensureTimezone() {
    if (!this.timezoneInitialization) {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      this.timezoneInitialization = this.rpc("preferences_get_or_create_timezone", {
        p_detected_timezone: detectedTimezone,
      }).then(() => undefined).catch((error) => {
        this.timezoneInitialization = null;
        throw error;
      });
    }
    return this.timezoneInitialization;
  }

  async reconcile() { try { await this.ensureTimezone(); await this.rpc("routine_reconcile_weeks"); } catch (error) { throw mapError(error, "ปรับสถานะ Routine Week ไม่สำเร็จ"); } }
  async getCurrentWeek() { try { await this.ensureTimezone(); return parseCurrentWeek(await this.rpc("routine_get_current_week")); } catch (error) { throw mapError(error, "โหลด Routine Week ปัจจุบันไม่สำเร็จ"); } }
  async listHistory() { try { await this.ensureTimezone(); return array(await this.rpc("routine_list_history", { p_limit: 52, p_offset: 0 }), "history").map(parseRoutineWeek); } catch (error) { throw mapError(error, "โหลด Weekly Routine History ไม่สำเร็จ"); } }
  async getWeek(id: string) { try { await this.ensureTimezone(); return parseRoutineWeek(await this.rpc("routine_get_week", { p_week_plan_id: id })); } catch (error) { throw mapError(error, "โหลดรายละเอียด Routine Week ไม่สำเร็จ"); } }
  async listNotifications() { try { await this.ensureTimezone(); return array(await this.rpc("routine_list_notifications"), "notifications").map(parseNotification); } catch (error) { throw mapError(error, "โหลด Notification Center ไม่สำเร็จ"); } }
  async markNotificationRead(id: string) { try { await this.rpc("routine_mark_notification_read", { p_notification_id: id }); } catch (error) { throw mapError(error, "อ่าน Notification ไม่สำเร็จ"); } }
  async dismissNotification(id: string) { try { await this.rpc("routine_dismiss_notification", { p_notification_id: id }); } catch (error) { throw mapError(error, "ปิด Notification ไม่สำเร็จ"); } }
  async getSessionRemovalImpact(sessionId: string) {
    try {
      const row = record(await this.rpc("routine_get_session_removal_impact", { p_session_id: sessionId }), "removal impact");
      if (row.affects_routine_week !== true) return { affectsRoutineWeek: false };
      return {
        affectsRoutineWeek: true,
        weekPlanId: string(row.week_plan_id, "impact.week_plan_id") as string,
        weekStart: string(row.week_start, "impact.week_start") as string,
        weekEnd: string(row.week_end, "impact.week_end") as string,
        frequencyAfter: integer(row.frequency_after, "impact.frequency_after"),
        frequencyTarget: integer(row.frequency_target, "impact.frequency_target"),
        coverageAfter: integer(row.coverage_after, "impact.coverage_after"),
        coverageTarget: integer(row.coverage_target, "impact.coverage_target"),
        missingDayLabelsAfter: array(row.missing_day_labels_after, "impact.missing_day_labels_after").map((item) => string(item, "impact missing day") as string),
      } satisfies SessionRemovalImpact;
    } catch (error) { throw mapError(error, "คำนวณผลกระทบจากการลบไม่สำเร็จ"); }
  }
  async getTimezone(detectedTimezone: string) {
    try {
      const timezone = string(await this.rpc("preferences_get_or_create_timezone", { p_detected_timezone: detectedTimezone }), "timezone") as string;
      this.timezoneInitialization = Promise.resolve();
      return timezone;
    } catch (error) { throw mapError(error, "โหลด Timezone ไม่สำเร็จ"); }
  }
  async updateTimezone(timezone: string) {
    try {
      const updatedTimezone = string(await this.rpc("preferences_update_timezone", { p_timezone: timezone }), "timezone") as string;
      this.timezoneInitialization = Promise.resolve();
      return updatedTimezone;
    } catch (error) { throw mapError(error, "บันทึก Timezone ไม่สำเร็จ"); }
  }
}

class UnconfiguredRoutineTrackingRepository implements RoutineTrackingRepository {
  private readonly error = new RoutineTrackingRepositoryError("offline", "ยังไม่ได้ตั้งค่า Supabase");
  reconcile(): Promise<never> { return Promise.reject(this.error); }
  getCurrentWeek(): Promise<never> { return Promise.reject(this.error); }
  listHistory(): Promise<never> { return Promise.reject(this.error); }
  getWeek(): Promise<never> { return Promise.reject(this.error); }
  listNotifications(): Promise<never> { return Promise.reject(this.error); }
  markNotificationRead(): Promise<never> { return Promise.reject(this.error); }
  dismissNotification(): Promise<never> { return Promise.reject(this.error); }
  getSessionRemovalImpact(): Promise<never> { return Promise.reject(this.error); }
  getTimezone(): Promise<never> { return Promise.reject(this.error); }
  updateTimezone(): Promise<never> { return Promise.reject(this.error); }
}

export function createSupabaseRoutineTrackingRepository(): RoutineTrackingRepository {
  const config = runtimeConfigState.config;
  if (!config) return new UnconfiguredRoutineTrackingRepository();
  return new SupabaseRoutineTrackingRepository(new SupabaseRestClient({ url: config.supabaseUrl, anonKey: config.supabasePublishableKey }));
}
