export type RoutineWeekStatus = "OPEN" | "PROVISIONAL" | "FINALIZED";

export interface RoutineWeekDayStatus {
  id: string;
  routineDayId: string;
  templateId: string | null;
  displayOrder: number;
  dayLabel: string;
  templateName: string;
  completedCount: number;
}

export interface RoutineWeekSummary {
  id: string;
  routineId: string;
  routineName: string;
  routineRevision: number;
  weekStart: string;
  weekEnd: string;
  timezone: string;
  frequencyActual: number;
  frequencyTarget: number;
  coverageActual: number;
  coverageTarget: number;
  status: RoutineWeekStatus;
  lockedAt: string | null;
  finalizedAt: string | null;
  days: RoutineWeekDayStatus[];
}

export interface ScheduledRoutineActivation {
  routineId: string | null;
  routineName: string | null;
  effectiveWeekStart: string;
  isDeactivation: boolean;
}

export interface CurrentRoutineWeek {
  timezone: string;
  currentWeekStart: string;
  nextWeekStart: string;
  currentPlan: RoutineWeekSummary | null;
  scheduledActivation: ScheduledRoutineActivation | null;
}

export interface WeeklyRoutineNotification {
  id: string;
  weekPlanId: string;
  title: string;
  content: string;
  frequencyActual: number;
  frequencyTarget: number;
  coverageActual: number;
  coverageTarget: number;
  missingDayLabels: string[];
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  weekStart: string;
  weekEnd: string;
}

export interface SessionRemovalImpact {
  affectsRoutineWeek: boolean;
  weekPlanId?: string;
  weekStart?: string;
  weekEnd?: string;
  frequencyAfter?: number;
  frequencyTarget?: number;
  coverageAfter?: number;
  coverageTarget?: number;
  missingDayLabelsAfter?: string[];
}

export function groupRoutineWeekDays(days: RoutineWeekDayStatus[]) {
  return {
    recommended: days.filter((day) => day.completedCount === 0),
    repeat: days.filter((day) => day.completedCount > 0),
  };
}
