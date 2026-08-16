import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { PageFrame } from "../components/layout/PageFrame";
import { SectionHeader } from "../components/ui/SectionHeader";
import { StatBlock } from "../components/ui/StatBlock";
import { ModalDialog } from "../components/ui/ModalDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { buttonStyles } from "../components/ui/buttonStyles";
import { useHistoryRepository } from "../features/history/HistoryRepositoryContext";
import { formatHistoryDuration, formatHistoryVolume, historyDraftEquals, historyDraftFromSession, historySummaryFromSession, resequenceExercises, resequenceSets, validateHistoryDraft, type HistoryCursor, type HistorySessionDraft } from "../features/history/domain/history";
import { HistoryRepositoryError } from "../features/history/domain/history";
import { useExerciseRepository } from "../features/exercises/ExerciseRepositoryContext";
import { defaultExerciseQuery, type Exercise } from "../features/exercises/domain/exercise";
import { kgFromWeight, type SessionExercise, type SessionSet, type WeightUnit, type WorkoutSession } from "../features/workout/domain/workout";
import { useAuth } from "../features/auth/AuthContext";
import { useProgressRepository } from "../features/progress/ProgressRepositoryContext";
import { SessionRecordList } from "../features/progress/components/SessionRecordList";
import type { ProgressRecord } from "../features/progress/domain/progress";
import { useProgressDisplayUnit } from "../features/progress/useProgressDisplayUnit";
import { readNumberInput } from "../lib/numberInput";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function dateRange(range: string, customFrom = "", customTo = ""): { from: string | null; to: string | null } {
  if (range === "all") return { from: null, to: null };
  if (range === "custom") {
    const to = customTo ? new Date(`${customTo}T00:00:00`) : null;
    if (to) to.setDate(to.getDate() + 1);
    return { from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : null, to: to?.toISOString() ?? null };
  }
  const days = Number(range);
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

function ErrorMessage({ error }: { error: unknown }) {
  return <p role="alert" className="border-l-2 border-error bg-surface px-4 py-3 text-sm text-error">{error instanceof HistoryRepositoryError ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่"}</p>;
}

interface ConfirmationRequest {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

function ConfirmationDialog({ request, onCancel }: { request: ConfirmationRequest | null; onCancel: () => void }) {
  return <ModalDialog open={Boolean(request)} onClose={onCancel} title={request?.title ?? "ยืนยันการทำรายการ"} description={request?.description} role="alertdialog" closeOnBackdrop={false}>
    {request ? <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" className={buttonStyles({ variant: "secondary" })} onClick={onCancel}>ยกเลิก</button><button type="button" className={buttonStyles({ variant: request.destructive ? "destructive" : "primary" })} onClick={request.onConfirm}>{request.confirmLabel}</button></div> : null}
  </ModalDialog>;
}

export function HistoryPage() {
  const repository = useHistoryRepository();
  const [range, setRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [items, setItems] = useState<Awaited<ReturnType<typeof repository.listSessions>>["items"]>([]);
  const [cursor, setCursor] = useState<HistoryCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fromCache, setFromCache] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const hasLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const initialLoad = !hasLoaded.current;
    setLoading(initialLoad);
    setUpdating(!initialLoad);
    setError(null);
    setCursor(null);
    const dates = dateRange(range, customFrom, customTo);
    repository.listSessions({ ...dates, cursor: null, limit: 20 }).then((page) => {
      if (cancelled) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setFromCache(Boolean(page.fromCache));
      hasLoaded.current = true;
    }).catch((reason) => { if (!cancelled) setError(reason); }).finally(() => { if (!cancelled) { setLoading(false); setUpdating(false); } });
    return () => { cancelled = true; };
  }, [range, customFrom, customTo, repository, reloadToken]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await repository.listSessions({ ...dateRange(range, customFrom, customTo), cursor, limit: 20 });
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch (reason) {
      setError(reason);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <PageFrame pageId="P-09" eyebrow="P-09 · HISTORY" title="ประวัติการฝึก" description="ดูผลการฝึกที่บันทึกเสร็จแล้ว เรียงจากใหม่ไปเก่า">
      <SectionHeader eyebrow="P-09 · HISTORY" title="รายการ Sessions" description="เปิด Session เพื่อดู snapshot หรือแก้ไขย้อนหลัง" showTopRule={false} />
      <section className="mt-6">
        <div className="flex flex-col gap-4 tablet:flex-row tablet:items-end tablet:justify-between">
          <label className="grid gap-2 text-sm text-ink-secondary" htmlFor="history-range">
            ช่วงเวลา
            <select id="history-range" value={range} onChange={(event) => setRange(event.target.value)} className="min-h-11 border border-line bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
              <option value="all">ทั้งหมด</option><option value="30">30 วันที่ผ่านมา</option><option value="90">90 วันที่ผ่านมา</option><option value="custom">กำหนดช่วงเอง</option>
            </select>
          </label>
          {range === "custom" ? <div className="flex flex-wrap gap-3"><label className="grid gap-2 text-sm text-ink-secondary">ตั้งแต่<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="min-h-11 border border-line bg-surface px-3 text-ink" /></label><label className="grid gap-2 text-sm text-ink-secondary">ถึง<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="min-h-11 border border-line bg-surface px-3 text-ink" /></label></div> : null}
          <p aria-live="polite" className="text-sm text-ink-muted">{loading ? "กำลังโหลด…" : updating ? "กำลังอัปเดต…" : `${items.length} Sessions`}</p>
        </div>
        {fromCache ? <p className="mt-4 border-l-2 border-warning bg-surface px-4 py-3 text-sm text-warning">กำลังแสดงข้อมูลที่เก็บไว้ในเครื่อง · กลับมา online เพื่อโหลดล่าสุด</p> : null}
        {error && !items.length && !loading ? <div className="mt-6 grid gap-4"><ErrorMessage error={error} /><button type="button" className={buttonStyles({ variant: "secondary", className: "w-fit" })} onClick={() => setReloadToken((value) => value + 1)}>ลองใหม่</button></div> : null}
        {loading ? <div className="mt-6 grid gap-4" aria-label="กำลังโหลดประวัติ"><div className="h-20 animate-pulse border-b border-line-subtle bg-surface" /><div className="h-20 animate-pulse border-b border-line-subtle bg-surface" /></div> : null}
        {!loading && !error && !items.length ? <div className="mt-6"><EmptyState title="ยังไม่มีประวัติการฝึก" description="เมื่อ Finish Workout แล้ว Session จะปรากฏที่นี่" showTopRule={false} /></div> : null}
        {items.length ? <div className="mt-6 border-t border-line" role="list">
          {items.map((item) => <Link role="listitem" key={item.sessionId} to={`/history/${item.sessionId}`} className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line-subtle py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink tablet:grid-cols-[12rem_minmax(0,1fr)_8rem_9rem_8rem] tablet:items-center">
            <p className="text-xs font-semibold tabular-nums text-ink-muted">{formatDate(item.completedAt)}</p>
            <div className="min-w-0"><p className="font-semibold">{item.label}</p><p className="mt-1 text-sm text-ink-muted">{item.exerciseCount} ท่า · {item.completedWorkingSetCount} working sets</p></div>
            <p className="hidden text-right text-sm text-ink-secondary tablet:block">{formatHistoryDuration(item.durationSeconds)}</p>
            <p className="hidden text-right text-sm text-ink-secondary tablet:block">{formatHistoryVolume(item.volumeKg)}</p>
            <p className="text-right text-xs text-ink-muted">เปิด <span aria-hidden="true">→</span></p>
          </Link>)}
        </div> : null}
        {error && items.length ? <div className="mt-4"><ErrorMessage error={error} /></div> : null}
        {cursor ? <button type="button" className={buttonStyles({ variant: "secondary", className: "mt-6 w-full tablet:w-auto" })} onClick={loadMore} disabled={loadingMore}>{loadingMore ? "กำลังโหลด…" : "โหลดเพิ่ม"}</button> : null}
      </section>
    </PageFrame>
  );
}

const setStatusLabels: Record<SessionSet["status"], string> = {
  COMPLETED: "Completed",
  PENDING: "Pending",
  SKIPPED: "Skipped",
};

const setKindLabels: Record<SessionSet["kind"], string> = {
  WORKING: "Working",
  WARM_UP: "Warm-up",
  DROP: "Drop",
};

function ReadOnlySet({ set }: { set: SessionSet }) {
  const weight = set.actualWeight ? `${set.actualWeight.value} ${set.actualWeight.unit}` : "—";
  const reps = set.actualReps ?? "—";
  const effort = set.actualEffort ? `${set.actualEffort.metric} ${set.actualEffort.value}` : "—";
  const rest = set.actualRestSeconds === null ? "—" : `${set.actualRestSeconds} วิ`;
  const kind = `${setKindLabels[set.kind]}${set.isToFailure ? " · Failure" : ""}`;

  return <article className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-line-subtle py-4 tablet:grid-cols-[8rem_repeat(4,minmax(0,1fr))] tablet:items-center">
    <div className="col-span-2 flex items-center justify-between tablet:col-span-1 tablet:block">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Set {String(set.sequence).padStart(2, "0")}</p>
      <p className="text-xs text-ink-secondary tablet:mt-1">{setStatusLabels[set.status]} · {kind}</p>
    </div>
    <dl className="contents">
      <div><dt className="text-xs text-ink-muted">น้ำหนัก</dt><dd className="mt-1 font-semibold tabular-nums text-ink">{weight}</dd></div>
      <div><dt className="text-xs text-ink-muted">Reps</dt><dd className="mt-1 font-semibold tabular-nums text-ink">{reps}</dd></div>
      <div><dt className="text-xs text-ink-muted">Effort</dt><dd className="mt-1 font-semibold tabular-nums text-ink">{effort}</dd></div>
      <div><dt className="text-xs text-ink-muted">พัก</dt><dd className="mt-1 font-semibold tabular-nums text-ink">{rest}</dd></div>
    </dl>
    {set.notes.trim() ? <p className="col-span-2 text-sm leading-6 text-ink-secondary tablet:col-span-5 tablet:pl-32"><span className="text-xs text-ink-muted">หมายเหตุ · </span>{set.notes}</p> : null}
  </article>;
}

function EditableSet({ set, validationPrefix, validationKey, onChange, onDelete, onMove, canDelete, editing, error, requestConfirmation }: { set: SessionSet; validationPrefix: string; validationKey?: string; onChange: (next: SessionSet) => void; onDelete: () => void; onMove: (direction: -1 | 1) => void; canDelete: boolean; editing: boolean; error?: string; requestConfirmation: (request: ConfirmationRequest) => void }) {
  const actualWeight = set.actualWeight?.value ?? "";
  const actualReps = set.actualReps ?? "";
  const unit = set.actualWeight?.unit ?? "KG";
  const weightInvalid = validationKey === `${validationPrefix}-weight`;
  const repsInvalid = validationKey === `${validationPrefix}-reps`;
  const effortInvalid = validationKey === `${validationPrefix}-effort`;
  const statusInvalid = validationKey === validationPrefix || validationKey === `${validationPrefix}-completedAt`;
  function changeStatus(status: SessionSet["status"]) {
    const apply = () => onChange(status === "COMPLETED" ? { ...set, status, completedAt: set.completedAt ?? new Date().toISOString() } : { ...set, status, actualWeight: null, actualReps: null, actualEffort: null, actualRestSeconds: null, completedAt: null });
    if (status !== "COMPLETED" && set.status === "COMPLETED") requestConfirmation({ title: "ล้างค่าการเล่นจริงของ Set นี้หรือไม่?", description: "การเปลี่ยนเป็น Pending หรือ Skipped จะล้างน้ำหนัก, reps, effort, เวลาพัก และเวลาที่บันทึกไว้", confirmLabel: "เปลี่ยนสถานะ", destructive: true, onConfirm: apply });
    else apply();
  }
  if (!editing) return <ReadOnlySet set={set} />;

  return <article className="border-b border-line-subtle py-5">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Set {String(set.sequence).padStart(2, "0")}</p><p className="mt-1 text-sm text-ink-secondary">{setKindLabels[set.kind]}{set.isToFailure ? " · Failure" : ""}</p></div>
      <div className="flex gap-1"><button type="button" aria-label={`เลื่อน Set ${set.sequence} ขึ้น`} className={buttonStyles({ variant: "quiet", className: "h-11 w-11 p-0" })} onClick={() => onMove(-1)} disabled={set.sequence === 1}><ArrowUp size={16} /></button><button type="button" aria-label={`เลื่อน Set ${set.sequence} ลง`} className={buttonStyles({ variant: "quiet", className: "h-11 w-11 p-0" })} onClick={() => onMove(1)}><ArrowDown size={16} /></button><button type="button" aria-label={`ลบ Set ${set.sequence}`} className={buttonStyles({ variant: "quiet", className: "h-11 w-11 p-0 text-error" })} onClick={onDelete} disabled={!canDelete}><Trash2 size={16} /></button></div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 tablet:grid-cols-4">
      <div className="grid gap-1 text-xs text-ink-muted"><label htmlFor={`weight-${set.id}`}>น้ำหนัก</label><div className="flex"><input id={`weight-${set.id}`} data-history-validation={weightInvalid ? validationKey : undefined} aria-invalid={weightInvalid || undefined} aria-label={`Set ${set.sequence} weight`} type="number" step="0.1" min="0" value={actualWeight} onChange={(event) => { const value = readNumberInput(event.currentTarget); onChange({ ...set, actualWeight: value === "" ? null : { value: Number(value), unit, kg: kgFromWeight(Number(value), unit) } }); }} className="min-h-11 min-w-0 flex-1 border border-line bg-surface px-3 text-ink" /><select aria-label={`Set ${set.sequence} weight unit`} value={unit} onChange={(event) => { const nextUnit = event.target.value as WeightUnit; onChange({ ...set, actualWeight: set.actualWeight ? { ...set.actualWeight, unit: nextUnit, kg: kgFromWeight(set.actualWeight.value, nextUnit) } : null }); }} className="min-h-11 w-[4.5rem] shrink-0 border-y border-r border-line bg-surface px-2 text-ink"><option value="KG">KG</option><option value="LB">LB</option></select></div></div>
      <label className="grid gap-1 text-xs text-ink-muted">Reps<input data-history-validation={repsInvalid ? validationKey : undefined} aria-invalid={repsInvalid || undefined} aria-label={`Set ${set.sequence} reps`} type="number" min="1" step="1" value={actualReps} onChange={(event) => { const value = readNumberInput(event.currentTarget); onChange({ ...set, actualReps: value === "" ? null : Number(value) }); }} className="min-h-11 border border-line bg-surface px-3 text-ink" /></label>
      <label className="grid gap-1 text-xs text-ink-muted">Effort<select data-history-validation={effortInvalid ? validationKey : undefined} aria-invalid={effortInvalid || undefined} aria-label={`Set ${set.sequence} effort metric`} value={set.actualEffort?.metric ?? ""} onChange={(event) => onChange({ ...set, actualEffort: event.target.value ? { metric: event.target.value as "RPE" | "RIR", value: set.actualEffort?.value ?? (event.target.value === "RPE" ? 8 : 2) } : null })} className="min-h-11 border border-line bg-surface px-3 text-ink"><option value="">—</option><option value="RPE">RPE</option><option value="RIR">RIR</option></select></label>
      <label className="grid gap-1 text-xs text-ink-muted">ค่า Effort<input aria-label={`Set ${set.sequence} effort value`} type="number" min="0" max="10" step={set.actualEffort?.metric === "RIR" ? "1" : "0.5"} value={set.actualEffort?.value ?? ""} onChange={(event) => { const value = readNumberInput(event.currentTarget); onChange({ ...set, actualEffort: set.actualEffort ? { ...set.actualEffort, value: value === "" ? 0 : Number(value) } : null }); }} className="min-h-11 border border-line bg-surface px-3 text-ink" /></label>
      <label className="grid gap-1 text-xs text-ink-muted">สถานะ<select data-history-validation={statusInvalid ? validationKey : undefined} aria-invalid={statusInvalid || undefined} aria-label={`Set ${set.sequence} status`} value={set.status} onChange={(event) => changeStatus(event.target.value as SessionSet["status"])} className="min-h-11 border border-line bg-surface px-3 text-ink"><option value="PENDING">Pending</option><option value="COMPLETED">Completed</option><option value="SKIPPED">Skipped</option></select></label>
      <label className="grid gap-1 text-xs text-ink-muted">ประเภท<select disabled={set.kind === "DROP" || set.isToFailure} aria-label={`Set ${set.sequence} kind`} value={set.kind} onChange={(event) => onChange({ ...set, kind: event.target.value as SessionSet["kind"] })} className="min-h-11 border border-line bg-surface px-3 text-ink disabled:opacity-70"><option value="WORKING">Working</option><option value="WARM_UP">Warm-up</option>{set.kind === "DROP" ? <option value="DROP">Drop</option> : null}</select></label>
      <label className="grid gap-1 text-xs text-ink-muted">พัก (วินาที)<input aria-label={`Set ${set.sequence} rest seconds`} type="number" min="0" step="1" value={set.actualRestSeconds ?? ""} onChange={(event) => { const value = readNumberInput(event.currentTarget); onChange({ ...set, actualRestSeconds: value === "" ? null : Number(value) }); }} className="min-h-11 border border-line bg-surface px-3 text-ink" /></label>
      <label className="col-span-2 grid gap-1 text-xs text-ink-muted tablet:col-span-4">หมายเหตุ Set<textarea aria-label={`Set ${set.sequence} notes`} value={set.notes} onChange={(event) => onChange({ ...set, notes: event.target.value })} className="min-h-16 border border-line bg-surface p-3 text-ink" /></label>
    </div>
    {set.isToFailure ? <p className="mt-3 text-xs text-warning">Failure set · แก้ไขได้เฉพาะค่าการเล่นจริง</p> : null}
    {error ? <p className="mt-3 text-sm text-error" role="alert">{error}</p> : null}
  </article>;
}

function ExerciseEditor({ exercise, exerciseIndex, exerciseOptions, validationKey, onChange, onDelete, onMove, canDelete, editing, error, requestConfirmation }: { exercise: SessionExercise; exerciseIndex: number; exerciseOptions: Exercise[]; validationKey?: string; onChange: (next: SessionExercise) => void; onDelete: () => void; onMove: (direction: -1 | 1) => void; canDelete: boolean; editing: boolean; error?: string; requestConfirmation: (request: ConfirmationRequest) => void }) {
  const [expanded, setExpanded] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const validationPrefix = `exercise-${exerciseIndex}`;
  useEffect(() => {
    if (!validationKey?.startsWith(validationPrefix)) return;
    setExpanded(true);
  }, [validationKey, validationPrefix]);
  useEffect(() => {
    if (!expanded || !validationKey?.startsWith(validationPrefix)) return;
    const timeout = window.setTimeout(() => {
      sectionRef.current?.querySelector<HTMLElement>(`[data-history-validation="${validationKey}"]`)?.focus();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [expanded, validationKey, validationPrefix]);
  function changeSet(setId: string, next: SessionSet) { onChange({ ...exercise, sets: exercise.sets.map((set) => set.id === setId ? next : set) }); }
  function deleteSet(setId: string) { onChange({ ...exercise, sets: resequenceSets(exercise.sets.filter((set) => set.id !== setId)) }); }
  function moveSet(setId: string, direction: -1 | 1) { const index = exercise.sets.findIndex((set) => set.id === setId); const target = index + direction; if (target < 0 || target >= exercise.sets.length) return; const next = [...exercise.sets]; [next[index], next[target]] = [next[target], next[index]]; onChange({ ...exercise, sets: resequenceSets(next) }); }
  function addSet() { const last = exercise.sets.at(-1); const added: SessionSet = { id: crypto.randomUUID(), sourceTemplateSetId: null, sequence: exercise.sets.length + 1, kind: "WORKING", isToFailure: false, targetRepsMin: null, targetRepsMax: null, targetWeight: null, targetEffort: null, targetRestSeconds: 0, actualWeight: last?.actualWeight ?? null, actualReps: last?.actualReps ?? null, actualEffort: last?.actualEffort ?? null, actualRestSeconds: null, status: "COMPLETED", completedAt: new Date().toISOString(), notes: "" }; onChange({ ...exercise, sets: [...exercise.sets, added] }); }
  return <section ref={sectionRef} className="border-b border-line" aria-labelledby={`exercise-${exercise.id}`}>
    <div className="py-5">
      <div className="flex items-start gap-2">
        <button type="button" aria-label={exercise.name} data-history-validation={validationKey === validationPrefix ? validationKey : undefined} aria-invalid={validationKey === validationPrefix || undefined} className="flex min-h-11 min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink" onClick={() => setExpanded((value) => !value)}>
          <span className="mt-0.5 shrink-0" aria-hidden="true">{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
          <span className="min-w-0"><span id={`exercise-${exercise.id}`} className="block break-words font-semibold text-ink">{exercise.name}</span><span className="mt-1 block text-xs font-normal text-ink-muted">{exercise.sets.length} sets · {exercise.equipmentCode || "ไม่ระบุอุปกรณ์"}</span></span>
        </button>
        {editing ? <div className="flex shrink-0 gap-1"><button type="button" aria-label={`เลื่อน ${exercise.name} ขึ้น`} className={buttonStyles({ variant: "quiet", className: "h-11 w-11 p-0" })} onClick={() => onMove(-1)} disabled={exercise.sequence === 1}><ArrowUp size={16} /></button><button type="button" aria-label={`เลื่อน ${exercise.name} ลง`} className={buttonStyles({ variant: "quiet", className: "h-11 w-11 p-0" })} onClick={() => onMove(1)}><ArrowDown size={16} /></button><button type="button" aria-label={`ลบ ${exercise.name}`} className={buttonStyles({ variant: "quiet", className: "h-11 w-11 p-0 text-error" })} onClick={onDelete} disabled={!canDelete}><Trash2 size={16} /></button></div> : null}
      </div>
      {editing ? <label className="mt-3 grid gap-2 text-xs text-ink-muted">Exercise<select aria-label={`เปลี่ยนท่า ${exercise.name}`} value={exercise.sourceExerciseId ?? ""} onChange={(event) => { const selected = exerciseOptions.find((item) => item.id === event.target.value); if (selected) onChange({ ...exercise, sourceExerciseId: selected.id, name: selected.name, equipmentCode: selected.equipmentCode }); }} className="min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink"><option value="">เลือกท่า</option>{exerciseOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label> : null}
    </div>
    {expanded ? <div className="pb-5">
      {editing ? <label className="grid gap-2 text-sm text-ink-secondary">หมายเหตุท่า<textarea value={exercise.notes} onChange={(event) => onChange({ ...exercise, notes: event.target.value })} className="min-h-20 border border-line bg-surface p-3 text-ink" /></label> : exercise.notes.trim() ? <div className="mb-2 border-l-2 border-line px-4 py-2"><p className="text-xs text-ink-muted">หมายเหตุท่า</p><p className="mt-1 text-sm leading-6 text-ink-secondary">{exercise.notes}</p></div> : null}
      <div className={editing ? "mt-3 border-t border-line-subtle" : "border-t border-line-subtle"}>{exercise.sets.map((set, setIndex) => { const setPrefix = `${validationPrefix}-set-${setIndex}`; return <EditableSet key={set.id} set={set} validationPrefix={setPrefix} validationKey={validationKey?.startsWith(setPrefix) ? validationKey : undefined} editing={editing} onChange={(next) => changeSet(set.id, next)} onDelete={() => deleteSet(set.id)} onMove={(direction) => moveSet(set.id, direction)} canDelete={exercise.sets.length > 1} error={validationKey?.startsWith(setPrefix) ? error : undefined} requestConfirmation={requestConfirmation} />; })}</div>
      {error && validationKey === validationPrefix ? <p className="mt-3 text-sm text-error" role="alert">{error}</p> : null}
      {editing ? <button type="button" className={buttonStyles({ variant: "quiet", className: "mt-3" })} onClick={addSet}><Plus size={16} /> เพิ่ม Set</button> : null}
    </div> : null}
  </section>;
}

export function HistoryDetailPage() {
  const repository = useHistoryRepository();
  const progressRepository = useProgressRepository();
  const auth = useAuth();
  const [progressUnit] = useProgressDisplayUnit(auth.session?.user.id ?? "");
  const exerciseRepository = useExerciseRepository();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sessionSource, setSessionSource] = useState<"server" | "cache">("server");
  const [draft, setDraft] = useState<HistorySessionDraft | null>(null);
  const [baseline, setBaseline] = useState<HistorySessionDraft | null>(null);
  const [exerciseOptions, setExerciseOptions] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState("");
  const [sessionRecords, setSessionRecords] = useState<ProgressRecord[]>([]);
  const [recordsError, setRecordsError] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const updateAttempt = useRef<{ operationId: string; fingerprint: string } | null>(null);
  const deleteAttempt = useRef<{ operationId: string; fingerprint: string } | null>(null);
  const canonicalRequestId = useRef(0);
  const sessionNotesRef = useRef<HTMLTextAreaElement>(null);
  const blockerDismissed = useRef(false);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [validationTarget, setValidationTarget] = useState<string | null>(null);
  const dirty = Boolean(draft && baseline && !historyDraftEquals(draft, baseline));
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search || currentLocation.hash !== nextLocation.hash));

  const applySessionResult = useCallback((result: Awaited<ReturnType<typeof repository.getSession>>) => {
    const value = result?.session ?? null;
    setSessionSource(result?.source ?? "server");
    setSession(value);
    if (value) {
      const next = historyDraftFromSession(value);
      setDraft(next);
      setBaseline(next);
      updateAttempt.current = null;
      deleteAttempt.current = null;
      setValidationTarget(null);
    }
    return value;
  }, [repository]);

  const loadCanonicalSession = useCallback(async (options: { requireServer?: boolean; showLoading?: boolean } = {}) => {
    if (!sessionId) return null;
    const requestId = ++canonicalRequestId.current;
    if (options.showLoading !== false) setLoading(true);
    setError(null);
    try {
      const result = await repository.getSession(sessionId);
      if (requestId !== canonicalRequestId.current) return null;
      if (options.requireServer && result?.source !== "server") {
        throw new HistoryRepositoryError("offline", "ยังโหลดข้อมูลล่าสุดจาก Server ไม่ได้");
      }
      return applySessionResult(result);
    } catch (reason) {
      if (requestId === canonicalRequestId.current) setError(reason);
      return null;
    } finally {
      if (requestId === canonicalRequestId.current && options.showLoading !== false) setLoading(false);
    }
  }, [applySessionResult, repository, sessionId]);

  const requestConfirmation = useCallback((request: ConfirmationRequest) => setConfirmation({ ...request, onConfirm: () => { setConfirmation(null); request.onConfirm(); } }), []);

  useEffect(() => { const onlineChange = () => setOnline(navigator.onLine); window.addEventListener("online", onlineChange); window.addEventListener("offline", onlineChange); return () => { window.removeEventListener("online", onlineChange); window.removeEventListener("offline", onlineChange); }; }, []);
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void loadCanonicalSession();
    exerciseRepository.list({ ...defaultExerciseQuery, status: "active" }).then((items) => { if (!cancelled) setExerciseOptions(items); }).catch(() => undefined);
    return () => { cancelled = true; canonicalRequestId.current += 1; };
  }, [exerciseRepository, loadCanonicalSession, sessionId]);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", beforeUnload); return () => window.removeEventListener("beforeunload", beforeUnload); }, [dirty]);
  useEffect(() => {
    if (!online || sessionSource !== "cache" || dirty || !sessionId) return;
    void loadCanonicalSession({ requireServer: true, showLoading: false });
  }, [online, sessionSource, dirty, sessionId, loadCanonicalSession]);

  useEffect(() => {
    if (validationTarget !== "notes") return;
    sessionNotesRef.current?.focus();
  }, [validationTarget]);

  useEffect(() => {
    if (blocker.state === "unblocked") blockerDismissed.current = false;
    if (blocker.state === "blocked" && !confirmation && !blockerDismissed.current) {
      setConfirmation({ title: "ทิ้งการแก้ไขหรือไม่?", description: "มีข้อมูลที่ยังไม่ได้บันทึก การออกจากหน้านี้จะทิ้งการแก้ไขปัจจุบัน", confirmLabel: "ออกจากหน้า", destructive: true, onConfirm: () => {
        const target = blocker.location;
        setBaseline(draft ?? baseline);
        window.setTimeout(() => {
          if (window.location.pathname !== target.pathname || window.location.search !== target.search || window.location.hash !== target.hash) {
            blocker.reset();
            navigate(`${target.pathname}${target.search}${target.hash}`);
          }
        }, 50);
        if (blocker.state === "blocked") blocker.proceed();
        setConfirmation(null);
      } });
    }
  }, [baseline, blocker, confirmation, draft, navigate]);

  function leave() { navigate("/history"); }
  function changeExercise(id: string, next: SessionExercise) { setDraft((value) => value ? { ...value, exercises: value.exercises.map((exercise) => exercise.id === id ? next : exercise) } : value); }
  function moveExercise(id: string, direction: -1 | 1) { setDraft((value) => { if (!value) return value; const index = value.exercises.findIndex((exercise) => exercise.id === id); const target = index + direction; if (target < 0 || target >= value.exercises.length) return value; const exercises = [...value.exercises]; [exercises[index], exercises[target]] = [exercises[target], exercises[index]]; return { ...value, exercises: resequenceExercises(exercises) }; }); }
  function addExercise() { const selected = exerciseOptions[0]; if (!selected) return; const set: SessionSet = { id: crypto.randomUUID(), sourceTemplateSetId: null, sequence: 1, kind: "WORKING", isToFailure: false, targetRepsMin: null, targetRepsMax: null, targetWeight: null, targetEffort: null, targetRestSeconds: 0, actualWeight: null, actualReps: null, actualEffort: null, actualRestSeconds: null, status: "COMPLETED", completedAt: new Date().toISOString(), notes: "" }; const exercise: SessionExercise = { id: crypto.randomUUID(), sourceTemplateExerciseId: null, sourceExerciseId: selected.id, sequence: (draft?.exercises.length ?? 0) + 1, name: selected.name, equipmentCode: selected.equipmentCode, muscles: [], notes: "", sets: [set] }; setDraft((value) => value ? { ...value, exercises: [...value.exercises, exercise] } : value); }
  const canMutate = online && sessionSource === "server";
  useEffect(() => {
    if (!session || sessionSource !== "server" || editing) return;
    let active = true;
    setRecordsError(false);
    void progressRepository.listSessionRecords(session.id).then((records) => { if (active) setSessionRecords(records); }).catch(() => { if (active) { setSessionRecords([]); setRecordsError(true); } });
    return () => { active = false; };
  }, [editing, progressRepository, session, sessionSource]);
  async function save() {
    if (!session || !draft || saving || !canMutate) return;
    const validation = validateHistoryDraft(draft);
    const firstValidation = Object.entries(validation)[0];
    if (firstValidation) {
      setValidationTarget(null);
      window.setTimeout(() => setValidationTarget(firstValidation[0]), 0);
      setError(new HistoryRepositoryError("validation", firstValidation[1]));
      return;
    }
    setValidationTarget(null);
    const fingerprint = JSON.stringify({ sessionId: session.id, version: session.version, draft });
    if (!updateAttempt.current || updateAttempt.current.fingerprint !== fingerprint) updateAttempt.current = { operationId: crypto.randomUUID(), fingerprint };
    setSaving(true); setError(null); setSuccess("");
    try { const updated = await repository.updateSession({ operationId: updateAttempt.current.operationId, sessionId: session.id, expectedVersion: session.version, draft }); setSession(updated); const next = historyDraftFromSession(updated); setDraft(next); setBaseline(next); setEditing(false); updateAttempt.current = null; setSuccess("บันทึกการแก้ไขแล้ว"); }
    catch (reason) { setError(reason); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!session || !canMutate || saving) return;
    requestConfirmation({ title: "ลบ Session นี้ออกจาก History หรือไม่?", description: "Session จะไม่ถูกแสดงใน History และจะไม่ถูกนำไปคำนวณ Progress การกระทำนี้ย้อนกลับไม่ได้", confirmLabel: "ลบ Session", destructive: true, onConfirm: () => { void performRemove(); } });
  }

  function reloadAfterConflict() {
    const reload = async () => {
      const loaded = await loadCanonicalSession({ requireServer: true, showLoading: false });
      if (loaded) {
        setEditing(false);
        setSuccess("โหลดข้อมูลล่าสุดจาก Server แล้ว");
      }
    };
    if (dirty) {
      requestConfirmation({ title: "โหลดข้อมูลล่าสุดจาก Server หรือไม่?", description: "Draft ที่ยังไม่ได้บันทึกจะถูกทิ้ง แล้วแทนด้วยข้อมูลล่าสุดจาก Server", confirmLabel: "โหลดจาก Server", destructive: true, onConfirm: () => { void reload(); } });
    } else {
      void reload();
    }
  }
  async function performRemove() {
    if (!session || !canMutate) return;
    const fingerprint = `${session.id}:${session.version}`;
    if (!deleteAttempt.current || deleteAttempt.current.fingerprint !== fingerprint) deleteAttempt.current = { operationId: crypto.randomUUID(), fingerprint };
    const attempt = deleteAttempt.current;
    if (!attempt) return;
    setSaving(true); setError(null);
    try { await repository.softDeleteSession({ operationId: attempt.operationId, sessionId: session.id, expectedVersion: session.version }); deleteAttempt.current = null; navigate("/history", { state: { deleted: true } }); }
    catch (reason) { setError(reason); }
    finally { setSaving(false); }
  }

  if (loading) return <PageFrame pageId="P-10" eyebrow="P-10 · HISTORY DETAIL" title="กำลังโหลด History…" description="กำลังอ่าน snapshot จาก server หรือ cache"><span /></PageFrame>;
  if (error && !session) return <PageFrame pageId="P-10" eyebrow="P-10 · HISTORY DETAIL" title="โหลด History ไม่สำเร็จ" description="ลองใหม่อีกครั้งเมื่อเชื่อมต่อได้"><ErrorMessage error={error} /><button type="button" className={buttonStyles({ variant: "secondary", className: "mt-6" })} onClick={() => void loadCanonicalSession()}>ลองใหม่</button></PageFrame>;
  if (!session || !draft) return <PageFrame pageId="P-10" eyebrow="P-10 · HISTORY DETAIL" title="ไม่พบ Session" description="Session อาจถูกลบหรือไม่มีสิทธิ์ดู"><span /></PageFrame>;
  const summary = historySummaryFromSession(session);
  const validation = validateHistoryDraft(draft);
  const conflict = error instanceof HistoryRepositoryError && error.code === "conflict";
  const cancelEditing = () => {
    const reset = () => { const next = historyDraftFromSession(session); setDraft(next); setBaseline(next); updateAttempt.current = null; setValidationTarget(null); setError(null); setEditing(false); };
    if (dirty) requestConfirmation({ title: "ทิ้งการแก้ไขหรือไม่?", description: "การแก้ไขที่ยังไม่ได้บันทึกจะถูกลบออกจากหน้าจอ", confirmLabel: "ทิ้งการแก้ไข", destructive: true, onConfirm: reset });
    else reset();
  };
  const cancelConfirmation = () => { if (blocker.state === "blocked") { blockerDismissed.current = true; blocker.reset(); } setConfirmation(null); };
  return <PageFrame pageId="P-10" eyebrow="P-10 · HISTORY DETAIL" title={summary.label} description={`${formatDate(session.completedAt ?? session.startedAt)} · ${session.editedAt ? "แก้ไขย้อนหลังแล้ว" : "snapshot จากการฝึกจริง"}`} action={<button type="button" className={buttonStyles({ variant: "quiet" })} onClick={leave}>กลับไป History</button>}>
    <ConfirmationDialog request={confirmation} onCancel={cancelConfirmation} />
    {!canMutate ? <p className="mb-6 border-l-2 border-warning bg-surface px-4 py-3 text-sm text-warning">{sessionSource === "cache" ? "กำลังดูข้อมูลจาก cache แบบอ่านอย่างเดียว กด Retry server เมื่อเชื่อมต่อได้" : "Offline: ดูรายละเอียดได้ แต่การแก้ไขและลบต้องกลับมา online"}</p> : null}
    {success ? <p role="status" className="mb-6 border-l-2 border-success bg-surface px-4 py-3 text-sm text-success">{success}</p> : null}
    {error ? <div className="mb-6 grid gap-3"><ErrorMessage error={error} />{conflict ? <button type="button" className={buttonStyles({ variant: "secondary", className: "w-fit" })} onClick={reloadAfterConflict}>โหลดข้อมูลจาก Server</button> : null}</div> : null}
    <div className="page-grid">
      <div className="col-span-4 grid grid-cols-2 gap-x-4 gap-y-6 tablet:col-span-8 tablet:grid-cols-4 desktop:col-span-12"><StatBlock label="Duration" value={formatHistoryDuration(summary.durationSeconds)} accent showTopRule={false} /><StatBlock label="Exercises" value={String(summary.exerciseCount)} showTopRule={false} /><StatBlock label="Working sets" value={String(summary.completedWorkingSetCount)} showTopRule={false} /><StatBlock label="Volume" value={formatHistoryVolume(summary.volumeKg)} showTopRule={false} /></div>
      <section aria-label="จัดการ Session" className="col-span-4 mt-7 border-y border-line py-4 tablet:col-span-8 desktop:col-span-12">
        <div className="flex flex-col gap-4 tablet:flex-row tablet:items-center tablet:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{editing ? "EDITING HISTORY" : "COMPLETED SESSION"}</p><p className="mt-1 text-sm text-ink-secondary">{editing ? "ตรวจสอบค่าแล้วบันทึกเมื่อพร้อม" : "ข้อมูลนี้เป็น snapshot จากวันที่ฝึก"}</p></div>
          {!editing ? <div className="flex flex-col gap-2 min-[420px]:flex-row"><button type="button" className={buttonStyles({ variant: "primary" })} onClick={() => { setError(null); setValidationTarget(null); setEditing(true); }} disabled={!canMutate}>แก้ไข History</button><button type="button" className={buttonStyles({ variant: "quiet", className: "text-error" })} onClick={remove} disabled={!canMutate || saving}>ลบ Session</button>{sessionSource === "cache" ? <button type="button" className={buttonStyles({ variant: "secondary" })} onClick={() => void loadCanonicalSession()}>Retry server</button> : null}</div> : <div className="flex flex-col gap-2 min-[420px]:flex-row"><button type="button" className={buttonStyles({ variant: "primary" })} onClick={save} disabled={!canMutate || saving}>{saving ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button><button type="button" className={buttonStyles({ variant: "quiet" })} onClick={cancelEditing}>ยกเลิก</button></div>}
        </div>
      </section>
      <section className={`col-span-4 mt-8 tablet:col-span-8 ${editing || sessionSource !== "server" ? "desktop:col-span-12" : "desktop:col-span-8"}`}><SectionHeader eyebrow="SESSION SNAPSHOT" title={editing ? "แก้ไขข้อมูลย้อนหลัง" : "รายละเอียด Session"} description="ค่าที่แสดงมาจาก snapshot ของวันที่ฝึก และไม่เปลี่ยนตาม Template ปัจจุบัน" showTopRule={false} />
        {editing ? <label className="mt-6 grid gap-2 text-sm text-ink-secondary">หมายเหตุ Session<textarea ref={sessionNotesRef} data-history-validation={validationTarget === "notes" ? "notes" : undefined} aria-invalid={validationTarget === "notes" || undefined} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="min-h-24 border border-line bg-surface p-3 text-ink" /></label> : draft.notes.trim() ? <div className="mt-6 border-l-2 border-line px-4 py-2"><p className="text-xs text-ink-muted">หมายเหตุ Session</p><p className="mt-1 text-sm leading-6 text-ink-secondary">{draft.notes}</p></div> : null}
        <div className="mt-6 border-t border-line">{draft.exercises.map((exercise, exerciseIndex) => { const issue = Object.entries(validation).find(([key]) => key.startsWith(`exercise-${exerciseIndex}`)); return <ExerciseEditor key={exercise.id} exercise={exercise} exerciseIndex={exerciseIndex} validationKey={validationTarget?.startsWith(`exercise-${exerciseIndex}`) ? validationTarget : undefined} editing={editing} exerciseOptions={exerciseOptions} onChange={(next) => changeExercise(exercise.id, next)} onDelete={() => setDraft({ ...draft, exercises: resequenceExercises(draft.exercises.filter((item) => item.id !== exercise.id)) })} onMove={(direction) => moveExercise(exercise.id, direction)} canDelete={true} error={issue?.[0] === validationTarget ? issue[1] : undefined} requestConfirmation={requestConfirmation} />; })}</div>
        {editing ? <button type="button" className={buttonStyles({ variant: "secondary", className: "mt-5" })} onClick={addExercise} disabled={!exerciseOptions.length}><Plus size={16} /> เพิ่มท่า</button> : null}
      </section>
      {!editing && sessionSource === "server" ? <aside className="col-span-4 mt-8 tablet:col-span-8 desktop:col-span-4"><SectionHeader eyebrow="PERSONAL RECORDS" title="PR จาก Session นี้" description="คำนวณใหม่ทุกครั้งหลังแก้ไข History" showTopRule={false} />{recordsError ? <p className="mt-4 text-sm text-error">โหลด PR ไม่สำเร็จ จึงไม่แสดงค่าก่อนหน้าแทนข้อมูลปัจจุบัน</p> : <div className="mt-4"><SessionRecordList records={sessionRecords} unit={progressUnit} /></div>}</aside> : null}
    </div>
  </PageFrame>;
}
