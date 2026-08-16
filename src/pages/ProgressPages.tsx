import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageFrame } from "../components/layout/PageFrame";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { SectionHeader } from "../components/ui/SectionHeader";
import { StatBlock } from "../components/ui/StatBlock";
import { TrendChart, type TrendChartPoint } from "../components/ui/TrendChart";
import { buttonStyles } from "../components/ui/buttonStyles";
import { useAuth } from "../features/auth/AuthContext";
import { useProgressRepository } from "../features/progress/ProgressRepositoryContext";
import {
  formatProgressVolume,
  formatProgressWeight,
  progressRangeStart,
  progressRecordLabel,
  type ExerciseProgressDetail,
  type ProgressDisplayUnit,
  type ProgressExerciseCursor,
  type ProgressExerciseSummary,
  type ProgressOverview,
  type ProgressRange,
} from "../features/progress/domain/progress";
import { useProgressDisplayUnit } from "../features/progress/useProgressDisplayUnit";
import { useWorkoutSync } from "../features/workout/WorkoutSyncContext";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function ErrorNotice({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <div className="border-l-2 border-error bg-surface px-4 py-4" role="alert"><p className="font-semibold text-error">โหลด Progress ไม่สำเร็จ</p><p className="mt-1 text-sm text-ink-secondary">{error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง"}</p><Button variant="secondary" className="mt-4" onClick={onRetry}>ลองใหม่</Button></div>;
}

function useSyncPending() {
  const sync = useWorkoutSync();
  const [pending, setPending] = useState(() => sync.getOverviewSnapshot().pendingCount);
  useEffect(() => sync.subscribe(() => setPending(sync.getOverviewSnapshot().pendingCount)), [sync]);
  return pending;
}

function UnitToggle({ unit, onChange }: { unit: ProgressDisplayUnit; onChange: (unit: ProgressDisplayUnit) => void }) {
  return <div className="inline-flex border border-line" role="group" aria-label="หน่วยแสดงผล Progress">{(["KG", "LB"] as const).map((value) => <button key={value} type="button" aria-pressed={unit === value} className={`min-h-11 min-w-14 px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${unit === value ? "bg-ink text-canvas" : "bg-surface text-ink-secondary"}`} onClick={() => onChange(value)}>{value}</button>)}</div>;
}

function overviewTrend(overview: ProgressOverview): TrendChartPoint[] {
  const records = new Set(overview.recentRecords.filter((record) => record.kind === "ESTIMATED_1RM").map((record) => record.sessionId));
  return (overview.featuredExercise?.trend ?? []).filter((point) => point.bestEstimated1RmKg !== null).map((point) => ({ sessionId: point.sessionId, completedAt: point.completedAt, value: point.bestEstimated1RmKg ?? 0, isRecord: records.has(point.sessionId) }));
}

export function ProgressPage() {
  const repository = useProgressRepository();
  const auth = useAuth();
  const pendingSync = useSyncPending();
  const [unit] = useProgressDisplayUnit(auth.session?.user.id ?? "");
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [exercises, setExercises] = useState<ProgressExerciseSummary[]>([]);
  const [cursor, setCursor] = useState<ProgressExerciseCursor | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250); return () => window.clearTimeout(timer); }, [search]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextOverview, page] = await Promise.all([repository.getOverview(), repository.listExercises({ search: debouncedSearch, cursor: null, limit: 20 })]);
      setOverview(nextOverview); setExercises(page.items); setCursor(page.nextCursor);
    } catch (reason) { setError(reason); }
    finally { setLoading(false); }
  }, [debouncedSearch, repository]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try { const page = await repository.listExercises({ search: debouncedSearch, cursor, limit: 20 }); setExercises((current) => [...current, ...page.items]); setCursor(page.nextCursor); }
    catch (reason) { setError(reason); }
    finally { setLoadingMore(false); }
  };

  if (loading && !overview) return <PageFrame pageId="P-11" eyebrow="P-11 · PROGRESS" title="ความก้าวหน้า" description="กำลังคำนวณจาก Completed Sessions"><div className="page-grid animate-pulse"><div className="col-span-4 h-32 border border-line bg-recessed tablet:col-span-8 desktop:col-span-12" /></div></PageFrame>;
  if (error && !overview) return <PageFrame pageId="P-11" eyebrow="P-11 · PROGRESS" title="ความก้าวหน้า" description="Progress ต้องเชื่อมต่ออินเทอร์เน็ต"><ErrorNotice error={error} onRetry={() => void load()} /></PageFrame>;
  if (!overview || overview.stats.trackedExerciseCount === 0) return <PageFrame pageId="P-11" eyebrow="P-11 · PROGRESS" title="ความก้าวหน้า" description="คำนวณจาก Completed Working Sets เท่านั้น"><EmptyState showTopRule={false} title="ยังไม่มีข้อมูลสำหรับ Progress" description="จบ Workout ที่มี Working Set อย่างน้อยหนึ่งครั้ง แล้วผลลัพธ์จะปรากฏที่นี่" action={<div className="flex flex-wrap gap-3"><Link className={buttonStyles()} to="/today">ไป Today</Link><Link className={buttonStyles({ variant: "secondary" })} to="/plans">จัดการ Plans</Link></div>} /></PageFrame>;

  const featuredPoints = overviewTrend(overview);
  return <PageFrame pageId="P-11" eyebrow="P-11 · PROGRESS" title="ความก้าวหน้า" description="แนวโน้มและสถิติจาก Completed Working Sets ที่ซิงก์แล้ว">
    {pendingSync > 0 ? <p className="mb-6 border-l-2 border-warning bg-surface px-4 py-3 text-sm text-warning">มี Workout {pendingSync} รายการรอซิงก์ ข้อมูลนี้จะรวมใน Progress หลัง server ยืนยัน</p> : null}
    {error ? <div className="mb-6"><ErrorNotice error={error} onRetry={() => void load()} /></div> : null}
    <div className="page-grid">
      <div className="col-span-4 grid grid-cols-2 gap-x-4 tablet:col-span-8 tablet:grid-cols-4 desktop:col-span-12">
        <StatBlock label="PR · 30 DAYS" value={String(overview.stats.recentPrCount)} unit="PR" accent showTopRule={false} />
        <StatBlock label="SESSIONS · 30 DAYS" value={String(overview.stats.recentSessionCount)} showTopRule={false} />
        <StatBlock label="VOLUME · 30 DAYS" value={formatProgressVolume(overview.stats.recentVolumeKg, unit)} showTopRule={false} />
        <StatBlock label="EXERCISES TRACKED" value={String(overview.stats.trackedExerciseCount)} showTopRule={false} />
      </div>
      {overview.featuredExercise ? <section className="col-span-4 mt-10 min-w-0 tablet:col-span-8 desktop:col-span-8"><SectionHeader eyebrow="FEATURED · LATEST TRAINED" title={overview.featuredExercise.exerciseName} description={`ฝึกล่าสุด ${formatDate(overview.featuredExercise.lastTrainedAt)}`} />
        <div className="mt-5">{featuredPoints.length ? <TrendChart title="ESTIMATED 1RM · 90 DAYS" description="แนวโน้ม e1RM ของท่าที่ฝึกล่าสุด จุดสีแดงคือ Session ที่สร้าง PR" points={featuredPoints} formatValue={(value) => formatProgressWeight(value, unit)} /> : <div className="border border-line p-6 text-sm text-ink-secondary">ท่านี้ยังไม่มี Set ที่คำนวณ e1RM ได้</div>}</div>
        <Link to={`/progress/${overview.featuredExercise.exerciseId}`} className={buttonStyles({ variant: "secondary", className: "mt-5" })}>ดูรายละเอียด Exercise</Link>
      </section> : null}
      <aside className="col-span-4 mt-10 tablet:col-span-8 desktop:col-span-4"><SectionHeader eyebrow="RECENT PERSONAL RECORDS" title="PR ล่าสุด" />
        <div className="mt-5 border-t border-line">{overview.recentRecords.length ? overview.recentRecords.map((record, index) => <Link key={`${record.kind}-${record.sessionId}-${record.setId}`} to={`/history/${record.sessionId}`} className="flex min-h-[76px] items-center gap-3 border-b border-line-subtle py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"><span className="text-xs tabular-nums text-accent">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0"><strong className="block truncate text-sm">{record.exerciseName}</strong><span className="mt-1 block text-sm text-ink-secondary">{progressRecordLabel(record, unit)}</span></span></Link>) : <p className="border-b border-line-subtle py-5 text-sm text-ink-secondary">ยังไม่มี PR ในรายการล่าสุด</p>}</div>
      </aside>
      <section className="col-span-4 mt-12 tablet:col-span-8 desktop:col-span-12"><SectionHeader eyebrow="EXERCISE PROGRESS" title="ทุกท่าที่ติดตาม" description="เรียงจากท่าที่ฝึกล่าสุด" />
        <div className="mt-5 max-w-xl"><Input label="ค้นหาท่า" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="เช่น Bench Press" onClear={search ? () => setSearch("") : undefined} /></div>
        <div className="mt-6 border-t border-line" aria-live="polite">{exercises.length ? exercises.map((exercise) => <Link key={exercise.exerciseId} to={`/progress/${exercise.exerciseId}`} className="grid min-h-[76px] gap-2 border-b border-line-subtle py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink tablet:grid-cols-[minmax(0,1fr)_auto_auto] tablet:items-center tablet:gap-6"><span><strong className="block truncate">{exercise.exerciseName}</strong><span className="mt-1 block text-sm text-ink-secondary">ล่าสุด {formatDate(exercise.lastTrainedAt)} · {exercise.sessionCount} Sessions</span></span><span className="text-sm tabular-nums text-ink-secondary">Best {formatProgressWeight(exercise.allTimeBestWeightKg, unit)}</span><span className="text-sm tabular-nums text-ink-secondary">Latest volume {formatProgressVolume(exercise.latestSessionVolumeKg, unit)}</span></Link>) : <p className="border-b border-line-subtle py-8 text-ink-secondary">ไม่พบท่าที่ตรงกับคำค้น</p>}</div>
        {cursor ? <Button variant="secondary" className="mt-6" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "กำลังโหลด…" : "โหลดเพิ่ม"}</Button> : null}
      </section>
    </div>
  </PageFrame>;
}

