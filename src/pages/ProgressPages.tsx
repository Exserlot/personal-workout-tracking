import { Link } from "react-router-dom";
import { PageFrame } from "../components/layout/PageFrame";
import { StatBlock } from "../components/ui/StatBlock";
import { TrendChart } from "../components/ui/TrendChart";
import { SectionHeader } from "../components/ui/SectionHeader";
import { buttonStyles } from "../components/ui/buttonStyles";

export function ProgressPage() {
  return (
    <PageFrame pageId="P-11" title="ความก้าวหน้า" description="ภาพรวมตัวอย่างจาก completed working sets">
      <div className="page-grid">
        <div className="col-span-4 grid grid-cols-2 gap-x-4 tablet:col-span-8 tablet:grid-cols-4 desktop:col-span-12">
          <StatBlock label="Recent PR" value="02" unit="PR" accent />
          <StatBlock label="Exercises tracked" value="14" />
          <StatBlock label="Sessions" value="24" />
          <StatBlock label="This cycle" value="12" unit="WKS" />
        </div>
        <section className="col-span-4 mt-10 min-w-0 tablet:col-span-8 desktop:col-span-8">
          <SectionHeader eyebrow="FEATURED EXERCISE" title="Barbell Bench Press" />
          <div className="mt-5"><TrendChart /></div>
        </section>
        <aside className="col-span-4 mt-10 tablet:col-span-8 desktop:col-span-4">
          <SectionHeader eyebrow="RECENT SIGNALS" title="รายการตัวอย่าง" />
          <div className="mt-5 border-t border-line">
            {['Bench Press · 84.2 kg e1RM', 'Back Squat · 120 kg', 'RDL · 8 reps at 100 kg'].map((item, index) => (
              <div key={item} className="flex min-h-16 items-center gap-3 border-b border-line-subtle py-3">
                <span className="text-xs tabular-nums text-accent">0{index + 1}</span>
                <span className="text-sm font-semibold">{item}</span>
              </div>
            ))}
          </div>
          <Link to="/progress/bench-press" className={buttonStyles({ variant: "secondary", fullWidth: true, className: "mt-6" })}>เปิด Exercise Progress</Link>
        </aside>
      </div>
    </PageFrame>
  );
}

export function ExerciseProgressPage() {
  return (
    <PageFrame
      pageId="P-12"
      title="Barbell Bench Press"
      description="Exercise Progress Detail · sample values and accessible chart summary"
      action={<Link to="/progress" className={buttonStyles({ variant: "quiet" })}>กลับไป Progress</Link>}
    >
      <div className="page-grid">
        <div className="col-span-4 grid grid-cols-2 gap-x-4 tablet:col-span-8 tablet:grid-cols-4 desktop:col-span-12">
          <StatBlock label="Best weight" value="80" unit="KG" accent />
          <StatBlock label="Best reps" value="10" unit="REPS" />
          <StatBlock label="Estimated 1RM" value="84.2" unit="KG" />
          <StatBlock label="Working volume" value="2,240" unit="KG" />
        </div>
        <section className="col-span-4 mt-10 min-w-0 tablet:col-span-8 desktop:col-span-8">
          <TrendChart />
        </section>
        <aside className="col-span-4 mt-10 border-t border-line pt-5 tablet:col-span-8 desktop:col-span-4 desktop:mt-10">
          <p className="text-xs font-semibold tracking-[0.06em] text-accent">LATEST PR</p>
          <p className="mt-4 text-h3">80 kg × 5 reps</p>
          <p className="mt-2 text-sm text-ink-muted">04 August 2026 · static sample</p>
          <Link to="/history/session-2026-08-04" className={buttonStyles({ variant: "secondary", className: "mt-6" })}>ดู Session ต้นทาง</Link>
        </aside>
      </div>
    </PageFrame>
  );
}
