import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PageFrame } from "../components/layout/PageFrame";
import { Button } from "../components/ui/Button";
import { Divider } from "../components/ui/Divider";
import { Input } from "../components/ui/Input";
import { SectionHeader } from "../components/ui/SectionHeader";
import { useAuth } from "../features/auth/AuthContext";
import { useWorkoutSync } from "../features/workout/WorkoutSyncContext";
import { useWorkoutRepository } from "../features/workout/WorkoutRepositoryContext";
import { listRecoveryBundles, listRecoveryRawRecords } from "../features/workout/data/workoutSyncStore";
import { getDeviceId } from "../features/workout/data/deviceIdentity";
import type { RecoveryBundle, RecoveryRawBundle } from "../features/workout/data/activeSessionCache";
import type { WorkoutConflictDetail } from "../features/workout/domain/workout";

function formatDate(value: number | string | null | undefined) {
  if (!value) return "ยังไม่มีข้อมูล";
  return new Date(value).toLocaleString("th-TH");
}

function statusLabel(status: string) {
  return ({ synced: "Synced", pending: "Pending", syncing: "Syncing", offline: "Offline", conflict: "Conflict", authorization: "ต้องเข้าสู่ระบบ", "recovery-required": "ต้องกู้คืนข้อมูล" } as Record<string, string>)[status] ?? status;
}

function sessionName(detail: WorkoutConflictDetail | null) {
  return detail?.localSession.templateNameSnapshot ?? detail?.localSession.dayLabelSnapshot ?? "Workout Session";
}

function isRetryable(code: string | null) {
  return code === "offline" || code === "server" || code === "authorization";
}

function sessionMetrics(session: WorkoutConflictDetail["localSession"]) {
  const sets = session.exercises.flatMap((exercise) => exercise.sets);
  return {
    completed: sets.filter((set) => set.status === "COMPLETED").length,
    volumeKg: sets.reduce((total, set) => total + (set.status === "COMPLETED" ? (set.actualWeight?.kg ?? 0) * (set.actualReps ?? 0) : 0), 0),
    editedAt: session.editedAt ?? session.completedAt ?? session.startedAt,
  };
}

