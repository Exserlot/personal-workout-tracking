import { type WorkoutSession } from "../domain/workout";

export const WORKOUT_CACHE_DB_NAME = "personal-workout-tracker";
export const WORKOUT_CACHE_STORE_NAME = "active-session-cache";

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
  session: WorkoutSession;
  draftValues: Record<string, WorkoutDraftValue>;
  currentExerciseId: string | null;
  timer: WorkoutTimerCache;
  cachedAt: number;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(WORKOUT_CACHE_DB_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WORKOUT_CACHE_STORE_NAME)) {
        database.createObjectStore(WORKOUT_CACHE_STORE_NAME, { keyPath: "sessionId" });
      }
      if (database.objectStoreNames.contains("active-workout")) {
        database.deleteObjectStore("active-workout");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open workout cache"));
  });
}

export async function loadSessionCache(sessionId: string): Promise<ActiveSessionCache | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_CACHE_STORE_NAME, "readonly");
    const request = transaction.objectStore(WORKOUT_CACHE_STORE_NAME).get(sessionId);
    request.onsuccess = () => resolve(request.result as ActiveSessionCache | null);
    request.onerror = () => reject(request.error ?? new Error("Could not load workout cache"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not read workout cache"));
  });
}

export async function loadLatestSessionCache(): Promise<ActiveSessionCache | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_CACHE_STORE_NAME, "readonly");
    const request = transaction.objectStore(WORKOUT_CACHE_STORE_NAME).getAll();
    request.onsuccess = () => {
      const caches = (request.result as ActiveSessionCache[]).sort((a, b) => b.cachedAt - a.cachedAt);
      resolve(caches[0] ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error("Could not load latest workout cache"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not read workout cache"));
  });
}

export async function saveSessionCache(cache: ActiveSessionCache) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_CACHE_STORE_NAME, "readwrite");
    transaction.objectStore(WORKOUT_CACHE_STORE_NAME).put({ ...cache, cachedAt: Date.now() });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save workout cache"));
    };
  });
}

export async function clearSessionCache(sessionId: string) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WORKOUT_CACHE_STORE_NAME, "readwrite");
    transaction.objectStore(WORKOUT_CACHE_STORE_NAME).delete(sessionId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not clear workout cache"));
    };
  });
}
