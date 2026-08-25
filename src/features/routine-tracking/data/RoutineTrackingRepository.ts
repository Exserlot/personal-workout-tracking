import type {
  CurrentRoutineWeek,
  RoutineWeekSummary,
  SessionRemovalImpact,
  WeeklyRoutineNotification,
} from "../domain/routineTracking";

export type RoutineTrackingErrorCode = "validation" | "not-found" | "conflict" | "offline" | "authorization" | "unknown";

export class RoutineTrackingRepositoryError extends Error {
  constructor(public readonly code: RoutineTrackingErrorCode, message: string) {
    super(message);
    this.name = "RoutineTrackingRepositoryError";
  }
}

export interface RoutineTrackingRepository {
  reconcile(): Promise<void>;
  getCurrentWeek(): Promise<CurrentRoutineWeek>;
  listHistory(): Promise<RoutineWeekSummary[]>;
  getWeek(id: string): Promise<RoutineWeekSummary>;
  listNotifications(): Promise<WeeklyRoutineNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  dismissNotification(id: string): Promise<void>;
  getSessionRemovalImpact(sessionId: string): Promise<SessionRemovalImpact>;
  getTimezone(detectedTimezone: string): Promise<string>;
  updateTimezone(timezone: string): Promise<string>;
}
