import {
  type OfflineWorkoutCommand,
  type OfflineSetCommand,
  type SessionSet,
  type SyncOperation,
  type WorkoutRepositoryErrorCode,
  type WorkoutSession,
} from "../domain/workout";
import {
  openWorkoutDatabase,
  WORKOUT_CACHE_STORE_NAME,
  WORKOUT_RECOVERY_STORE_NAME,
  WORKOUT_RECOVERY_RAW_STORE_NAME,
  WORKOUT_SYNC_STORE_NAME,
  type ActiveSessionCache,
  type RecoveryBundle,
  type RecoveryRawBundle,
} from "./activeSessionCache";

export class WorkoutQueueError extends Error {
  constructor(public readonly code: "cache-missing" | "duplicate" | "conflict" | "invalid" | "recovery-required", public readonly rawRecords?: unknown[]) {
    super(code);
    this.name = "WorkoutQueueError";
  }
}

const listeners = new Set<() => void>();

export function subscribeSyncChanges(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

function cloneSession(session: WorkoutSession): WorkoutSession {
  return structuredClone(session);
}

function isLifecycleCommand(command: OfflineWorkoutCommand): command is Extract<OfflineWorkoutCommand, { action: "finish_session" | "discard_session" }> {
  return command.action === "finish_session" || command.action === "discard_session";
}

function valuesFromCommand(command: Extract<OfflineSetCommand, { action: "complete_set" | "edit_set" }>) {
  return {
    actualWeight: command.actualWeight,
    actualReps: command.actualReps,
    actualEffort: command.actualEffort,
  };
}

function addedSet(command: Extract<OfflineSetCommand, { action: "add_set" }>): SessionSet {
  return {
    id: command.setId,
    sourceTemplateSetId: null,
    sequence: command.sequence,
    kind: command.kind,
    isToFailure: false,
    targetRepsMin: command.targetRepsMin,
    targetRepsMax: command.targetRepsMax,
    targetWeight: command.targetWeight,
    targetEffort: command.targetEffort,
    targetRestSeconds: command.targetRestSeconds,
    actualWeight: null,
    actualReps: null,
    actualEffort: null,
    actualRestSeconds: null,
    status: "PENDING",
    completedAt: null,
    notes: "",
  };
}

export function applyOfflineSetCommand(session: WorkoutSession, command: OfflineSetCommand, changedAt = new Date().toISOString()): WorkoutSession {
  const next = cloneSession(session);
  if (command.action === "add_set") {
    if (next.exercises.some((exercise) => exercise.sets.some((set) => set.id === command.setId))) {
      throw new WorkoutQueueError("duplicate");
    }
    const exercise = next.exercises.find((candidate) => candidate.id === command.sessionExerciseId);
    if (!exercise || command.sequence !== exercise.sets.length + 1) throw new WorkoutQueueError("invalid");
    exercise.sets.push(addedSet(command));
    next.editedAt = changedAt;
    return next;
  }

  const exercise = next.exercises.find((candidate) => candidate.sets.some((set) => set.id === command.setId));
  const set = exercise?.sets.find((candidate) => candidate.id === command.setId);
  if (!exercise || !set) throw new WorkoutQueueError("invalid");

  switch (command.action) {
    case "complete_set":
      if (set.status !== "PENDING") throw new WorkoutQueueError("duplicate");
      Object.assign(set, valuesFromCommand(command), { status: "COMPLETED", completedAt: changedAt });
      break;
    case "edit_set":
      if (set.status !== "COMPLETED") throw new WorkoutQueueError("invalid");
      Object.assign(set, valuesFromCommand(command));
      break;
    case "skip_set":
      if (set.status !== "PENDING") throw new WorkoutQueueError("duplicate");
      set.status = "SKIPPED";
      set.completedAt = null;
      break;
    case "delete_set":
      if (exercise.sets.length <= 1) throw new WorkoutQueueError("invalid");
      exercise.sets = exercise.sets
        .filter((candidate) => candidate.id !== command.setId)
        .map((candidate, index) => ({ ...candidate, sequence: index + 1 }));
      break;
  }
  next.editedAt = changedAt;
  return next;
}

export function applyOfflineWorkoutCommand(session: WorkoutSession, command: OfflineWorkoutCommand, changedAt = new Date().toISOString()): WorkoutSession {
  if (!isLifecycleCommand(command)) return applyOfflineSetCommand(session, command, changedAt);
  if (session.status !== "ACTIVE") throw new WorkoutQueueError("invalid");
  const next = cloneSession(session);
  next.status = command.action === "finish_session" ? "COMPLETED" : "DISCARDED";
  next.completedAt = command.action === "finish_session" ? changedAt : null;
  next.editedAt = changedAt;
  return next;
}

export function projectPendingOperations(acknowledged: WorkoutSession, operations: SyncOperation[]) {
  return operations
    .filter((operation) => operation.status === "PENDING")
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt || a.operationId.localeCompare(b.operationId))
    .reduce((session, operation) => applyOfflineWorkoutCommand(session, operation.command, new Date(operation.createdAt).toISOString()), cloneSession(acknowledged));
}

