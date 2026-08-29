import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageFrame } from "../components/layout/PageFrame";
import { buttonStyles } from "../components/ui/buttonStyles";
import { EmptyState } from "../components/ui/EmptyState";
import { useAuth } from "../features/auth/AuthContext";
import { RoutineTrackingRepositoryError } from "../features/routine-tracking/data/RoutineTrackingRepository";
import type { RoutineWeekSummary, WeeklyRoutineNotification } from "../features/routine-tracking/domain/routineTracking";
import { useRoutineTrackingRepository } from "../features/routine-tracking/RoutineTrackingRepositoryContext";

function dateRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" });
  return `${formatter.format(new Date(`${start}T00:00:00`))} – ${formatter.format(new Date(`${end}T00:00:00`))}`;
}

function cacheKey(userId: string, kind: string) { return `form:routine-tracking:${userId}:${kind}`; }
function readCache<T>(userId: string, kind: string): T | null {
  try { const raw = localStorage.getItem(cacheKey(userId, kind)); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
function writeCache(userId: string, kind: string, value: unknown) {
  try { localStorage.setItem(cacheKey(userId, kind), JSON.stringify(value)); } catch { /* Read-only fallback is optional when storage is unavailable. */ }
}

function WeekMetrics({ week }: { week: RoutineWeekSummary }) {
  return <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
    <div><dt className="text-ink-muted">Frequency</dt><dd className="mt-1 text-h3 tabular-nums">{week.frequencyActual}/{week.frequencyTarget}</dd></div>
    <div><dt className="text-ink-muted">Coverage</dt><dd className="mt-1 text-h3 tabular-nums">{week.coverageActual}/{week.coverageTarget}</dd></div>
  </dl>;
}

export function NotificationsPage() {
  const repository = useRoutineTrackingRepository();
  const auth = useAuth();
  const navigate = useNavigate();
  const userId = auth.session?.user.id ?? "";
  const [items, setItems] = useState<WeeklyRoutineNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const next = await repository.listNotifications();
      setItems(next); setOffline(false); writeCache(userId, "notifications", next);
    } catch (reason) {
      const cached = readCache<WeeklyRoutineNotification[]>(userId, "notifications");
      if (cached) { setItems(cached); setOffline(true); }
      else setError(reason instanceof Error ? reason.message : "โหลด Notification Center ไม่สำเร็จ");
    } finally { setLoading(false); }
  }, [repository, userId]);
  useEffect(() => { void load(); }, [load]);

  async function open(item: WeeklyRoutineNotification) {
    setError("");
    if (!offline && !item.readAt) {
      try {
        await repository.markNotificationRead(item.id);
        setItems((current) => current.map((entry) => entry.id === item.id
          ? { ...entry, readAt: new Date().toISOString() }
          : entry));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "อ่าน Notification ไม่สำเร็จ");
        return;
      }
    }
    navigate(`/routine-history/${item.weekPlanId}`);
  }
  async function dismiss(item: WeeklyRoutineNotification) {
    if (offline) return;
    try { await repository.dismissNotification(item.id); setItems((current) => current.filter((entry) => entry.id !== item.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "ปิด Notification ไม่สำเร็จ"); }
  }

  return <PageFrame pageId="P-14" eyebrow="P-14 · NOTIFICATIONS" title="Notification Center" description="คำเตือน Routine รายสัปดาห์จะอยู่ที่นี่จนกว่าคุณจะปิดทีละรายการ" action={<Link to="/routine-history" className={buttonStyles({ variant: "secondary" })}>ดูประวัติทั้งหมด</Link>}>
    {offline ? <p className="mb-5 border-l-2 border-warning pl-4 text-sm text-warning">กำลังแสดง cache แบบอ่านอย่างเดียว การอ่านและปิดรายการต้องรอ online</p> : null}
    {error ? <p role="alert" className="mb-5 text-sm text-error">{error}</p> : null}
    {loading ? <p role="status">กำลังโหลด Notification…</p> : items.length === 0 ? <EmptyState marker="00" title="ไม่มีคำเตือนค้างอยู่" description="สัปดาห์ที่ครบเป้าหมายจะไม่สร้าง Notification แต่ยังดูได้ใน Weekly Routine History" showTopRule={false} /> : <div className="divide-y divide-line border-y border-line">
      {items.map((item) => <article key={item.id} className={`grid gap-4 py-5 tablet:grid-cols-[1fr_auto] ${item.readAt ? "text-ink-secondary" : "text-ink"}`}>
        <button type="button" className="min-w-0 text-left" onClick={() => void open(item)}>
          <span className="text-xs font-semibold tracking-[0.08em] text-accent">{item.readAt ? "READ" : "NEW"} · {dateRange(item.weekStart, item.weekEnd)}</span>
          <h2 className="mt-2 text-h3">{item.title}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{item.content}</p>
          <p className="mt-3 text-sm tabular-nums">Frequency {item.frequencyActual}/{item.frequencyTarget} · Coverage {item.coverageActual}/{item.coverageTarget}</p>
        </button>
        <button type="button" className={buttonStyles({ variant: "quiet", className: "w-fit" })} disabled={offline} onClick={() => void dismiss(item)}>ปิดรายการ</button>
      </article>)}
    </div>}
  </PageFrame>;
}

