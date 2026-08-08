import {
  hydrateActiveWorkoutState,
  type ActiveWorkoutState,
} from "../domain/setLogging";

export const ACTIVE_WORKOUT_DB_NAME = "personal-workout-tracker";
export const ACTIVE_WORKOUT_STORE_NAME = "active-workout";
const ACTIVE_WORKOUT_KEY = "active-session";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser"));
      return;
    }

    const request = indexedDB.open(ACTIVE_WORKOUT_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ACTIVE_WORKOUT_STORE_NAME)) {
        database.createObjectStore(ACTIVE_WORKOUT_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open workout storage"));
  });
}

export async function loadActiveWorkout(): Promise<ActiveWorkoutState | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ACTIVE_WORKOUT_STORE_NAME, "readonly");
    const request = transaction.objectStore(ACTIVE_WORKOUT_STORE_NAME).get(ACTIVE_WORKOUT_KEY);
    request.onsuccess = () => resolve(hydrateActiveWorkoutState(request.result));
    request.onerror = () => reject(request.error ?? new Error("Could not load active workout"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not read active workout"));
  });
}

export async function saveActiveWorkout(state: ActiveWorkoutState): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ACTIVE_WORKOUT_STORE_NAME, "readwrite");
    transaction.objectStore(ACTIVE_WORKOUT_STORE_NAME).put({ ...state, id: ACTIVE_WORKOUT_KEY });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save active workout"));
    };
  });
}