export function expectedVersionForPending(acknowledged: WorkoutSession, operations: SyncOperation[]) {
  return acknowledged.version + operations.filter((operation) => operation.status === "PENDING").length;
}

export function retryDelayMs(attemptCount: number) {
  return Math.min(30_000, 1_000 * (2 ** attemptCount));
}

export async function listSyncOperations(userId: string, sessionId?: string) {
  const database = await openWorkoutDatabase();
  return new Promise<SyncOperation[]>((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_SYNC_STORE_NAME, "readonly");
    const request = transaction.objectStore(WORKOUT_SYNC_STORE_NAME).getAll();
    request.onsuccess = () => {
      const rows = request.result as unknown[];
      const ownedRows = rows.filter((value) => value && typeof value === "object" && (value as { userId?: unknown }).userId === userId);
      if (ownedRows.some((value) => !isValidSyncOperation(value))) {
        reject(new WorkoutQueueError("recovery-required", ownedRows.filter((value) => !isValidSyncOperation(value))));
        return;
      }
      resolve((ownedRows as SyncOperation[]).filter((operation) => !sessionId || operation.sessionId === sessionId).sort((a, b) => a.createdAt - b.createdAt));
    };
    request.onerror = () => reject(request.error ?? new Error("Could not read workout queue"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not read workout queue"));
  });
}

function isValidSyncOperation(value: unknown): value is SyncOperation {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<SyncOperation>;
  return typeof row.operationId === "string" && typeof row.userId === "string" && typeof row.sessionId === "string" && typeof row.deviceId === "string" && typeof row.expectedVersion === "number" && typeof row.createdAt === "number" && (row.status === "PENDING" || row.status === "CONFLICT") && Boolean(row.command && typeof row.command === "object" && typeof (row.command as { action?: unknown }).action === "string");
}

export async function enqueueOfflineWorkoutCommand(input: {
  cache: ActiveSessionCache;
  userId: string;
  deviceId: string;
  command: OfflineWorkoutCommand;
}): Promise<{ cache: ActiveSessionCache; operation: SyncOperation }> {
  const database = await openWorkoutDatabase();
  const operationId = crypto.randomUUID();
  const now = Date.now();
  const operation: SyncOperation = {
    operationId,
    userId: input.userId,
    sessionId: input.cache.sessionId,
    deviceId: input.deviceId,
    command: input.command,
    expectedVersion: input.cache.acknowledgedSession?.version ?? input.cache.session.version,
    createdAt: now,
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: 0,
    status: "PENDING",
    lastErrorCode: null,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([WORKOUT_CACHE_STORE_NAME, WORKOUT_SYNC_STORE_NAME], "readwrite");
    const cacheStore = transaction.objectStore(WORKOUT_CACHE_STORE_NAME);
    const operationStore = transaction.objectStore(WORKOUT_SYNC_STORE_NAME);
    const cacheRequest = cacheStore.get(input.cache.sessionId);
    let result: { cache: ActiveSessionCache; operation: SyncOperation } | null = null;
    cacheRequest.onsuccess = () => {
      const current = cacheRequest.result as ActiveSessionCache | undefined;
      if (!current || (current.userId && current.userId !== input.userId)) {
        transaction.abort();
        reject(new WorkoutQueueError("cache-missing"));
        return;
      }
      const acknowledgedSession = current.acknowledgedSession ?? current.session;
      const operationsRequest = operationStore.getAll();
      operationsRequest.onsuccess = () => {
        const operations = (operationsRequest.result as SyncOperation[]).filter((item) => item.sessionId === current.sessionId && item.userId === input.userId);
        if (operations.some((item) => item.status === "CONFLICT")) {
          transaction.abort();
          reject(new WorkoutQueueError("conflict"));
          return;
        }
        const hasPendingTerminal = operations.some((item) => item.status === "PENDING" && isLifecycleCommand(item.command));
        if (hasPendingTerminal || (isLifecycleCommand(input.command) && current.session.status !== "ACTIVE")) {
          transaction.abort();
          reject(new WorkoutQueueError("invalid"));
          return;
        }
        if (!isLifecycleCommand(input.command) && current.session.status !== "ACTIVE") {
          transaction.abort();
          reject(new WorkoutQueueError("invalid"));
          return;
        }
        operation.expectedVersion = expectedVersionForPending(acknowledgedSession, operations);
        let nextSession: WorkoutSession;
        try {
          nextSession = applyOfflineWorkoutCommand(current.session, input.command, new Date(now).toISOString());
        } catch (error) {
          transaction.abort();
          reject(error);
          return;
        }
        const nextCache: ActiveSessionCache = {
          ...current,
          userId: input.userId,
          session: nextSession,
          acknowledgedSession,
          cachedAt: now,
        };
        cacheStore.put(nextCache);
        operationStore.put(operation);
        result = { cache: nextCache, operation };
      };
      operationsRequest.onerror = () => transaction.abort();
    };
    cacheRequest.onerror = () => transaction.abort();
    transaction.oncomplete = () => {
      database.close();
      if (result) {
        notify();
        resolve(result);
      } else reject(new WorkoutQueueError("invalid"));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not enqueue workout operation"));
    };
    transaction.onabort = () => database.close();
  });
}

