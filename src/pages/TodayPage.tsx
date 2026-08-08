import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageFrame } from "../components/layout/PageFrame";
import { Divider } from "../components/ui/Divider";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { StatBlock } from "../components/ui/StatBlock";
import { buttonStyles } from "../components/ui/buttonStyles";
import { Button } from "../components/ui/Button";
import { usePlanningRepository } from "../features/planning/PlanningRepositoryContext";
import type { ActiveRoutinePreview } from "../features/planning/domain/planning";
import { PlanningRepositoryError } from "../features/planning/data/PlanningRepository";

export function TodayPage() {
  const repository = usePlanningRepository();
  const [preview, setPreview] = useState<ActiveRoutinePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setPreview(await repository.getActiveRoutinePreview()); }
    catch (loadError) { setError(loadError instanceof PlanningRepositoryError ? loadError.message : "โหลด Today's Workout ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <PageFrame pageId="P-02" title="การฝึกของวันนี้" description="ตรวจสอบลำดับถัดไปจาก Active Routine"><p className="border-t border-line pt-6 text-ink-muted">กำลังโหลด Today's Workout…</p></PageFrame>;
  if (error) return <PageFrame pageId="P-02" title="การฝึกของวันนี้" description="ตรวจสอบลำดับถัดไปจาก Active Routine"><div role="alert" className="border border-error/50 bg-surface p-5 text-error"><p>{error}</p><Button variant="secondary" className="mt-4" onClick={() => void load()}>ลองใหม่</Button></div></PageFrame>;
  if (!preview) return <PageFrame pageId="P-02" title="การฝึกของวันนี้" description="ยังไม่มี Routine ที่เปิดใช้งาน"><EmptyState marker="00" title="ยังไม่มี Active Routine" description="สร้าง Template และจัดเรียงเป็น Routine ก่อน แล้วเปิดใช้งานเพื่อให้หน้านี้แสดง Workout ถัดไป" action={<Link to="/plans" className={buttonStyles()}>ไปที่ Plans</Link>} /></PageFrame>;

  const setCount = preview.template.exercises.reduce((total, exercise) => total + exercise.prescriptions.length, 0);
  return <PageFrame pageId="P-02" title="การฝึกของวันนี้" description={`${preview.routineName} · ${preview.dayLabel} · ลำดับ ${preview.nextWorkoutIndex + 1} / ${preview.dayCount}`}>
    <section className="page-grid"><div className="col-span-4 grid grid-cols-2 gap-x-4 tablet:col-span-8 tablet:grid-cols-4 desktop:col-span-12"><StatBlock label="ท่าฝึก" value={String(preview.template.exercises.length).padStart(2, "0")} detail={preview.template.name} accent /><StatBlock label="เซ็ตทั้งหมด" value={String(setCount).padStart(2, "0")} detail="Working prescriptions" /><StatBlock label="ตำแหน่งใน Routine" value={`${preview.nextWorkoutIndex + 1}/${preview.dayCount}`} detail="Next template" /><StatBlock label="เป้าหมายต่อสัปดาห์" value={String(preview.weeklyFrequencyTarget).padStart(2, "0")} unit="ครั้ง" detail={preview.routineName} /></div></section>
    <div className="mt-10 page-grid"><section className="col-span-4 min-w-0 tablet:col-span-5 desktop:col-span-8"><SectionHeader eyebrow="NEXT TEMPLATE" title={preview.template.name} description="หน้านี้เป็น preview จากข้อมูลจริง ปุ่มเริ่ม Workout จะเปิดเมื่อ Active Session และ snapshot พร้อมใน milestone ถัดไป" /><div className="mt-4 border-t border-line">{preview.template.exercises.map((exercise, index) => { const first = exercise.prescriptions[0]; return <div key={exercise.id} className="grid min-h-16 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-subtle py-3"><span className="text-xs tabular-nums text-ink-muted">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0"><p className="truncate font-semibold">{exercise.exerciseName}</p><p className="mt-1 text-sm text-ink-muted">{exercise.prescriptions.length} sets · {first ? `${first.repsMin}–${first.repsMax} reps` : "ยังไม่มีเป้าหมาย"}</p></div><span className="text-sm font-semibold tabular-nums text-ink-secondary">{first?.targetWeightValue === null || first?.targetWeightValue === undefined ? "—" : `${first.targetWeightValue} ${first.targetWeightUnit}`}</span></div>; })}</div></section><aside className="col-span-4 mt-10 min-w-0 tablet:col-span-3 tablet:mt-0 desktop:col-span-4"><SectionHeader eyebrow="ROUTINE CONTEXT" title="ลำดับถัดไป" /><div className="mt-4 border border-line bg-surface p-4 tablet:p-5"><p className="text-sm text-ink-muted">{preview.routineName}</p><p className="mt-3 text-data tabular-nums">{String(preview.nextWorkoutIndex + 1).padStart(2, "0")} / {String(preview.dayCount).padStart(2, "0")}</p><Divider className="my-5" /><Link to="/plans" className={buttonStyles({ variant: "secondary", fullWidth: true })}>ดูและแก้ไข Plans</Link></div></aside></div>
  </PageFrame>;
}
