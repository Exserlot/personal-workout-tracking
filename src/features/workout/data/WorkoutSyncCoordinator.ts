import {
  WorkoutRepositoryError,
  type SyncOperation,
  type WorkoutRepository,
} from "../domain/workout";
import { loadSessionCache } from "./activeSessionCache";
import {
  acknowledgeOperation,
  listSyncOperations,
  markOperationConflict,
  markOperationRetry,
  retryDelayMs,
  retryConflictedOperation,
  subscribeSyncChanges,
} from "./workoutSyncStore";

export type WorkoutSyncStatus = "synced" | "saved-locally" | "syncing" | "offline" | "conflict" | "authorization";

export interface WorkoutSyncSnapshot {
  status: WorkoutSyncStatus;
  pendingCount: number;
  conflictOperationId: string | null;
  lastErrorCode: string | null;
  lastSyncedAt: number | null;
  sessionId?: string | null;
}

const fallbackLocks = new Map<string, Promise<void>>();

async function withSessionLock<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    return navigator.locks.request(`workout-sync:${sessionId}`, task);
  }
  const previous = fallbackLocks.get(sessionId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  fallbackLocks.set(sessionId, queued);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (fallbackLocks.get(sessionId) === queued) fallbackLocks.delete(sessionId);
  }
}

export class WorkoutSyncCoordinator {
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribeStore: () => void;
  private readonly onlineHandler = () => { void this.syncNow(true); };
  private timer: number | null = null;
  private running = false;
  private rerunRequested = false;
  private sessionId: string | null = null;
  private refreshSequence = 0;
  private snapshot: WorkoutSyncSnapshot = {
    status: "synced",
    pendingCount: 0,
    conflictOperationId: null,
    lastErrorCode: null,
    lastSyncedAt: null,
  };

  constructor(private readonly repository: WorkoutRepository, private readonly userId: string) {
    this.unsubscribeStore = subscribeSyncChanges(() => { void this.refreshSnapshot(); });
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.snapshot;
  }

  start(sessionId: string, autoSync = true) {
    if (this.sessionId !== sessionId && typeof window !== "undefined") {
      window.removeEventListener("online", this.onlineHandler);
    }
    this.sessionId = sessionId;
    if (typeof window !== "undefined") window.addEventListener("online", this.onlineHandler);
    if (autoSync) void this.syncNow();
  }

  stop() {
    if (typeof window !== "undefined") window.removeEventListener("online", this.onlineHandler);
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.sessionId = null;
    this.unsubscribeStore();
  }

  async retry(operationId?: string) {
    if (operationId) {
      const operations = await listSyncOperations(this.userId, this.sessionId ?? undefined).catch(() => []);
      const operation = operations.find((item) => item.operationId === operationId);
      // Revision/device conflicts require an explicit recovery decision. Retrying the
      // same expected version would only recreate the conflict.
      if (operation?.status === "CONFLICT") return;
      await retryConflictedOperation(operationId);
    }
    await this.syncNow(true);
  }

  syncNow(force = true) {
    return this.syncNowInternal(force);
  }

  isRunning() {
    return this.running;
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private async refreshSnapshot() {
    if (!this.sessionId) return;
    const sequence = ++this.refreshSequence;
    const sessionId = this.sessionId;
    const operations = await listSyncOperations(this.userId, sessionId).catch(() => []);
    const conflict = operations.find((operation) => operation.status === "CONFLICT");
    const cache = await loadSessionCache(sessionId, this.userId).catch(() => null);
    if (sequence !== this.refreshSequence || sessionId !== this.sessionId) return;
    this.snapshot = {
      ...this.snapshot,
      pendingCount: operations.length,
      conflictOperationId: conflict?.operationId ?? null,
      lastErrorCode: conflict?.lastErrorCode ?? operations[0]?.lastErrorCode ?? null,
      lastSyncedAt: cache?.lastSyncedAt ?? this.snapshot.lastSyncedAt,
      status: conflict
        ? "conflict"
        : operations.length > 0
          ? (this.snapshot.status === "offline" || this.snapshot.status === "authorization" ? this.snapshot.status : "saved-locally")
          : "synced",
    };
    this.emit();
  }

  private async syncNowInternal(force = false) {
    if (!this.sessionId) return;
    if (this.running) {
      if (force) this.rerunRequested = true;
      return;
    }
    this.running = true;
    try {
      await withSessionLock(this.sessionId, async () => {
        const operations = await listSyncOperations(this.userId, this.sessionId!);
        const conflict = operations.find((operation) => operation.status === "CONFLICT");
        if (conflict) {
          this.snapshot = { ...this.snapshot, status: "conflict", pendingCount: operations.length, conflictOperationId: conflict.operationId, lastErrorCode: conflict.lastErrorCode };
          this.emit();
          return;
        }
        if (operations.length === 0) {
          this.snapshot = { ...this.snapshot, status: "synced", pendingCount: 0, conflictOperationId: null };
          this.emit();
          return;
        }
        const operation = operations[0];
        if (!force && operation.nextAttemptAt > Date.now()) {
          this.schedule(operation.nextAttemptAt - Date.now());
          this.snapshot = { ...this.snapshot, status: "saved-locally", pendingCount: operations.length };
          this.emit();
          return;
        }
        this.snapshot = { ...this.snapshot, status: "syncing", pendingCount: operations.length, lastErrorCode: null };
        this.emit();
        await this.send(operation);
      });
    } finally {
      this.running = false;
      if (this.rerunRequested) {
        this.rerunRequested = false;
        globalThis.setTimeout(() => { void this.syncNow(true); }, 0);
      }
    }
  }

  private schedule(delay: number) {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.timer = null; void this.syncNow(); }, Math.max(250, delay));
  }

  private async send(operation: SyncOperation) {
    try {
      const canonical = await this.repository.applyIdempotentCommand({
        operationId: operation.operationId,
        sessionId: operation.sessionId,
        deviceId: operation.deviceId,
        expectedVersion: operation.expectedVersion,
        command: operation.command,
      });
      await acknowledgeOperation(operation.operationId, canonical);
      globalThis.setTimeout(() => { void this.syncNow(true); }, 0);
    } catch (error) {
      const repositoryError = error instanceof WorkoutRepositoryError
        ? error
        : new WorkoutRepositoryError("unknown", "ซิงก์การบันทึก Set ไม่สำเร็จ");
      if (repositoryError.code === "offline" || repositoryError.code === "server") {
        await markOperationRetry(operation, repositoryError.code);
        this.schedule(retryDelayMs(operation.attemptCount));
        this.snapshot = { ...this.snapshot, status: "offline", lastErrorCode: repositoryError.code };
        this.emit();
        return;
      }
      if (repositoryError.code === "authorization") {
        this.snapshot = { ...this.snapshot, status: "authorization", lastErrorCode: repositoryError.code };
        this.emit();
        return;
      }
      await markOperationConflict(operation, repositoryError.code);
      this.snapshot = { ...this.snapshot, status: "conflict", conflictOperationId: operation.operationId, lastErrorCode: repositoryError.code };
      this.emit();
    }
  }
}