export async function acknowledgeOperation(operationId: string, canonical: WorkoutSession) {
  const database = await openWorkoutDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([WORKOUT_CACHE_STORE_NAME, WORKOUT_SYNC_STORE_NAME], "readwrite");
    const operationStore = transaction.objectStore(WORKOUT_SYNC_STORE_NAME);
    const cacheStore = transaction.objectStore(WORKOUT_CACHE_STORE_NAME);
    const operationRequest = operationStore.get(operationId);
    operationRequest.onsuccess = () => {
      const operation = operationRequest.result as SyncOperation | undefined;
      if (!operation) return;
      const cacheRequest = cacheStore.get(operation.sessionId);
      cacheRequest.onsuccess = () => {
        const current = cacheRequest.result as ActiveSessionCache | undefined;
        if (!current || current.userId !== operation.userId) return;
        const all = operationStore.getAll();
        all.onsuccess = () => {
          const pending = (all.result as SyncOperation[]).filter((item) => item.sessionId === operation.sessionId && item.userId === operation.userId && item.operationId !== operation.operationId && item.status === "PENDING");
          cacheStore.put({
            ...current,
            acknowledgedSession: canonical,
            session: projectPendingOperations(canonical, pending),
            lastSyncedAt: Date.now(),
            cachedAt: Date.now(),
          });
          operationStore.delete(operation.operationId);
        };
      };
    };
    transaction.oncomplete = () => { database.close(); notify(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Could not acknowledge workout operation")); };
  });
}

export async function markOperationRetry(operation: SyncOperation, code: WorkoutRepositoryErrorCode, now = Date.now()) {
  const database = await openWorkoutDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_SYNC_STORE_NAME, "readwrite");
    const next = { ...operation, attemptCount: operation.attemptCount + 1, lastAttemptAt: now, nextAttemptAt: now + retryDelayMs(operation.attemptCount), lastErrorCode: code, status: "PENDING" as const };
    transaction.objectStore(WORKOUT_SYNC_STORE_NAME).put(next);
    transaction.oncomplete = () => { database.close(); notify(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Could not update workout operation")); };
  });
}

