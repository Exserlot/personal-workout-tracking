export type WorkoutSessionStatus = "ACTIVE" | "COMPLETED" | "DISCARDED";
export type WorkoutSourceType = "PLANNED" | "AD_HOC";
export type SessionSetStatus = "PENDING" | "COMPLETED" | "SKIPPED";
export type SessionSetKind = "WARM_UP" | "WORKING" | "DROP";
export type WeightUnit = "KG" | "LB";
export type EffortMetric = "RPE" | "RIR";

export interface WeightValue {
  value: number;
  unit: WeightUnit;
  kg: number;
}

export interface EffortValue {
  metric: EffortMetric;
  value: number;
}

export interface SessionMuscle {
  role: "PRIMARY" | "SECONDARY";
  sequence: number;
  name: string;
}

export interface SessionSet {
  id: string;
  sourceTemplateSetId: string | null;
  sequence: number;
  kind: SessionSetKind;
  isToFailure: boolean;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeight: WeightValue | null;
  targetEffort: EffortValue | null;
  targetRestSeconds: number;
  actualWeight: WeightValue | null;
  actualReps: number | null;
  actualEffort: EffortValue | null;
  actualRestSeconds: number | null;
  status: SessionSetStatus;
  completedAt: string | null;
  notes: string;
}

export interface SessionExercise {
  id: string;
  sourceTemplateExerciseId: string | null;
  sourceExerciseId: string | null;
  sequence: number;
  name: string;
  equipmentCode: string | null;
  muscles: SessionMuscle[];
  notes: string;
  sets: SessionSet[];
}

export interface WorkoutSession {
  id: string;
  ownerDeviceId: string;
  sourceType: WorkoutSourceType;
  sourceRoutineId: string | null;
  sourceRoutineDayId: string | null;
  sourceRoutineWeekPlanId: string | null;
  sourceRoutineWeekPlanDayId: string | null;
  sourceTemplateId: string | null;
  sourceRoutineRevision: number | null;
  sourceTemplateRevision: number | null;
  routineNameSnapshot: string | null;
  dayLabelSnapshot: string | null;
  templateNameSnapshot: string | null;
  status: WorkoutSessionStatus;
  startedAt: string;
  completedAt: string | null;
  notes: string;
  version: number;
  editedAt: string | null;
  deletedAt?: string | null;
  exercises: SessionExercise[];
}

export interface PreviousExerciseValues {
  weight: WeightValue | null;
  reps: number | null;
  effort: EffortValue | null;
  completedAt: string | null;
}

export interface WorkoutCompletionSummary {
  sessionId: string;
  sourceType: WorkoutSourceType;
  templateName: string | null;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  exerciseCount: number;
  completedWorkingSetCount: number;
  pendingSetCount: number;
  volumeKg: number;
  exercises: Array<{
    name: string;
    completedSetCount: number;
    volumeKg: number;
  }>;
}

export function completionSummaryFromSession(session: WorkoutSession): WorkoutCompletionSummary {
  const exercises = session.exercises.map((exercise) => {
    const completed = exercise.sets.filter((set) => set.status === "COMPLETED" && set.kind === "WORKING");
    return {
      name: exercise.name,
      completedSetCount: completed.length,
      volumeKg: completed.reduce((total, set) => total + (set.actualWeight?.kg ?? 0) * (set.actualReps ?? 0), 0),
    };
  });
  const completedAt = session.completedAt ?? new Date().toISOString();
  return {
    sessionId: session.id,
    sourceType: session.sourceType,
    templateName: session.templateNameSnapshot,
    startedAt: session.startedAt,
    completedAt,
    durationSeconds: Math.max(0, Math.floor((Date.parse(completedAt) - Date.parse(session.startedAt)) / 1000)),
    exerciseCount: session.exercises.length,
    completedWorkingSetCount: exercises.reduce((total, exercise) => total + exercise.completedSetCount, 0),
    pendingSetCount: session.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.status === "PENDING").length, 0),
    volumeKg: exercises.reduce((total, exercise) => total + exercise.volumeKg, 0),
    exercises,
  };
}

export interface WorkoutDevice {
  id: string;
  label: string | null;
  lastSeenAt: string;
}

export interface WorkoutConflictDetail {
  sessionId: string;
  reason: WorkoutRepositoryErrorCode;
  localSession: WorkoutSession;
  acknowledgedSession: WorkoutSession;
  serverSession: WorkoutSession | null;
  ownerDevice: WorkoutDevice | null;
  operations: SyncOperation[];
}

