export type ProgressRecordKind = "BEST_WEIGHT" | "BEST_REPS_AT_WEIGHT" | "ESTIMATED_1RM";
export type ProgressRange = "30D" | "90D" | "1Y" | "ALL";
export type ProgressDisplayUnit = "KG" | "LB";

export interface ProgressRecord {
  kind: ProgressRecordKind;
  exerciseId: string;
  exerciseName: string;
  sessionId: string;
  setId: string;
  achievedAt: string;
  weightKg: number;
  reps: number;
  estimated1RmKg: number | null;
  previousValue: number | null;
}

export interface ProgressTrendPoint {
  sessionId: string;
  completedAt: string;
  volumeKg: number;
  bestWeightKg: number;
  bestReps: number;
  bestEstimated1RmKg: number | null;
}

export interface ProgressOverviewStats {
  trackedExerciseCount: number;
  recentSessionCount: number;
  recentVolumeKg: number;
  recentPrCount: number;
}

export interface FeaturedExerciseProgress {
  exerciseId: string;
  exerciseName: string;
  lastTrainedAt: string;
  trend: ProgressTrendPoint[];
}

export interface ProgressOverview {
  sourceRevision: number;
  stats: ProgressOverviewStats;
  recentRecords: ProgressRecord[];
  featuredExercise: FeaturedExerciseProgress | null;
}

export interface ProgressExerciseCursor {
  lastTrainedAt: string;
  exerciseId: string;
}

export interface ProgressExerciseQuery {
  search: string;
  cursor: ProgressExerciseCursor | null;
  limit: 20;
}

export interface ProgressExerciseSummary {
  exerciseId: string;
  exerciseName: string;
  lastTrainedAt: string;
  sessionCount: number;
  workingSetCount: number;
  allTimeBestWeightKg: number;
  allTimeBestEstimated1RmKg: number | null;
  latestSessionVolumeKg: number;
}

export interface ProgressExercisePage {
  sourceRevision: number;
  items: ProgressExerciseSummary[];
  nextCursor: ProgressExerciseCursor | null;
}

export interface ExerciseProgressQuery {
  exerciseId: string;
  from: string | null;
  to: string | null;
  pointLimit: number;
}

export interface ExerciseProgressMetrics {
  sessionCount: number;
  workingSetCount: number;
  bestWeightKg: number;
  bestReps: number;
  bestRepsWeightKg: number;
  bestEstimated1RmKg: number | null;
  totalVolumeKg: number;
}

export interface RepsAtWeightRecord {
  weightKg: number;
  reps: number;
  sessionId: string;
  setId: string;
  achievedAt: string;
}

export interface ExerciseProgressDetail {
  sourceRevision: number;
  exerciseId: string;
  exerciseName: string;
  metrics: ExerciseProgressMetrics;
  trend: ProgressTrendPoint[];
  allTimeRecords: ProgressRecord[];
  repsAtWeight: RepsAtWeightRecord[];
  hasPositiveWeight: boolean;
  truncated: boolean;
}

export type ProgressRepositoryErrorCode = "not-found" | "offline" | "authorization" | "server" | "unknown";

export class ProgressRepositoryError extends Error {
  constructor(public readonly code: ProgressRepositoryErrorCode, message: string) {
    super(message);
    this.name = "ProgressRepositoryError";
  }
}

export interface ProgressRepository {
  getOverview(): Promise<ProgressOverview>;
  listExercises(query: ProgressExerciseQuery): Promise<ProgressExercisePage>;
  getExerciseDetail(input: ExerciseProgressQuery): Promise<ExerciseProgressDetail | null>;
  listSessionRecords(sessionId: string): Promise<ProgressRecord[]>;
}

export function estimated1RmKg(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isInteger(reps) || weightKg <= 0 || reps < 1 || reps > 10) return null;
  return Number((weightKg * (1 + reps / 30)).toFixed(4));
}

export function progressRangeStart(range: ProgressRange, now = new Date()): string | null {
  if (range === "ALL") return null;
  const days = range === "30D" ? 30 : range === "90D" ? 90 : 365;
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export function weightFromKg(weightKg: number, unit: ProgressDisplayUnit): number {
  return Number((unit === "LB" ? weightKg / 0.45359237 : weightKg).toFixed(1));
}

export function formatProgressWeight(weightKg: number, unit: ProgressDisplayUnit): string {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(weightFromKg(weightKg, unit))} ${unit}`;
}

export function formatProgressVolume(volumeKg: number, unit: ProgressDisplayUnit): string {
  return formatProgressWeight(volumeKg, unit);
}

export function progressRecordLabel(record: ProgressRecord, unit: ProgressDisplayUnit): string {
  if (record.kind === "BEST_WEIGHT") return `Weight PR · ${formatProgressWeight(record.weightKg, unit)} × ${record.reps}`;
  if (record.kind === "BEST_REPS_AT_WEIGHT") return `Rep PR · ${record.reps} reps @ ${formatProgressWeight(record.weightKg, unit)}`;
  return `e1RM PR · ${formatProgressWeight(record.estimated1RmKg ?? 0, unit)}`;
}