export async function markOperationConflict(operation: SyncOperation, code: WorkoutRepositoryErrorCode, now = Date.now()) {
  const database = await openWorkoutDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_SYNC_STORE_NAME, "readwrite");
    transaction.objectStore(WORKOUT_SYNC_STORE_NAME).put({ ...operation, attemptCount: operation.attemptCount + 1, lastAttemptAt: now, lastErrorCode: code, status: "CONFLICT" as const });
    transaction.oncomplete = () => { database.close(); notify(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Could not mark workout conflict")); };
  });
}

export async function retryConflictedOperation(operationId: string) {
  const database = await openWorkoutDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_SYNC_STORE_NAME, "readwrite");
    const request = transaction.objectStore(WORKOUT_SYNC_STORE_NAME).get(operationId);
    request.onsuccess = () => {
      const operation = request.result as SyncOperation | undefined;
      if (!operation || operation.status !== "CONFLICT") return;
      // A conflict is a recovery decision, not a retryable transport failure.
      // Leave it in CONFLICT so the user cannot accidentally replay the stale
      // expected version and overwrite the local projection.
      transaction.abort();
    };
    transaction.oncomplete = () => { database.close(); notify(); resolve(); };
    transaction.onerror = () => { database.close(); reject(new WorkoutQueueError("conflict")); };
    transaction.onabort = () => { database.close(); reject(new WorkoutQueueError("conflict")); };
  });
}

export async function listRecoveryBundles(userId: string): Promise<RecoveryBundle[]> {
  const database = await openWorkoutDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_RECOVERY_STORE_NAME, "readonly");
    const request = transaction.objectStore(WORKOUT_RECOVERY_STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as RecoveryBundle[]).filter((bundle) => bundle.userId === userId).sort((a, b) => b.archivedAt - a.archivedAt));
    request.onerror = () => reject(request.error ?? new Error("Could not read recovery archive"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not read recovery archive"));
  });
}

export async function listRecoveryRawRecords(userId: string): Promise<RecoveryRawBundle[]> {
  const database = await openWorkoutDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_RECOVERY_RAW_STORE_NAME, "readonly");
    const request = transaction.objectStore(WORKOUT_RECOVERY_RAW_STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as RecoveryRawBundle[]).filter((bundle) => bundle.userId === userId).sort((a, b) => b.archivedAt - a.archivedAt));
    request.onerror = () => reject(request.error ?? new Error("Could not read raw recovery archive"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not read raw recovery archive"));
  });
}

export async function archiveCorruptRecords(userId: string, rawRecords: unknown[], reason = "corrupt-queue") {
  const database = await openWorkoutDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([WORKOUT_RECOVERY_RAW_STORE_NAME, WORKOUT_SYNC_STORE_NAME], "readwrite");
    transaction.objectStore(WORKOUT_RECOVERY_RAW_STORE_NAME).put({ id: crypto.randomUUID(), userId, reason, archivedAt: Date.now(), rawRecords: structuredClone(rawRecords) });
    const operationStore = transaction.objectStore(WORKOUT_SYNC_STORE_NAME);
    const cursorRequest = operationStore.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      if (cursor.value && typeof cursor.value === "object" && (cursor.value as { userId?: unknown }).userId === userId && !isValidSyncOperation(cursor.value)) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Could not archive corrupt records")); };
  });
}

export async function archiveCorruptCacheRecord(userId: string, sessionId: string, rawRecord: unknown) {
  const database = await openWorkoutDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([WORKOUT_RECOVERY_RAW_STORE_NAME, WORKOUT_CACHE_STORE_NAME], "readwrite");
    transaction.objectStore(WORKOUT_RECOVERY_RAW_STORE_NAME).put({ id: crypto.randomUUID(), userId, reason: "corrupt-cache", archivedAt: Date.now(), rawRecords: [structuredClone(rawRecord)] });
    transaction.objectStore(WORKOUT_CACHE_STORE_NAME).delete(sessionId);
    transaction.oncomplete = () => { database.close(); notify(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Could not archive corrupt workout cache")); };
  });
}

