import { createContext, useContext } from "react";
import type { WorkoutSyncSnapshot } from "./data/WorkoutSyncCoordinator";
import type { WorkoutConflictDetail, WorkoutDevice, WorkoutRepositoryErrorCode, WorkoutSession } from "./domain/workout";
import type { RecoveryBundle } from "./data/activeSessionCache";

export interface WorkoutSessionSyncSummary {
  sessionId: string;
  status: WorkoutSyncSnapshot["status"];
  pendingCount: number;
  conflict: boolean;
  lastErrorCode: WorkoutRepositoryErrorCode | null;
  localSession: WorkoutSession | null;
  ownerDeviceId: string | null;
  lastAttemptAt: number | null;
  lastSyncedAt: number | null;
}

export interface WorkoutSyncOverview {
  status: WorkoutSyncSnapshot["status"] | "pending" | "recovery-required";
  pendingCount: number;
  conflictCount: number;
  lastSyncedAt: number | null;
  sessions: WorkoutSessionSyncSummary[];
  recoveryCount: number;
}

export interface WorkoutSyncController {
  start(sessionId: string): void;
  trackSession(sessionId: string): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): WorkoutSyncSnapshot;
  getSessionSnapshot(sessionId: string): WorkoutSessionSyncSummary | null;
  getOverviewSnapshot(): WorkoutSyncOverview;
  syncNow(): Promise<void>;
  retry(operationId?: string): Promise<void>;
  loadConflictDetail(sessionId: string): Promise<WorkoutConflictDetail>;
  archiveAndUseServer(input: { sessionId: string; serverSession: WorkoutSession; ownerDevice?: WorkoutDevice | null; reason: string }): Promise<RecoveryBundle>;
  archiveAfterRemoteAbandon(input: { sessionId: string; serverSession: WorkoutSession | null; ownerDevice?: WorkoutDevice | null; reason: string }): Promise<RecoveryBundle>;
}

export const WorkoutSyncContext = createContext<WorkoutSyncController | null>(null);

export function useWorkoutSync() {
  const value = useContext(WorkoutSyncContext);
  if (!value) throw new Error("WorkoutSyncProvider is missing");
  return value;
}
