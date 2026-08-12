import type { HistoryListItem } from "../domain/history";
import type { WorkoutSession } from "../../workout/domain/workout";

const DB_NAME = "fitness-history-cache";
const DB_VERSION = 1;
const SUMMARY_STORE = "summaries";
const DETAIL_STORE = "details";

interface CachedSummary { userId: string; sessionId: string; item: HistoryListItem; savedAt: number }
interface CachedDetail { userId: string; sessionId: string; session: WorkoutSession; savedAt: number }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SUMMARY_STORE)) database.createObjectStore(SUMMARY_STORE, { keyPath: ["userId", "sessionId"] });
      if (!database.objectStoreNames.contains(DETAIL_STORE)) database.createObjectStore(DETAIL_STORE, { keyPath: ["userId", "sessionId"] });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("History cache unavailable"));
  });
}

async function readAll<T>(storeName: string, userId: string): Promise<T[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => {
      database.close();
      resolve((request.result as Array<T & { userId?: string }>).filter((item) => item.userId === userId));
    };
    request.onerror = () => { database.close(); reject(request.error ?? new Error("History cache read failed")); };
  });
}

export async function cacheHistoryPage(userId: string, items: HistoryListItem[]): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SUMMARY_STORE, "readwrite");
    const store = transaction.objectStore(SUMMARY_STORE);
    items.forEach((item) => store.put({ userId, item, sessionId: item.sessionId, savedAt: Date.now() } satisfies CachedSummary));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("History cache write failed")); };
  });
}

export async function loadCachedHistory(userId: string): Promise<HistoryListItem[]> {
  const rows = await readAll<CachedSummary>(SUMMARY_STORE, userId);
  return rows.sort((a, b) => Date.parse(b.item.completedAt) - Date.parse(a.item.completedAt)).slice(0, 50).map((row) => row.item);
}

export async function cacheHistoryDetail(userId: string, session: WorkoutSession): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DETAIL_STORE, "readwrite");
    transaction.objectStore(DETAIL_STORE).put({ userId, sessionId: session.id, session, savedAt: Date.now() } satisfies CachedDetail);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("History detail cache write failed")); };
  });
}

export async function loadCachedHistoryDetail(userId: string, sessionId: string): Promise<WorkoutSession | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(DETAIL_STORE, "readonly").objectStore(DETAIL_STORE).get([userId, sessionId]);
    request.onsuccess = () => { database.close(); resolve((request.result as CachedDetail | undefined)?.session ?? null); };
    request.onerror = () => { database.close(); reject(request.error ?? new Error("History detail cache read failed")); };
  });
}

export async function removeCachedHistory(userId: string, sessionId: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SUMMARY_STORE, DETAIL_STORE], "readwrite");
    const summaries = transaction.objectStore(SUMMARY_STORE);
    summaries.openCursor().onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return;
      if (cursor.value.userId === userId && cursor.value.sessionId === sessionId) cursor.delete();
      cursor.continue();
    };
    transaction.objectStore(DETAIL_STORE).delete([userId, sessionId]);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("History cache delete failed")); };
  });
}
