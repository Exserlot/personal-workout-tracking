import type { HistoryListItem } from "../domain/history";
import { historySummaryFromSession } from "../domain/history";
import type { WorkoutSession } from "../../workout/domain/workout";

const DB_NAME = "fitness-history-cache";
const DB_VERSION = 2;
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
      for (const name of [SUMMARY_STORE, DETAIL_STORE]) {
        const store = database.objectStoreNames.contains(name) ? request.transaction?.objectStore(name) : database.createObjectStore(name, { keyPath: ["userId", "sessionId"] });
        if (store && !store.indexNames.contains("user_savedAt")) store.createIndex("user_savedAt", ["userId", "savedAt"], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("History cache unavailable"));
  });
}

function isSummary(value: unknown): value is CachedSummary {
  if (!value || typeof value !== "object") return false;
  const row = value as CachedSummary;
  return typeof row.userId === "string" && typeof row.sessionId === "string" && typeof row.savedAt === "number" && Boolean(row.item && row.item.sessionId === row.sessionId && typeof row.item.completedAt === "string" && ["PLANNED", "AD_HOC"].includes(row.item.sourceType) && Number.isFinite(row.item.durationSeconds) && Number.isFinite(row.item.exerciseCount) && Number.isFinite(row.item.volumeKg));
}

function isDetail(value: unknown): value is CachedDetail {
  if (!value || typeof value !== "object") return false;
  const row = value as CachedDetail;
  return typeof row.userId === "string" && typeof row.sessionId === "string" && typeof row.savedAt === "number" && Boolean(row.session && row.session.id === row.sessionId && Number.isInteger(row.session.version) && row.session.version > 0 && ["ACTIVE", "COMPLETED", "DISCARDED"].includes(row.session.status) && Array.isArray(row.session.exercises) && typeof row.session.startedAt === "string");
}

function prune(store: IDBObjectStore, userId: string, max: number): void {
  const request = store.index("user_savedAt").getAll(IDBKeyRange.bound([userId, 0], [userId, Number.MAX_SAFE_INTEGER]));
  request.onsuccess = () => {
    const rows = (request.result as unknown[]).sort((a, b) => (Number((a as { savedAt?: number }).savedAt) || 0) - (Number((b as { savedAt?: number }).savedAt) || 0));
    rows.slice(0, Math.max(0, rows.length - max)).forEach((row) => store.delete([(row as { userId: string }).userId, (row as { sessionId: string }).sessionId]));
  };
}

export async function cacheHistoryPage(userId: string, items: HistoryListItem[]): Promise<void> {
  if (!userId) return;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SUMMARY_STORE, "readwrite");
    const store = transaction.objectStore(SUMMARY_STORE);
    const savedAt = Date.now();
    items.forEach((item) => store.put({ userId, item, sessionId: item.sessionId, savedAt } satisfies CachedSummary));
    prune(store, userId, 50);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("History cache write failed")); };
  });
}

export async function loadCachedHistory(userId: string): Promise<HistoryListItem[]> {
  if (!userId) return [];
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SUMMARY_STORE, "readwrite");
    const store = transaction.objectStore(SUMMARY_STORE);
    const request = store.index("user_savedAt").getAll(IDBKeyRange.bound([userId, 0], [userId, Number.MAX_SAFE_INTEGER]));
    request.onsuccess = () => {
      const valid: HistoryListItem[] = [];
      (request.result as unknown[]).forEach((row) => { if (isSummary(row)) valid.push(row.item); else if (row && typeof row === "object") store.delete([(row as CachedSummary).userId, (row as CachedSummary).sessionId]); });
      database.close(); resolve(valid.sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)).slice(0, 50));
    };
    request.onerror = () => { database.close(); reject(request.error ?? new Error("History cache read failed")); };
  });
}

export async function cacheHistoryDetail(userId: string, session: WorkoutSession): Promise<void> {
  if (!userId) return;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([DETAIL_STORE, SUMMARY_STORE], "readwrite");
    const savedAt = Date.now();
    transaction.objectStore(DETAIL_STORE).put({ userId, sessionId: session.id, session, savedAt } satisfies CachedDetail);
    transaction.objectStore(SUMMARY_STORE).put({ userId, sessionId: session.id, item: historySummaryFromSession(session), savedAt } satisfies CachedSummary);
    prune(transaction.objectStore(DETAIL_STORE), userId, 20);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("History detail cache write failed")); };
  });
}

export async function loadCachedHistoryDetail(userId: string, sessionId: string): Promise<WorkoutSession | null> {
  if (!userId) return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DETAIL_STORE, "readwrite");
    const request = transaction.objectStore(DETAIL_STORE).get([userId, sessionId]);
    request.onsuccess = () => { const row = request.result; if (!isDetail(row)) { if (row) transaction.objectStore(DETAIL_STORE).delete([userId, sessionId]); database.close(); resolve(null); return; } database.close(); resolve(row.session); };
    request.onerror = () => { database.close(); reject(request.error ?? new Error("History detail cache read failed")); };
  });
}

export async function removeCachedHistory(userId: string, sessionId: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SUMMARY_STORE, DETAIL_STORE], "readwrite");
    transaction.objectStore(SUMMARY_STORE).delete([userId, sessionId]);
    transaction.objectStore(DETAIL_STORE).delete([userId, sessionId]);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("History cache delete failed")); };
  });
}