export function RoutineHistoryPage() {
  const repository = useRoutineTrackingRepository();
  const auth = useAuth();
  const userId = auth.session?.user.id ?? "";
  const [weeks, setWeeks] = useState<RoutineWeekSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    repository.listHistory().then((next) => { if (active) { setWeeks(next); setOffline(false); writeCache(userId, "history", next); } }).catch((reason) => {
      if (!active) return;
      const cached = readCache<RoutineWeekSummary[]>(userId, "history");
      if (cached) { setWeeks(cached); setOffline(true); } else setError(reason instanceof Error ? reason.message : "โหลด Weekly Routine History ไม่สำเร็จ");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository, userId]);
  return <PageFrame pageId="P-15" eyebrow="P-15 · ROUTINE HISTORY" title="Weekly Routine History" description="Frequency และ Coverage ที่ระบบบันทึกจาก Routine Sessions เท่านั้น" action={<Link to="/notifications" className={buttonStyles({ variant: "secondary" })}>Notification Center</Link>}>
    {offline ? <p className="mb-5 border-l-2 border-warning pl-4 text-sm text-warning">กำลังดูประวัติจาก cache แบบอ่านอย่างเดียว</p> : null}
    {error ? <p role="alert" className="text-error">{error}</p> : null}
    {loading ? <p role="status">กำลังโหลดประวัติ…</p> : weeks.length === 0 ? <EmptyState marker="00" title="ยังไม่มี Weekly Routine History" description="ประวัติจะเริ่มเก็บจากการ Activate Routine หลังอัปเดตนี้ โดยไม่ backfill สัปดาห์เก่า" showTopRule={false} /> : <div className="grid gap-5 tablet:grid-cols-2 desktop:grid-cols-3">
      {weeks.map((week) => <Link key={week.id} to={`/routine-history/${week.id}`} className="border-t border-line py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <p className="text-xs font-semibold tracking-[0.08em] text-accent">{week.status} · {dateRange(week.weekStart, week.weekEnd)}</p><h2 className="mt-2 text-h3">{week.routineName}</h2><WeekMetrics week={week} />
      </Link>)}
    </div>}
  </PageFrame>;
}

export function RoutineWeekDetailPage() {
  const repository = useRoutineTrackingRepository();
  const auth = useAuth();
  const { weekPlanId } = useParams();
  const [week, setWeek] = useState<RoutineWeekSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!weekPlanId) return;
    let active = true;
    repository.getWeek(weekPlanId).then((value) => { if (active) setWeek(value); }).catch((reason) => {
      if (!active) return;
      const cached = readCache<RoutineWeekSummary[]>(auth.session?.user.id ?? "", "history")?.find((item) => item.id === weekPlanId);
      if (cached) setWeek(cached); else setError(reason instanceof RoutineTrackingRepositoryError ? reason.message : "โหลด Routine Week ไม่สำเร็จ");
    });
    return () => { active = false; };
  }, [auth.session?.user.id, repository, weekPlanId]);
  if (error) return <PageFrame pageId="P-16" eyebrow="P-16 · WEEK DETAIL" title="โหลด Routine Week ไม่สำเร็จ" description={error}><Link to="/routine-history" className={buttonStyles({ variant: "secondary" })}>กลับไปประวัติ</Link></PageFrame>;
  if (!week) return <PageFrame pageId="P-16" eyebrow="P-16 · WEEK DETAIL" title="กำลังโหลด Routine Week…" description="กำลังคำนวณ Frequency และ Coverage"><span /></PageFrame>;
  return <PageFrame pageId="P-16" eyebrow="P-16 · WEEK DETAIL" title={week.routineName} description={`${dateRange(week.weekStart, week.weekEnd)} · ${week.timezone}`} action={<Link to="/routine-history" className={buttonStyles({ variant: "quiet" })}>ประวัติทั้งหมด</Link>}>
    <WeekMetrics week={week} />
    <section className="mt-8 border-t border-line"><h2 className="py-4 text-h3">Routine Days</h2>{week.days.map((day) => {
      const state = day.completedCount > 0
        ? { label: `เล่น ${day.completedCount} ครั้ง`, className: "text-success" }
        : day.activeCount > 0
          ? { label: "กำลังดำเนินการ", className: "text-warning" }
          : { label: "ไม่ได้เล่น", className: "text-warning" };
      return <div key={day.id} className="grid grid-cols-[1fr_auto] gap-4 border-t border-line-subtle py-4"><div><p className="font-semibold">{day.dayLabel}</p><p className="mt-1 text-sm text-ink-muted">{day.templateName}</p></div><p className={`text-sm font-semibold ${state.className}`}>{state.label}</p></div>;
    })}</section>
    {week.status === "PROVISIONAL" ? <p className="mt-6 border-l-2 border-warning pl-4 text-sm text-warning">มี Active Session จากสัปดาห์นี้ค้างอยู่ ผลลัพธ์จึงยังเป็น Provisional</p> : null}
  </PageFrame>;
}
