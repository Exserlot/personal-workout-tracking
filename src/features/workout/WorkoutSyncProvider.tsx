import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { useWorkoutRepository } from "./WorkoutRepositoryContext";
import { WorkoutSyncCoordinator } from "./data/WorkoutSyncCoordinator";
import { listSessionCaches, loadSessionCache, WorkoutCacheError } from "./data/activeSessionCache";
import { archiveAfterRemoteAbandon, archiveAndUseServer, archiveCorruptCacheRecord, archiveCorruptRecords, listRecoveryBundles, listRecoveryRawRecords, listSyncOperations, subscribeSyncChanges, WorkoutQueueError } from "./data/workoutSyncStore";
import { WorkoutSyncContext, type WorkoutSessionSyncSummary, type WorkoutSyncController, type WorkoutSyncOverview } from "./WorkoutSyncContext";
import { WorkoutRepositoryError, type WorkoutConflictDetail } from "./domain/workout";
import { telemetry } from "../../lib/telemetry/telemetry";

export function WorkoutSyncProvider({ children }: { children: ReactNode }) {
  const repository = useWorkoutRepository();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const coordinator = useMemo(() => new WorkoutSyncCoordinator(repository, userId), [repository, userId]);
  const overviewRef = useRef<WorkoutSyncOverview>({ status: "synced", pendingCount: 0, conflictCount: 0, lastSyncedAt: null, sessions: [], recoveryCount: 0 });
  const overviewListeners = useRef(new Set<() => void>());
  const lastTelemetryState = useRef("");

  const refreshOverview = useCallback(async () => {
    if (!userId) {
      overviewRef.current = { status: "synced", pendingCount: 0, conflictCount: 0, lastSyncedAt: null, sessions: [], recoveryCount: 0 };
      return;
    }
    try {
      await listSessionCaches(userId);
      const operations = await listSyncOperations(userId);
      const grouped = new Map<string, typeof operations>();
      operations.forEach((operation) => grouped.set(operation.sessionId, [...(grouped.get(operation.sessionId) ?? []), operation]));
      const sessions: WorkoutSessionSyncSummary[] = [];
      for (const [sessionId, sessionOperations] of grouped) {
        const cache = await loadSessionCache(sessionId, userId).catch(() => null);
        const conflict = sessionOperations.find((operation) => operation.status === "CONFLICT");
        const lastErrorCode = conflict?.lastErrorCode ?? sessionOperations[0]?.lastErrorCode ?? null;
        const status = conflict ? "conflict" : lastErrorCode === "offline" ? "offline" : lastErrorCode === "authorization" ? "authorization" : lastErrorCode === "server" ? "offline" : "saved-locally";
        sessions.push({ sessionId, status, pendingCount: sessionOperations.length, conflict: Boolean(conflict), lastErrorCode, localSession: cache?.session ?? null, ownerDeviceId: cache?.session.ownerDeviceId ?? sessionOperations[0]?.deviceId ?? null, lastAttemptAt: sessionOperations.reduce<number | null>((latest, operation) => operation.lastAttemptAt && (!latest || operation.lastAttemptAt > latest) ? operation.lastAttemptAt : latest, null), lastSyncedAt: cache?.lastSyncedAt ?? null });
      }
      const recoveries = await listRecoveryBundles(userId).catch(() => []);
      const rawRecoveries = await listRecoveryRawRecords(userId).catch(() => []);
      const pendingCount = sessions.reduce((total, session) => total + session.pendingCount, 0);
      const conflictCount = sessions.filter((session) => session.conflict).length;
      overviewRef.current = { status: conflictCount > 0 ? "conflict" : pendingCount > 0 ? coordinator.getSnapshot().status === "offline" ? "offline" : "pending" : "synced", pendingCount, conflictCount, lastSyncedAt: sessions.reduce<number | null>((latest, session) => session.lastSyncedAt && (!latest || session.lastSyncedAt > latest) ? session.lastSyncedAt : latest, null), sessions, recoveryCount: recoveries.length + rawRecoveries.length };
    } catch (error) {
      if (error instanceof WorkoutQueueError && error.code === "recovery-required") {
        await archiveCorruptRecords(userId, error.rawRecords ?? []).catch(() => undefined);
        const rawRecoveries = await listRecoveryRawRecords(userId).catch(() => []);
        overviewRef.current = { ...overviewRef.current, status: "recovery-required", recoveryCount: rawRecoveries.length };
      } else if (error instanceof WorkoutCacheError) {
        const sessionId = error.rawRecord && typeof error.rawRecord === "object" ? (error.rawRecord as { sessionId?: unknown }).sessionId : null;
        if (typeof sessionId === "string") await archiveCorruptCacheRecord(userId, sessionId, error.rawRecord).catch(() => undefined);
        else await archiveCorruptRecords(userId, [error.rawRecord], "corrupt-cache").catch(() => undefined);
        const rawRecoveries = await listRecoveryRawRecords(userId).catch(() => []);
        overviewRef.current = { ...overviewRef.current, status: "recovery-required", recoveryCount: rawRecoveries.length };
      }
    } finally {
      const overview = overviewRef.current;
      const telemetryState = `${overview.status}:${overview.pendingCount}:${overview.conflictCount}:${overview.recoveryCount}`;
      if (userId && telemetryState !== lastTelemetryState.current) {
        lastTelemetryState.current = telemetryState;
        telemetry.captureEvent("workout_sync_state_changed", {
          status: overview.status,
          pendingCount: overview.pendingCount,
          conflictCount: overview.conflictCount,
          recoveryCount: overview.recoveryCount,
        });
      }
      overviewListeners.current.forEach((listener) => listener());
    }
  }, [coordinator, userId]);

  useEffect(() => {
    if (!userId) return () => coordinator.stop();
    void refreshOverview();
    const unsubscribeStore = subscribeSyncChanges(() => { void refreshOverview(); });
    const unsubscribeCoordinator = coordinator.subscribe(() => { void refreshOverview(); });
    return () => { unsubscribeStore(); unsubscribeCoordinator(); coordinator.stop(); };
  }, [coordinator, refreshOverview, userId]);

  const loadConflictDetail = useCallback(async (sessionId: string): Promise<WorkoutConflictDetail> => {
    const cache = await loadSessionCache(sessionId, userId);
    if (!cache) throw new WorkoutRepositoryError("not-found", "ไม่พบข้อมูล local ของ Session นี้");
    const operations = await listSyncOperations(userId, sessionId);
    const conflict = operations.find((operation) => operation.status === "CONFLICT");
    const serverSession = await repository.getSession(sessionId, "");
    const devices = await repository.listDevices();
    return { sessionId, reason: conflict?.lastErrorCode ?? "conflict", localSession: cache.session, acknowledgedSession: cache.acknowledgedSession ?? cache.session, serverSession, ownerDevice: devices.find((device) => device.id === (serverSession?.ownerDeviceId ?? cache.session.ownerDeviceId)) ?? null, operations };
  }, [repository, userId]);

  const syncAll = useCallback(async () => {
    if (!userId) return;
    const operations = await listSyncOperations(userId).catch(() => []);
    const sessionIds = [...new Set(operations.map((operation) => operation.sessionId))];
    for (const sessionId of sessionIds) {
      const sessionCoordinator = new WorkoutSyncCoordinator(repository, userId);
      sessionCoordinator.start(sessionId, false);
      try {
        // Process a Session in order, but stop after the first retryable failure
        // so a manual Sync never turns bounded backoff into a request storm.
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const remaining = await listSyncOperations(userId, sessionId).catch(() => []);
          if (remaining.length === 0 || remaining.some((operation) => operation.status === "CONFLICT")) break;
          await sessionCoordinator.syncNow(true);
          const status = sessionCoordinator.getSnapshot().status;
          if (status === "offline" || status === "authorization" || status === "conflict") break;
        }
      } finally {
        sessionCoordinator.stop();
      }
    }
    await refreshOverview();
  }, [refreshOverview, repository, userId]);

  useEffect(() => {
    if (!userId) return;
    const handleOnline = () => { void syncAll(); };
    window.addEventListener("online", handleOnline);
    void syncAll();
    return () => window.removeEventListener("online", handleOnline);
  }, [syncAll, userId]);

  const value = useMemo<WorkoutSyncController>(() => ({
    start: (sessionId) => coordinator.start(sessionId),
    trackSession: (sessionId) => coordinator.start(sessionId),
    subscribe: (listener) => {
      overviewListeners.current.add(listener);
      const unsubscribeCoordinator = coordinator.subscribe(listener);
      return () => { overviewListeners.current.delete(listener); unsubscribeCoordinator(); };
    },
    getSnapshot: () => coordinator.getSnapshot(),
    getSessionSnapshot: (sessionId) => overviewRef.current.sessions.find((session) => session.sessionId === sessionId) ?? null,
    getOverviewSnapshot: () => overviewRef.current,
    syncNow: syncAll,
    retry: (operationId) => coordinator.retry(operationId),
    loadConflictDetail,
    archiveAndUseServer: ({ sessionId, serverSession, ownerDevice, reason }) => archiveAndUseServer({ userId, sessionId, serverSession, ownerDevice: ownerDevice ?? null, reason }),
    archiveAfterRemoteAbandon: ({ sessionId, serverSession, ownerDevice, reason }) => archiveAfterRemoteAbandon({ userId, sessionId, serverSession, ownerDevice: ownerDevice ?? null, reason }),
  }), [coordinator, loadConflictDetail, syncAll, userId]);

  return <WorkoutSyncContext.Provider value={value}>{children}</WorkoutSyncContext.Provider>;
}
