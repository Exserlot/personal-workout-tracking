import { Link } from "react-router-dom";
import { PageFrame } from "../components/layout/PageFrame";
import { Divider } from "../components/ui/Divider";
import { SectionHeader } from "../components/ui/SectionHeader";
import { StatBlock } from "../components/ui/StatBlock";
import { buttonStyles } from "../components/ui/buttonStyles";
import { Icon } from "../components/icons/Icon";

const exercises = [
  ["01", "Barbell Bench Press", "4 × 8", "70 KG"],
  ["02", "Incline Dumbbell Press", "3 × 10", "24 KG"],
  ["03", "Seated Shoulder Press", "3 × 8", "32 KG"],
  ["04", "Cable Fly", "3 × 12", "18 KG"],
  ["05", "Triceps Pushdown", "3 × 12", "25 KG"],
];

export function TodayPage() {
  return (
    <PageFrame
      pageId="P-02"
      title="การฝึกของวันนี้"
      description="Push A · ลำดับที่ 01 / 03 ใน Routine ปัจจุบัน"
      action={
        <Link to="/workout/active" className={buttonStyles({ variant: "primary", size: "large" })}>
          เริ่มการฝึก <Icon name="arrow" />
        </Link>
      }
    >
      <section className="page-grid">
        <div className="col-span-4 grid grid-cols-2 gap-x-4 tablet:col-span-8 tablet:grid-cols-4 desktop:col-span-12">
          <StatBlock label="ท่าฝึก" value="05" detail="Push session" accent />
          <StatBlock label="เซ็ตทั้งหมด" value="16" detail="3 working groups" />
          <StatBlock label="เวลาโดยประมาณ" value="65" unit="MIN" detail="รวมเวลาพัก" />
          <StatBlock label="ครั้งล่าสุด" value="04" unit="AUG" detail="Completed" />
        </div>
      </section>

      <div className="mt-10 page-grid">
        <section className="col-span-4 min-w-0 tablet:col-span-5 desktop:col-span-8">
          <SectionHeader
            eyebrow="NEXT SESSION"
            title="รายการท่าฝึก"
            description="ค่าทั้งหมดเป็น static content สำหรับตรวจ application shell"
          />
          <div className="mt-4">
            {exercises.map(([index, name, sets, weight]) => (
              <div key={index} className="grid min-h-16 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-subtle py-3">
                <span className="text-xs tabular-nums text-ink-muted">{index}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="mt-1 text-sm text-ink-muted">{sets}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink-secondary">{weight}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="col-span-4 mt-10 min-w-0 tablet:col-span-3 tablet:mt-0 desktop:col-span-4">
          <SectionHeader eyebrow="CONTEXT" title="Routine" />
          <div className="mt-4 border border-line bg-surface p-4 tablet:p-5">
            <p className="text-sm text-ink-muted">สัปดาห์นี้</p>
            <p className="mt-3 text-data tabular-nums">02 / 04</p>
            <Divider className="my-5" />
            <ol className="space-y-3 text-sm">
              <li className="flex justify-between gap-4 text-accent"><span>A · Push</span><span>ถัดไป</span></li>
              <li className="flex justify-between gap-4 text-ink-secondary"><span>B · Pull</span><span>02</span></li>
              <li className="flex justify-between gap-4 text-ink-secondary"><span>C · Legs</span><span>03</span></li>
            </ol>
            <Link to="/plans" className={buttonStyles({ variant: "secondary", fullWidth: true, className: "mt-6" })}>
              ดูแผนการฝึก
            </Link>
          </div>
        </aside>
      </div>
    </PageFrame>
  );
}
