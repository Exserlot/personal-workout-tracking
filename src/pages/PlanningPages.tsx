import { Link } from "react-router-dom";
import { PageFrame } from "../components/layout/PageFrame";
import { SectionHeader } from "../components/ui/SectionHeader";
import { StatBlock } from "../components/ui/StatBlock";
import { Input } from "../components/ui/Input";
import { buttonStyles } from "../components/ui/buttonStyles";

const routine = [
  ["01", "Push A", "5 exercises", "16 sets"],
  ["02", "Pull B", "6 exercises", "18 sets"],
  ["03", "Legs C", "5 exercises", "17 sets"],
];

export function PlansPage() {
  return (
    <PageFrame
      pageId="P-05"
      title="แผนและ Routine"
      description="Routine เป็นลำดับ ordered sequence; weekly frequency เป็นเป้าหมาย ไม่ใช่ calendar schedule"
      action={<Link to="/plans/templates/new" className={buttonStyles()}>สร้าง Template</Link>}
    >
      <div className="page-grid">
        <section className="col-span-4 min-w-0 tablet:col-span-8 desktop:col-span-8">
          <SectionHeader eyebrow="ACTIVE ROUTINE" title="Strength Foundation" description="ลำดับ A → B → C · เป้าหมาย 4 ครั้งต่อสัปดาห์" />
          <ol className="mt-5 border-t border-line">
            {routine.map(([index, name, exercises, sets], itemIndex) => (
              <li key={name} className="grid min-h-20 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-subtle py-3">
                <span className={itemIndex === 0 ? "text-accent" : "text-ink-muted"}>{index}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="mt-1 text-sm text-ink-muted">{exercises} · {sets}</p>
                </div>
                <Link to="/plans/templates/push-a" className="flex min-h-11 items-center px-3 text-sm font-semibold text-ink-secondary hover:text-ink">
                  เปิด
                </Link>
              </li>
            ))}
          </ol>
        </section>
        <aside className="col-span-4 mt-10 tablet:col-span-8 desktop:col-span-4 desktop:mt-0">
          <SectionHeader eyebrow="ROUTINE STATUS" title="ภาพรวม" />
          <div className="mt-4 grid grid-cols-2 gap-x-4 desktop:grid-cols-1">
            <StatBlock label="ตำแหน่งถัดไป" value="01" detail="Push A" accent />
            <StatBlock label="เป้าหมายต่อสัปดาห์" value="04" unit="DAYS" detail="Informational" />
          </div>
        </aside>
      </div>
    </PageFrame>
  );
}

const templateExercises = [
  ["01", "Barbell Bench Press", "4", "6–8", "2", "120s"],
  ["02", "Incline Dumbbell Press", "3", "8–10", "2", "90s"],
  ["03", "Seated Shoulder Press", "3", "8", "2", "90s"],
];

export function TemplateEditorPage() {
  return (
    <PageFrame
      pageId="P-06"
      title="Workout Template Editor"
      description="โครง editor แบบ static; ยังไม่มีการเพิ่ม เรียง หรือบันทึก Exercise จริง"
      action={<Link to="/plans" className={buttonStyles({ variant: "primary" })}>กลับไป Plans</Link>}
    >
      <div className="page-grid">
        <aside className="col-span-4 min-w-0 tablet:col-span-3 desktop:col-span-4">
          <SectionHeader eyebrow="EXERCISE LIBRARY" title="เลือกท่าฝึก" />
          <div className="mt-5 space-y-4">
            <Input label="ค้นหา" placeholder="ชื่อท่าฝึก" type="search" />
            <p className="border-t border-line-subtle pt-4 text-sm leading-6 text-ink-muted">
              บน tablet ส่วนนี้จะทำงานเป็น drawer และบน phone จะแยกเป็นขั้นตอนใน feature implementation
            </p>
          </div>
        </aside>
        <section className="col-span-4 mt-10 min-w-0 tablet:col-span-5 tablet:mt-0 desktop:col-span-8">
          <SectionHeader eyebrow="TEMPLATE · PUSH A" title="ลำดับท่าฝึก" />
          <div className="mt-5 border-t border-line">
            {templateExercises.map(([index, name, sets, reps, rir, rest]) => (
              <div key={name} className="border-b border-line-subtle py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-1 text-xs text-ink-muted">{index}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{name}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm tablet:grid-cols-4">
                      <div><dt className="text-xs text-ink-muted">SETS</dt><dd className="mt-1 tabular-nums">{sets}</dd></div>
                      <div><dt className="text-xs text-ink-muted">REPS</dt><dd className="mt-1 tabular-nums">{reps}</dd></div>
                      <div><dt className="text-xs text-ink-muted">RIR</dt><dd className="mt-1 tabular-nums">{rir}</dd></div>
                      <div><dt className="text-xs text-ink-muted">REST</dt><dd className="mt-1 tabular-nums">{rest}</dd></div>
                    </dl>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