const FOCUSABLE_SELECTOR = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function SettingsPage() {
  const { session, signOut } = useAuth();
  const sync = useWorkoutSync();
  const repository = useWorkoutRepository();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deviceId = useMemo(() => getDeviceId(), []);
  const dialogRef = useRef<HTMLDivElement>(null);
  const userId = session?.user.id ?? "";
  const [overview, setOverview] = useState(sync.getOverviewSnapshot());
  const [detail, setDetail] = useState<WorkoutConflictDetail | null>(null);
  const [archives, setArchives] = useState<RecoveryBundle[]>([]);
  const [rawArchives, setRawArchives] = useState<RecoveryRawBundle[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [abandonText, setAbandonText] = useState("");
  const [abandonOperationId, setAbandonOperationId] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [syncingBeforeLogout, setSyncingBeforeLogout] = useState(false);

  useEffect(() => {
    if (!abandonOpen && !logoutOpen) return undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFirst = () => dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    const focusTimer = window.setTimeout(focusFirst, 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (abandonOpen && !busy) { setAbandonOpen(false); setAbandonText(""); setAbandonOperationId(null); }
        if (logoutOpen && !signingOut) setLogoutOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [abandonOpen, busy, logoutOpen, signingOut]);

  const reload = useCallback(async () => {
    setOverview({ ...sync.getOverviewSnapshot() });
    const [sessionArchives, corruptArchives] = await Promise.all([
      listRecoveryBundles(userId).catch(() => []),
      listRecoveryRawRecords(userId).catch(() => []),
    ]);
    setArchives(sessionArchives);
    setRawArchives(corruptArchives);
  }, [sync, userId]);

  useEffect(() => {
    void sync.syncNow().catch(() => undefined);
    void reload();
    const unsubscribe = sync.subscribe(() => {
      setOverview({ ...sync.getOverviewSnapshot() });
      void listRecoveryBundles(userId).then(setArchives).catch(() => undefined);
      void listRecoveryRawRecords(userId).then(setRawArchives).catch(() => undefined);
    });
    return unsubscribe;
  }, [reload, sync, userId]);

  useEffect(() => {
    const requestedSession = searchParams.get("session");
    if (!requestedSession) return;
    void sync.loadConflictDetail(requestedSession).then(setDetail).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "โหลด Conflict ไม่สำเร็จ"));
  }, [searchParams, sync]);

  async function openConflict(sessionId: string) {
    setError("");
    try { setDetail(await sync.loadConflictDetail(sessionId)); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "โหลด Conflict ไม่สำเร็จ"); }
  }

  async function handleUseServerVersion() {
    if (!detail) return;
    setBusy(true); setError("");
    try {
      if (detail.serverSession) {
        await sync.archiveAndUseServer({ sessionId: detail.sessionId, serverSession: detail.serverSession, ownerDevice: detail.ownerDevice, reason: "use-server-version" });
      } else {
        // A deleted/terminal server session has nothing to adopt. Preserve the
        // local copy before releasing its queue and let Today resolve afresh.
        await sync.archiveAfterRemoteAbandon({ sessionId: detail.sessionId, serverSession: null, ownerDevice: detail.ownerDevice, reason: "server-session-missing" });
      }
      setDetail(null); navigate("/today"); await reload();
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "เก็บข้อมูล local ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function remoteAbandon() {
    if (!detail?.serverSession || abandonText.trim() !== sessionName(detail)) return;
    setBusy(true); setError("");
    try {
      const operationId = abandonOperationId ?? crypto.randomUUID();
      setAbandonOperationId(operationId);
      const abandoned = await repository.remoteAbandonSession({ operationId, sessionId: detail.sessionId, expectedVersion: detail.serverSession.version });
      await sync.archiveAfterRemoteAbandon({ sessionId: detail.sessionId, serverSession: abandoned, ownerDevice: detail.ownerDevice, reason: "remote-abandon" });
      setAbandonOpen(false); setAbandonText(""); setAbandonOperationId(null); setDetail(null); navigate("/today"); await reload();
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Abandon ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function handleSignOut(force = false) {
    if (!force && (overview.pendingCount > 0 || overview.recoveryCount > 0 || overview.status === "recovery-required")) { setLogoutOpen(true); return; }
    setSigningOut(true);
    try { await signOut(); } finally { navigate("/login", { replace: true }); }
  }

  async function syncBeforeSignOut() {
    setSyncingBeforeLogout(true);
    setError("");
    try {
      await sync.syncNow();
      const nextOverview = sync.getOverviewSnapshot();
      setOverview({ ...nextOverview });
      if (nextOverview.pendingCount === 0 && nextOverview.conflictCount === 0 && nextOverview.status !== "recovery-required") {
        setLogoutOpen(false);
        await handleSignOut(true);
      } else {
        setError(nextOverview.conflictCount > 0 ? "ยังมี Conflict ที่ต้องตรวจสอบก่อนออกจากระบบ" : "ยังซิงก์ไม่สำเร็จ ข้อมูลยังถูกเก็บไว้ในเครื่อง");
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "ซิงก์ก่อนออกจากระบบไม่สำเร็จ");
    } finally {
      setSyncingBeforeLogout(false);
    }
  }

  function exportArchive(bundle: RecoveryBundle) {
    const payload = JSON.stringify({ id: bundle.id, sessionId: bundle.sessionId, reason: bundle.reason, archivedAt: bundle.archivedAt, localSession: bundle.localSession, acknowledgedSession: bundle.acknowledgedSession, operations: bundle.operations, serverSession: bundle.serverSession, ownerDevice: bundle.ownerDevice }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `workout-recovery-${bundle.sessionId}.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  function exportRawArchive(bundle: RecoveryRawBundle) {
    const payload = JSON.stringify(bundle, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `workout-recovery-raw-${bundle.id}.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <PageFrame pageId="P-13" eyebrow="P-13 · SETTINGS & SYNC" title="ตั้งค่าและการซิงก์" description="ตรวจสอบสถานะการบันทึกและกู้คืนข้อมูลที่ยังซิงก์ไม่สำเร็จ">
      <div className="page-grid">
        <section className="col-span-4 min-w-0 space-y-8 tablet:col-span-8 desktop:col-span-8">
          <SectionHeader eyebrow="SYNC STATUS" title="สถานะการซิงก์" description={`${statusLabel(overview.status)} · ${overview.pendingCount} รายการค้าง · ${overview.conflictCount} Conflict`} />
          <div className="grid gap-4 border-y border-line py-5 tablet:grid-cols-3">
            <div><p className="text-xs text-ink-muted">สถานะ</p><p className="mt-1 font-semibold text-ink">{statusLabel(overview.status)}</p></div>
            <div><p className="text-xs text-ink-muted">รายการค้าง</p><p className="mt-1 font-semibold text-ink">{overview.pendingCount}</p></div>
            <div><p className="text-xs text-ink-muted">ซิงก์ล่าสุด</p><p className="mt-1 font-semibold text-ink">{formatDate(overview.lastSyncedAt)}</p></div>
          </div>
          <SectionHeader eyebrow="QUEUE" title="รายการที่รอซิงก์" action={<Button variant="secondary" disabled={overview.status === "recovery-required"} onClick={() => void sync.syncNow()}>ซิงก์อีกครั้ง</Button>} />
          {overview.sessions.length === 0 ? <p className="border-b border-line py-5 text-sm text-ink-muted">ไม่มีรายการค้างอยู่</p> : <div className="divide-y divide-line border-b border-line">{overview.sessions.map((item) => <div key={item.sessionId} className="flex flex-wrap items-center justify-between gap-4 py-5"><div><p className="font-semibold text-ink">{item.localSession?.templateNameSnapshot ?? "Workout Session"}</p><p className="mt-1 text-sm text-ink-secondary">{item.pendingCount} รายการ · อุปกรณ์ {item.ownerDeviceId ?? "ไม่ทราบ"}</p><p className="mt-1 text-xs text-ink-muted">{item.lastAttemptAt ? `พยายามล่าสุด ${formatDate(item.lastAttemptAt)}` : item.lastErrorCode ?? "รอซิงก์"}</p></div><div className="flex items-center gap-2">{item.conflict ? <Button variant="secondary" onClick={() => void openConflict(item.sessionId)}>ตรวจสอบ Conflict</Button> : isRetryable(item.lastErrorCode) ? <Button variant="quiet" onClick={() => void sync.syncNow()}>Retry</Button> : <span className="text-sm text-ink-muted">ตรวจสอบที่ Recovery</span>}</div></div>)}</div>}
          {detail ? <section className="border-t border-line pt-6" aria-labelledby="conflict-title"><SectionHeader eyebrow="CONFLICT REVIEW" title={sessionName(detail)} description="ข้อมูล local และ server แยกจากกัน ไม่มีการรวมข้อมูลอัตโนมัติ" showTopRule={false} /><div className="mt-5 grid gap-4 tablet:grid-cols-2"><div className="border border-error p-4"><p className="text-xs text-accent">LOCAL COPY</p><p className="mt-2 text-sm text-ink">Status: {detail.localSession.status} · Version {detail.localSession.version}</p><p className="mt-1 text-sm text-ink-secondary">Completed sets: {sessionMetrics(detail.localSession).completed} · Volume: {sessionMetrics(detail.localSession).volumeKg.toFixed(1)} kg</p><p className="mt-1 text-xs text-ink-muted">แก้ไขล่าสุด: {formatDate(sessionMetrics(detail.localSession).editedAt)}</p></div><div className="border border-line p-4"><p className="text-xs text-ink-muted">SERVER COPY</p><p className="mt-2 text-sm text-ink">{detail.serverSession ? `Status: ${detail.serverSession.status} · Version ${detail.serverSession.version}` : "ไม่พบข้อมูลบน server"}</p>{detail.serverSession ? <><p className="mt-1 text-sm text-ink-secondary">Completed sets: {sessionMetrics(detail.serverSession).completed} · Volume: {sessionMetrics(detail.serverSession).volumeKg.toFixed(1)} kg</p><p className="mt-1 text-xs text-ink-muted">แก้ไขล่าสุด: {formatDate(sessionMetrics(detail.serverSession).editedAt)}</p></> : null}<p className="mt-1 text-sm text-ink-secondary">Owner: {detail.ownerDevice?.label ?? detail.serverSession?.ownerDeviceId ?? "ไม่ทราบ"}</p></div></div>{detail.ownerDevice && detail.ownerDevice.id !== deviceId ? <p className="mt-4 border-l-2 border-accent pl-4 text-sm text-accent">Session นี้เป็นของอุปกรณ์ {detail.ownerDevice.label} แนะนำให้กลับไปแก้ไขจากอุปกรณ์เจ้าของ</p> : null}<div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => void handleUseServerVersion()} disabled={busy}>{detail.serverSession ? "ใช้ข้อมูลจาก Server" : "เก็บสำเนา Local และกลับ Today"}</Button><Button variant="destructive" onClick={() => setAbandonOpen(true)} disabled={busy || !detail.serverSession}>Abandon Server Session</Button></div></section> : null}
          <Divider />
          <SectionHeader eyebrow="PREFERENCES" title="หน่วยและตัวจับเวลา" description="การตั้งค่าเหล่านี้ยังเป็นค่าเริ่มต้นของ MVP" showTopRule={false} />
          <div className="grid gap-5 tablet:grid-cols-2"><Input label="หน่วยน้ำหนัก" value="Kilograms (kg)" readOnly helperText="รองรับ kg ใน MVP" /><Input label="เวลาพักเริ่มต้น" value="90" unit="SEC" readOnly /></div>
        </section>
        <aside className="col-span-4 mt-10 min-w-0 tablet:col-span-8 tablet:mt-0 desktop:col-span-4"><SectionHeader eyebrow="RECOVERY ARCHIVE" title="สำเนาที่เก็บไว้" description="ข้อมูล local ที่เคยมี conflict จะไม่ถูกลบทันที" showTopRule={false} />{archives.length === 0 && rawArchives.length === 0 ? <p className="border-b border-line py-5 text-sm text-ink-muted">ยังไม่มี Recovery Archive</p> : <>{archives.length > 0 ? <div className="divide-y divide-line border-b border-line">{archives.map((bundle) => <div key={bundle.id} className="py-4"><p className="font-semibold text-ink">{bundle.localSession.templateNameSnapshot ?? "Workout Session"}</p><p className="mt-1 text-sm text-ink-secondary">{formatDate(bundle.archivedAt)} · {bundle.reason}</p><Button className="mt-3" variant="quiet" size="compact" onClick={() => exportArchive(bundle)}>Export JSON</Button></div>)}</div> : null}{rawArchives.length > 0 ? <div className="mt-4 divide-y divide-line border-y border-line"><p className="px-1 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-accent">ข้อมูลคิวที่ต้องกู้คืน</p>{rawArchives.map((bundle) => <div key={bundle.id} className="py-4"><p className="font-semibold text-ink">ข้อมูลที่ตรวจสอบไม่ได้</p><p className="mt-1 text-sm text-ink-secondary">{formatDate(bundle.archivedAt)} · {bundle.reason}</p><Button className="mt-3" variant="quiet" size="compact" onClick={() => exportRawArchive(bundle)}>Export JSON</Button></div>)}</div> : null}</>}<div className="mt-10 border-t border-line pt-6"><SectionHeader eyebrow="OWNER ACCOUNT" title="บัญชีที่กำลังใช้งาน" showTopRule={false} /><p className="mt-4 break-all text-sm text-ink-secondary">{session?.user.email}</p><Button className="mt-4" variant="secondary" onClick={() => void handleSignOut()} disabled={signingOut}>{signingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</Button></div></aside>
      </div>
      {error ? <p role="alert" className="mt-6 border-l-2 border-error pl-4 text-sm text-error">{error}</p> : null}
      {abandonOpen && detail ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) { setAbandonOpen(false); setAbandonText(""); setAbandonOperationId(null); } }}><div ref={dialogRef} className="w-full max-w-lg border border-line bg-surface p-6" role="dialog" aria-modal="true" aria-labelledby="abandon-title"><h2 id="abandon-title" className="text-h2 text-ink">Abandon Server Session?</h2><p className="mt-3 text-sm text-ink-secondary">การกระทำนี้จะปิด Session บน server และไม่เลื่อน Routine ข้อมูล local จะถูกเก็บไว้ใน Recovery Archive</p><Input className="mt-5" label={`พิมพ์ “${sessionName(detail)}” เพื่อยืนยัน`} value={abandonText} onChange={(event) => setAbandonText(event.target.value)} /><div className="mt-5 flex justify-end gap-3"><Button variant="quiet" onClick={() => { setAbandonOpen(false); setAbandonText(""); setAbandonOperationId(null); }}>ยกเลิก</Button><Button variant="destructive" disabled={busy || abandonText.trim() !== sessionName(detail)} onClick={() => void remoteAbandon()}>ยืนยัน Abandon</Button></div></div></div> : null}
      {logoutOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !signingOut && !syncingBeforeLogout) setLogoutOpen(false); }}><div ref={dialogRef} className="w-full max-w-lg border border-line bg-surface p-6" role="dialog" aria-modal="true" aria-labelledby="logout-title"><h2 id="logout-title" className="text-h2 text-ink">มีข้อมูลรอซิงก์</h2><p className="mt-3 text-sm text-ink-secondary">ออกจากระบบได้ แต่ข้อมูลจะยังคงอยู่ในเครื่องและจะไม่ถูกส่งจนกว่าจะเข้าสู่ระบบบัญชีเดิม</p><div className="mt-5 flex flex-wrap justify-end gap-3"><Button variant="quiet" disabled={syncingBeforeLogout} onClick={() => setLogoutOpen(false)}>ยกเลิก</Button><Button variant="secondary" disabled={syncingBeforeLogout} onClick={() => void syncBeforeSignOut()}>{syncingBeforeLogout ? "กำลังซิงก์…" : "ซิงก์ก่อนออก"}</Button><Button variant="destructive" disabled={syncingBeforeLogout} onClick={() => { setLogoutOpen(false); void handleSignOut(true); }}>ออกจากระบบโดยเก็บข้อมูลไว้</Button></div></div></div> : null}
    </PageFrame>
  );
}