const ranges: { value: ProgressRange; label: string }[] = [{ value: "30D", label: "30 วัน" }, { value: "90D", label: "90 วัน" }, { value: "1Y", label: "1 ปี" }, { value: "ALL", label: "ทั้งหมด" }];

function recordSessions(detail: ExerciseProgressDetail, kind: string) {
  return new Set(detail.allTimeRecords.filter((record) => record.kind === kind).map((record) => record.sessionId));
}

export function ExerciseProgressPage() {
  const repository = useProgressRepository();
  const auth = useAuth();
  const { exerciseId = "" } = useParams();
  const [unit, setUnit] = useProgressDisplayUnit(auth.session?.user.id ?? "");
  const [range, setRange] = useState<ProgressRange>("90D");
  const [detail, setDetail] = useState<ExerciseProgressDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => { setLoading(true); setError(null); setDetail(null); try { setDetail(await repository.getExerciseDetail({ exerciseId, from: progressRangeStart(range), to: null, pointLimit: 250 })); } catch (reason) { setError(reason); } finally { setLoading(false); } }, [exerciseId, range, repository]);
  useEffect(() => { void load(); }, [load]);

  if (loading && !detail) return <PageFrame pageId="P-12" eyebrow="P-12 · EXERCISE PROGRESS" title="กำลังโหลด Progress…" description="คำนวณข้อมูลจาก Completed Sessions"><span /></PageFrame>;
  if (error && !detail) return <PageFrame pageId="P-12" eyebrow="P-12 · EXERCISE PROGRESS" title="โหลด Exercise Progress ไม่สำเร็จ" description="ข้อมูลนี้ต้องเชื่อมต่ออินเทอร์เน็ต" action={<Link to="/progress" className={buttonStyles({ variant: "quiet" })}>กลับ Progress</Link>}><ErrorNotice error={error} onRetry={() => void load()} /></PageFrame>;
  if (!detail) return <PageFrame pageId="P-12" eyebrow="P-12 · EXERCISE PROGRESS" title="ไม่พบข้อมูล Exercise" description="ท่านี้อาจยังไม่มี Completed Working Set" action={<Link to="/progress" className={buttonStyles({ variant: "quiet" })}>กลับ Progress</Link>}><EmptyState showTopRule={false} title="ยังไม่มีแนวโน้มให้แสดง" description="ทำ Working Set และ Finish Workout ก่อนเพื่อเริ่มติดตาม" /></PageFrame>;

  const e1rmRecords = recordSessions(detail, "ESTIMATED_1RM");
  const volumePoints = detail.trend.map((point) => ({ sessionId: point.sessionId, completedAt: point.completedAt, value: point.volumeKg }));
  const intensityPoints = detail.trend.filter((point) => detail.hasPositiveWeight ? point.bestEstimated1RmKg !== null : true).map((point) => ({ sessionId: point.sessionId, completedAt: point.completedAt, value: detail.hasPositiveWeight ? point.bestEstimated1RmKg ?? 0 : point.bestReps, isRecord: detail.hasPositiveWeight ? e1rmRecords.has(point.sessionId) : detail.allTimeRecords.some((record) => record.kind === "BEST_REPS_AT_WEIGHT" && record.sessionId === point.sessionId) }));
  const rangeLabel = ranges.find((item) => item.value === range)?.label ?? range;

  return <PageFrame pageId="P-12" eyebrow="P-12 · EXERCISE PROGRESS" title={detail.exerciseName} description={`แนวโน้ม ${rangeLabel} · Records คำนวณจากประวัติทั้งหมด`} action={<Link to="/progress" className={buttonStyles({ variant: "quiet" })}>กลับ Progress</Link>}>
    {error ? <div className="mb-6"><ErrorNotice error={error} onRetry={() => void load()} /></div> : null}
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5"><div className="flex flex-wrap gap-2" role="group" aria-label="ช่วงเวลา">{ranges.map((item) => <button key={item.value} type="button" aria-pressed={range === item.value} className={buttonStyles({ variant: range === item.value ? "primary" : "secondary" })} onClick={() => setRange(item.value)}>{item.label}</button>)}</div><UnitToggle unit={unit} onChange={setUnit} /></div>
    <div className="page-grid mt-8">
      <div className="col-span-4 grid grid-cols-2 gap-x-4 tablet:col-span-8 tablet:grid-cols-4 desktop:col-span-12"><StatBlock label="BEST WEIGHT" value={formatProgressWeight(detail.metrics.bestWeightKg, unit)} accent showTopRule={false} /><StatBlock label="HIGHEST REPS" value={String(detail.metrics.bestReps)} unit={`@ ${formatProgressWeight(detail.metrics.bestRepsWeightKg, unit)}`} showTopRule={false} /><StatBlock label="BEST e1RM" value={detail.metrics.bestEstimated1RmKg === null ? "—" : formatProgressWeight(detail.metrics.bestEstimated1RmKg, unit)} showTopRule={false} /><StatBlock label="TOTAL VOLUME" value={formatProgressVolume(detail.metrics.totalVolumeKg, unit)} showTopRule={false} /></div>
      {detail.trend.length ? <section className="col-span-4 mt-10 grid min-w-0 gap-6 tablet:col-span-8 desktop:col-span-8"><TrendChart title="VOLUME" description="ผลรวม added load × reps ของ Completed Working Sets ต่อ Session" points={volumePoints} formatValue={(value) => formatProgressVolume(value, unit)} /><TrendChart title={detail.hasPositiveWeight ? "ESTIMATED 1RM" : "REPS"} description={detail.hasPositiveWeight ? "e1RM สูงสุดต่อ Session จาก Set ที่มี 1–10 reps" : "ท่านี้ใช้ added weight 0 จึงแสดงจำนวน reps แทน e1RM; volume หมายถึง added load เท่านั้น"} points={intensityPoints} formatValue={(value) => detail.hasPositiveWeight ? formatProgressWeight(value, unit) : `${value} reps`} />{detail.truncated ? <p className="border-l-2 border-warning pl-4 text-sm text-warning">กราฟแสดง 250 Sessions ล่าสุด ลองเลือกช่วงเวลาสั้นลงเพื่ออ่านแนวโน้มชัดขึ้น</p> : null}</section> : <section className="col-span-4 mt-10 tablet:col-span-8 desktop:col-span-8"><EmptyState title="ไม่มี Working Set ในช่วงนี้" description="ลองเลือกช่วงเวลาที่ยาวขึ้น" /></section>}
      <aside className="col-span-4 mt-10 tablet:col-span-8 desktop:col-span-4"><SectionHeader eyebrow="ALL-TIME RECORDS" title="สถิติสูงสุด" />
        <div className="mt-5 border-t border-line">{detail.allTimeRecords.map((record) => <Link key={`${record.kind}-${record.sessionId}`} to={`/history/${record.sessionId}`} className="block min-h-[76px] border-b border-line-subtle py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"><strong className="block text-sm">{progressRecordLabel(record, unit)}</strong><span className="mt-1 block text-sm text-ink-secondary">{formatDate(record.achievedAt)} · ดู Session</span></Link>)}</div>
        <div className="mt-10"><SectionHeader eyebrow="BEST REPS BY WEIGHT" title="Reps แยกตามน้ำหนัก" /></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[18rem] text-left text-sm"><thead><tr className="border-b border-line"><th className="py-3">น้ำหนัก</th><th className="py-3">Reps</th><th className="py-3 text-right">ที่มา</th></tr></thead><tbody>{detail.repsAtWeight.map((record) => <tr key={`${record.weightKg}-${record.setId}`} className="border-b border-line-subtle"><td className="py-3 tabular-nums">{formatProgressWeight(record.weightKg, unit)}</td><td className="py-3 tabular-nums">{record.reps}</td><td className="py-3 text-right"><Link className="underline underline-offset-4" to={`/history/${record.sessionId}`}>History</Link></td></tr>)}</tbody></table></div>
      </aside>
    </div>
  </PageFrame>;
}
