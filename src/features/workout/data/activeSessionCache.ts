import { type WorkoutSession } from "../domain/workout";

export const WORKOUT_CACHE_DB_NAME = "personal-workout-tracker";
export const WORKOUT_CACHE_STORE_NAME = "active-session-cache";
export const WORKOUT_SYNC_STORE_NAME = "workout-sync-operations";
export const WORKOUT_RECOVERY_STORE_NAME = "workout-recovery-bundles";
export const WORKOUT_RECOVERY_RAW_STORE_NAME = "workout-recovery-raw";
export const WORKOUT_CACHE_DB_VERSION = 4;

export interface WorkoutDraftValue {
  weight: string;
  weightUnit: "KG" | "LB";
  reps: string;
  effortMetric: "RPE" | "RIR" | "";
  effort: string;
}

export interface WorkoutTimerCache {
  status: "idle" | "running" | "paused";
  durationSeconds: number;
  endsAt: number | null;
  pausedRemainingSeconds: number;
}

export interface ActiveSessionCache {
  sessionId: string;
  userId?: string;
  session: WorkoutSession;
  acknowledgedSession?: WorkoutSession;
  draftValues: Record<string, WorkoutDraftValue>;
  currentExerciseId: string | null;
  timer: WorkoutTimerCache;
  cachedAt: number;
  lastSyncedAt?: number | null;
}

export interface RecoveryBundle {
  id: string;
  userId: string;
  sessionId: string;
  reason: string;
  archivedAt: number;
  localSession: WorkoutSession;
  acknowledgedSession: WorkoutSession;
  operations: import("../domain/workout").SyncOperation[];
  serverSession: WorkoutSession | null;
  ownerDevice: import("../domain/workout").WorkoutDevice | null;
}

export interface RecoveryRawBundle {
  id: string;
  userId: string;
  reason: string;
  archivedAt: number;
  rawRecords: unknown[];
}

export class WorkoutCacheError extends Error {
  readonly code = "recovery-required" as const;

  constructor(public readonly rawRecord: unknown) {
    super("Workout cache requires recovery");
    this.name = "WorkoutCacheError";
  }
}

export function openWorkoutDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(WORKOUT_CACHE_DB_NAME, WORKOUT_CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WORKOUT_CACHE_STORE_NAME)) {
        database.createObjectStore(WORKOUT_CACHE_STORE_NAME, { keyPath: "sessionId" });
      }
      if (!database.objectStoreNames.contains(WORKOUT_SYNC_STORE_NAME)) {
        const store = database.createObjectStore(WORKOUT_SYNC_STORE_NAME, { keyPath: "operationId" });
        store.createIndex("by-session-created", ["sessionId", "createdAt", "operationId"], { unique: false });
        store.createIndex("by-user-status", ["userId", "status"], { unique: false });
      }
      if (!database.objectStoreNames.contains(WORKOUT_RECOVERY_STORE_NAME)) {
        const store = database.createObjectStore(WORKOUT_RECOVERY_STORE_NAME, { keyPath: "id" });
        store.createIndex("by-user-archived", ["userId", "archivedAt"], { unique: false });
      }
      if (!database.objectStoreNames.contains(WORKOUT_RECOVERY_RAW_STORE_NAME)) {
        const store = database.createObjectStore(WORKOUT_RECOVERY_RAW_STORE_NAME, { keyPath: "id" });
        store.createIndex("by-user-archived", ["userId", "archivedAt"], { unique: false });
      }
      if (database.objectStoreNames.contains("active-workout")) {
        database.deleteObjectStore("active-workout");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open workout cache"));
  });
}

function normalizeCache(value: unknown): ActiveSessionCache | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ActiveSessionCache>;
  const session = candidate.session;
  if (typeof candidate.sessionId !== "string" || !session || typeof session !== "object" || typeof session.id !== "string" || typeof session.version !== "number" || !Array.isArray(session.exercises) || !["ACTIVE", "COMPLETED", "DISCARDED"].includes(session.status)) throw new WorkoutCacheError(value);
  if (candidate.userId !== undefined && typeof candidate.userId !== "string") throw new WorkoutCacheError(value);
  if (!candidate.draftValues || typeof candidate.draftValues !== "object" || !candidate.timer || typeof candidate.timer !== "object") throw new WorkoutCacheError(value);
  return {
    ...candidate,
    sessionId: candidate.sessionId,
    session,
    draftValues: candidate.draftValues,
    timer: candidate.timer,
    acknowledgedSession: candidate.acknowledgedSession ?? session,
    currentExerciseId: typeof candidate.currentExerciseId === "string" || candidate.currentExerciseId === null ? candidate.currentExerciseId : session.exercises[0]?.id ?? null,
    cachedAt: typeof candidate.cachedAt === "number" ? candidate.cachedAt : Date.now(),
    lastSyncedAt: candidate.lastSyncedAt ?? candidate.cachedAt ?? null,
  };
}

export async function loadSessionCache(sessionId: string, userId?: string): Promise<ActiveSessionCache | null> {
  const database = await openWorkoutDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_CACHE_STORE_NAME, "readonly");
    const request = transaction.objectStore(WORKOUT_CACHE_STORE_NAME).get(sessionId);
    request.onsuccess = () => {
      try {
        const cache = normalizeCache(request.result as ActiveSessionCache | null);
        resolve(cache && (!userId || !cache.userId || cache.userId === userId) ? cache : null);
      } catch (error) {
        database.close();
        reject(error);
      }
    };
    request.onerror = () => reject(request.error ?? new Error("Could not load workout cache"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not read workout cache"));
  });
}

export async function loadLatestSessionCache(userId?: string): Promise<ActiveSessionCache | null> {
  const database = await openWorkoutDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_CACHE_STORE_NAME, "readonly");
    const request = transaction.objectStore(WORKOUT_CACHE_STORE_NAME).getAll();
    request.onsuccess = () => {
      try {
        const caches = (request.result as ActiveSessionCache[])
          .map(normalizeCache)
          .filter((cache): cache is ActiveSessionCache => Boolean(cache && (!userId || !cache.userId || cache.userId === userId)))
          .sort((a, b) => b.cachedAt - a.cachedAt);
        resolve(caches[0] ?? null);
      } catch (error) {
        database.close();
        reject(error);
      }
    };
    request.onerror = () => reject(request.error ?? new Error("Could not load latest workout cache"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not read workout cache"));
  });
}

export async function listSessionCaches(userId: string): Promise<ActiveSessionCache[]> {
  const database = await openWorkoutDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_CACHE_STORE_NAME, "readonly");
    const request = transaction.objectStore(WORKOUT_CACHE_STORE_NAME).getAll();
    request.onsuccess = () => {
      try {
        const owned = (request.result as unknown[]).filter((value) => value && typeof value === "object" && (value as { userId?: unknown }).userId === userId);
        resolve(owned.map(normalizeCache).filter((cache): cache is ActiveSessionCache => Boolean(cache)).sort((a, b) => b.cachedAt - a.cachedAt));
      } catch (error) {
        database.close();
        reject(error);
      }
    };
    request.onerror = () => reject(request.error ?? new Error("Could not inspect workout caches"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not inspect workout caches"));
  });
}

export async function saveSessionCache(cache: ActiveSessionCache): Promise<void> {
  const database = await openWorkoutDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_CACHE_STORE_NAME, "readwrite");
    transaction.objectStore(WORKOUT_CACHE_STORE_NAME).put({
      ...cache,
      acknowledgedSession: cache.acknowledgedSession ?? cache.session,
      cachedAt: Date.now(),
    });
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Could not save workout cache")); };
  });
}