export type WorkoutRepositoryErrorCode =
  | "validation"
  | "active-exists"
  | "device-locked"
  | "conflict"
  | "not-found"
  | "offline"
  | "server"
  | "authorization"
  | "unknown";

export class WorkoutRepositoryError extends Error {
  constructor(
    public readonly code: WorkoutRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkoutRepositoryError";
  }
}

export interface StartPlannedInput {
  sessionId: string;
  deviceId: string;
  routineWeekPlanId: string;
  routineWeekPlanDayId: string;
  templateRevision: number;
}

export interface StartAdHocInput {
  sessionId: string;
  deviceId: string;
  templateId: string | null;
  templateRevision?: number;
  name?: string;
}

export type WorkoutCommand =
  | {
      action: "complete_set" | "edit_set";
      setId: string;
      actualWeight: WeightValue;
      actualReps: number;
      actualEffort: EffortValue | null;
    }
  | { action: "skip_set" | "delete_set"; setId: string }
  | { action: "move_set"; setId: string; sequence: number }
  | {
      action: "add_set";
      sessionExerciseId: string;
      setId: string;
      sequence: number;
      kind: Exclude<SessionSetKind, "DROP">;
      targetRepsMin: number;
      targetRepsMax: number;
      targetWeight: WeightValue | null;
      targetEffort: EffortValue | null;
      targetRestSeconds: number;
    }
  | { action: "set_kind"; setId: string; kind: Exclude<SessionSetKind, "DROP"> }
  | {
      action: "add_exercise";
      sessionExerciseId: string;
      exerciseId: string;
      sequence: number;
      setId: string;
      notes: string;
    }
  | { action: "remove_exercise"; sessionExerciseId: string }
  | { action: "move_exercise"; sessionExerciseId: string; sequence: number }
  | { action: "update_session_notes"; notes: string }
  | { action: "update_exercise_notes"; sessionExerciseId: string; notes: string };

export type OfflineSetCommand =
  | Extract<WorkoutCommand, { action: "complete_set" | "edit_set" }>
  | Extract<WorkoutCommand, { action: "skip_set" | "delete_set" }>
  | Extract<WorkoutCommand, { action: "add_set" }>;

export type OfflineLifecycleCommand =
  | { action: "finish_session" }
  | { action: "discard_session" };

export type OfflineWorkoutCommand = OfflineSetCommand | OfflineLifecycleCommand;

export type SyncOperationStatus = "PENDING" | "CONFLICT";

export interface SyncOperation {
  operationId: string;
  userId: string;
  sessionId: string;
  deviceId: string;
  command: OfflineWorkoutCommand;
  expectedVersion: number;
  createdAt: number;
  attemptCount: number;
  lastAttemptAt: number | null;
  nextAttemptAt: number;
  status: SyncOperationStatus;
  lastErrorCode: WorkoutRepositoryErrorCode | null;
}

export interface WorkoutRepository {
  registerDevice(deviceId: string, label?: string): Promise<WorkoutDevice>;
  listDevices(): Promise<WorkoutDevice[]>;
  getActiveSession(deviceId: string): Promise<WorkoutSession | null>;
  getSession(sessionId: string, deviceId: string): Promise<WorkoutSession | null>;
  getPreviousValues(exerciseIds: string[]): Promise<Record<string, PreviousExerciseValues>>;
  startPlanned(input: StartPlannedInput): Promise<WorkoutSession>;
  startAdHoc(input: StartAdHocInput): Promise<WorkoutSession>;
  applyCommand(sessionId: string, deviceId: string, expectedVersion: number, command: WorkoutCommand): Promise<WorkoutSession>;
  applyIdempotentCommand(input: {
    operationId: string;
    sessionId: string;
    deviceId: string;
    expectedVersion: number;
    command: OfflineWorkoutCommand;
  }): Promise<WorkoutSession>;
  finishSession(sessionId: string, deviceId: string, expectedVersion: number): Promise<WorkoutSession>;
  discardSession(sessionId: string, deviceId: string, expectedVersion: number): Promise<void>;
  transferSessionOwnership(input: { operationId: string; sessionId: string; targetDeviceId: string; expectedVersion: number }): Promise<WorkoutSession>;
  remoteAbandonSession(input: { operationId: string; sessionId: string; expectedVersion: number }): Promise<WorkoutSession>;
  getCompletionSummary(sessionId: string): Promise<WorkoutCompletionSummary>;
}

export function kgFromWeight(value: number, unit: WeightUnit) {
  return Number((unit === "LB" ? value * 0.45359237 : value).toFixed(4));
}