function emptyCacheFromServer(serverSession: WorkoutSession, userId: string, current: ActiveSessionCache | undefined): ActiveSessionCache {
  return {
    sessionId: serverSession.id,
    userId,
    session: serverSession,
    acknowledgedSession: serverSession,
    draftValues: {},
    currentExerciseId: serverSession.exercises[0]?.id ?? null,
    timer: { status: "idle", durationSeconds: 0, endsAt: null, pausedRemainingSeconds: 0 },
    cachedAt: Date.now(),
    lastSyncedAt: Date.now(),
    ...(current ? { currentExerciseId: current.currentExerciseId && serverSession.exercises.some((exercise) => exercise.id === current.currentExerciseId) ? current.currentExerciseId : (serverSession.exercises[0]?.id ?? null) } : {}),
  };
}

async function archiveSession(input: {
  userId: string;
  sessionId: string;
  reason: string;
  serverSession: WorkoutSession | null;
  ownerDevice: import("../domain/workout").WorkoutDevice | null;
  replaceWithServer: boolean;
}) {
  const database = await openWorkoutDatabase();
  return new Promise<RecoveryBundle>((resolve, reject) => {
    const transaction = database.transaction([WORKOUT_CACHE_STORE_NAME, WORKOUT_SYNC_STORE_NAME, WORKOUT_RECOVERY_STORE_NAME], "readwrite");
    const cacheStore = transaction.objectStore(WORKOUT_CACHE_STORE_NAME);
    const operationStore = transaction.objectStore(WORKOUT_SYNC_STORE_NAME);
    const recoveryStore = transaction.objectStore(WORKOUT_RECOVERY_STORE_NAME);
    const cacheRequest = cacheStore.get(input.sessionId);
    const operationsRequest = operationStore.getAll();
    let result: RecoveryBundle | null = null;
    let current: ActiveSessionCache | undefined;
    let operations: SyncOperation[] = [];
    function finishRead() {
      if (result) return;
      const scoped = operations.filter((operation) => operation.userId === input.userId && operation.sessionId === input.sessionId);
      if (current && current.userId && current.userId !== input.userId) { transaction.abort(); return; }
      const localSession = current?.session ?? input.serverSession;
      const acknowledgedSession = current?.acknowledgedSession ?? input.serverSession;
      if (!localSession || !acknowledgedSession) { transaction.abort(); return; }
      result = {
        id: crypto.randomUUID(),
        userId: input.userId,
        sessionId: input.sessionId,
        reason: input.reason,
        archivedAt: Date.now(),
        localSession,
        acknowledgedSession,
        operations: scoped,
        serverSession: input.serverSession,
        ownerDevice: input.ownerDevice,
      };
      recoveryStore.put(result);
      scoped.forEach((operation) => operationStore.delete(operation.operationId));
      if (input.replaceWithServer && input.serverSession) cacheStore.put(emptyCacheFromServer(input.serverSession, input.userId, current));
      else cacheStore.delete(input.sessionId);
    }
    cacheRequest.onsuccess = () => { current = cacheRequest.result as ActiveSessionCache | undefined; if (operationsRequest.readyState === "done") finishRead(); };
    operationsRequest.onsuccess = () => { operations = operationsRequest.result as SyncOperation[]; if (cacheRequest.readyState === "done") finishRead(); };
    cacheRequest.onerror = () => transaction.abort();
    operationsRequest.onerror = () => transaction.abort();
    transaction.oncomplete = () => { database.close(); if (result) { notify(); resolve(result); } else reject(new WorkoutQueueError("cache-missing")); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Could not archive workout conflict")); };
    transaction.onabort = () => { database.close(); reject(new WorkoutQueueError("cache-missing")); };
  });
}

export function archiveAndUseServer(input: { userId: string; sessionId: string; serverSession: WorkoutSession; ownerDevice: import("../domain/workout").WorkoutDevice | null; reason: string }) {
  return archiveSession({ ...input, replaceWithServer: true });
}

export function archiveAfterRemoteAbandon(input: { userId: string; sessionId: string; serverSession: WorkoutSession | null; ownerDevice: import("../domain/workout").WorkoutDevice | null; reason: string }) {
  return archiveSession({ ...input, replaceWithServer: false });
}
