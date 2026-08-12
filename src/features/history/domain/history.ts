import type { SessionExercise, SessionSet, WorkoutSession } from "../../workout/domain/workout";

export interface HistoryCursor {
  completedAt: string;
  sessionId: string;
}

export interface HistoryQuery {
  from: string | null;
  to: string | null;
  cursor: HistoryCursor | null;
  limit: 20;
}

export interface HistoryListItem {
  sessionId: string;
  label: string;
  sourceType: "PLANNED" | "AD_HOC";
  completedAt: string;
  durationSeconds: number;
  exerciseCount: number;
  completedWorkingSetCount: number;
  volumeKg: number;
  editedAt: string | null;
}

export interface HistoryPageResult {
  items: HistoryListItem[];
  nextCursor: HistoryCursor | null;
  fromCache?: boolean;
}

export interface HistorySessionDraft {
  notes: string;
  exercises: SessionExercise[];
}

export interface HistoryUpdateInput {
  operationId: string;
  sessionId: string;
  expectedVersion: number;
  draft: HistorySessionDraft;
}

export interface HistoryDeleteInput {
  operationId: string;
  sessionId: string;
  expectedVersion: number;
}

export type HistoryRepositoryErrorCode =
  | "validation"
  | "conflict"
  | "not-found"
  | "offline"
  | "authorization"
  | "server"
  | "unknown";

export class HistoryRepositoryError extends Error {
  constructor(public readonly code: HistoryRepositoryErrorCode, message: string) {
    super(message);
    this.name = "HistoryRepositoryError";
  }
}

export interface HistoryRepository {
  listSessions(query: HistoryQuery): Promise<HistoryPageResult>;
  getSession(sessionId: string): Promise<WorkoutSession | null>;
  updateSession(input: HistoryUpdateInput): Promise<WorkoutSession>;
  softDeleteSession(input: HistoryDeleteInput): Promise<void>;
}

export function historyDraftFromSession(session: WorkoutSession): HistorySessionDraft {
  return {
    notes: session.notes,
    exercises: structuredClone(session.exercises),
  };
}

export function historyDraftEquals(a: HistorySessionDraft, b: HistorySessionDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function historySummaryFromSession(session: WorkoutSession): HistoryListItem {
  const completedAt = session.completedAt ?? session.startedAt;
  const completed = session.exercises.flatMap((exercise) => exercise.sets)
    .filter((set) => set.kind === "WORKING" && set.status === "COMPLETED");
  return {
    sessionId: session.id,
    label: session.templateNameSnapshot ?? "Ad-hoc Workout",
    sourceType: session.sourceType,
    completedAt,
    durationSeconds: Math.max(0, Math.floor((Date.parse(completedAt) - Date.parse(session.startedAt)) / 1000)),
    exerciseCount: session.exercises.length,
    completedWorkingSetCount: completed.length,
    volumeKg: completed.reduce((total, set) => total + (set.actualWeight?.kg ?? 0) * (set.actualReps ?? 0), 0),
    editedAt: session.editedAt,
  };
}

export function resequenceExercises(exercises: SessionExercise[]): SessionExercise[] {
  return exercises.map((exercise, index) => ({ ...exercise, sequence: index + 1 }));
}

export function resequenceSets(sets: SessionSet[]): SessionSet[] {
  return sets.map((set, index) => ({ ...set, sequence: index + 1 }));
}

export function validateHistoryDraft(draft: HistorySessionDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (draft.notes.length > 2000) errors.notes = "หมายเหตุต้องไม่เกิน 2,000 ตัวอักษร";
  draft.exercises.forEach((exercise, exerciseIndex) => {
    if (!exercise.name.trim()) errors[`exercise-${exerciseIndex}`] = "ต้องมีชื่อท่าออกกำลังกาย";
    if (exercise.sets.length === 0) errors[`exercise-${exerciseIndex}`] = "แต่ละท่าต้องมีอย่างน้อย 1 เซ็ต";
    exercise.sets.forEach((set, setIndex) => {
      const key = `exercise-${exerciseIndex}-set-${setIndex}`;
      if (set.status === "COMPLETED") {
        if (!set.actualWeight || set.actualWeight.value < 0) errors[`${key}-weight`] = "Completed set ต้องมีน้ำหนักตั้งแต่ 0 ขึ้นไป";
        if (!set.actualReps || !Number.isInteger(set.actualReps) || set.actualReps < 1) errors[`${key}-reps`] = "Reps ต้องเป็นจำนวนเต็มบวก";
        if (!set.completedAt) errors[`${key}-completedAt`] = "Completed set ต้องมีเวลาบันทึก";
        if (set.actualEffort) {
          const { metric, value } = set.actualEffort;
          const validRpe = metric === "RPE" && value >= 1 && value <= 10 && Number.isInteger(value * 2);
          const validRir = metric === "RIR" && Number.isInteger(value) && value >= 0 && value <= 10;
          if (!validRpe && !validRir) errors[`${key}-effort`] = "ค่า RPE ต้องอยู่ระหว่าง 1–10 ทีละครึ่ง หรือ RIR เป็นจำนวนเต็ม 0–10";
        }
      } else if (set.actualWeight || set.actualReps || set.actualEffort || set.completedAt) {
        errors[key] = "Pending/Skipped set ห้ามมีค่าการเล่นจริง";
      }
      if (set.kind === "WARM_UP" && set.isToFailure) errors[key] = "Warm-up set ไม่สามารถเป็น failure set";
    });
  });
  return errors;
}

export function formatHistoryDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}ชม. ${minutes}น.` : `${minutes}น.`;
}

export function formatHistoryVolume(volumeKg: number): string {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(volumeKg)} KG`;
}
