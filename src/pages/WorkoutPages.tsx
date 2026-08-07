import { Link } from "react-router-dom";
import { Icon } from "../components/icons/Icon";
import { Button } from "../components/ui/Button";
import { buttonStyles } from "../components/ui/buttonStyles";
import { Divider } from "../components/ui/Divider";
import { PageFrame } from "../components/layout/PageFrame";
import { StatBlock } from "../components/ui/StatBlock";

const sets = [
  ["01", "60", "10", "3", "complete"],
  ["02", "70", "8", "2", "complete"],
  ["03", "70", "8", "2", "current"],
  ["04", "—", "—", "—", "empty"],
];

export function ActiveWorkoutPage() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-content bg-canvas pb-[calc(104px+env(safe-area-inset-bottom))] tablet:min-h-0 tablet:px-6 tablet:py-8 desktop:px-8 large:px-12">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-canvas px-4 tablet:static tablet:px-0">
        <Link to="/today" className="flex h-11 w-11 items-center justify-center text-ink-secondary hover:text-ink" aria-label="ออกจาก Active Workout">
          <Icon name="close" />
        </Link>
        <p className="text-xs font-semibold tracking-[0.08em] tabular-nums">02 / 05</p>
        <Button variant="quiet" className="h-11 w-11 px-0" aria-label="ตัวเลือกเพิ่มเติม">
          <Icon name="menu" />
        </Button>
      </header>

      <div className="page-grid px-4 pt-6 tablet:px-0 tablet:pt-8">
        <aside className="hidden desktop:col-span-3 desktop:block">
          <p className="text-xs font-semibold tracking-[0.06em] text-ink-muted">SESSION INDEX</p>
          <ol className="mt-4 border-t border-line">
            {['Bench Press', 'Incline Press', 'Shoulder Press', 'Cable Fly', 'Pushdown'].map((name, index) => (
              <li key={name} className={`border-b border-line-subtle py-3 text-sm ${index === 0 ? 'text-accent' : 'text-ink-secondary'}`}>
                <span className="mr-3 text-xs tabular-nums">0{index + 1}</span>{name}
              </li>
            ))}
          </ol>
        </aside>

        <main className="col-span-4 min-w-0 tablet:col-span-6 desktop:col-span-6 desktop:px-5">
          <p className="text-xs font-semibold tracking-[0.06em] text-accent">P-07 · STATIC ACTIVE SESSION</p>
          <h1 className="mt-4 text-[30px] font-bold leading-9 tracking-[-0.025em] tablet:text-h1">Barbell Bench Press</h1>
          <p className="mt-2 text-sm text-ink-muted">Chest · Compound · Working sets</p>

          <div className="mt-6 border border-line bg-surface p-4">
            <p className="text-xs font-semibold text-ink-muted">ครั้งก่อน</p>
            <p className="mt-2 text-base font-semibold tabular-nums">70 KG × 8 REPS @ RIR 2</p>
          </div>

          <div className="mt-6">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,0.8fr)_2.5rem_2.75rem] gap-1 border-b border-line pb-2 text-center text-[10px] font-semibold tracking-[0.04em] text-ink-muted">
              <span>SET</span><span>KG</span><span>REPS</span><span>RIR</span><span>OK</span>
            </div>
            {sets.map(([set, weight, reps, rir, status]) => (
              <div key={set} className={`grid min-h-14 grid-cols-[2rem_minmax(0,1fr)_minmax(0,0.8fr)_2.5rem_2.75rem] items-center gap-1 border-b text-center tabular-nums ${status === 'current' ? 'border-line-strong bg-interactive' : 'border-line-subtle'}`}>
                <span className="text-xs text-ink-muted">{set}</span>
                <span className="font-semibold">{weight}</span>
                <span className="font-semibold">{reps}</span>
                <span className="font-semibold">{rir}</span>
                <span className="flex h-11 w-11 items-center justify-center justify-self-center" aria-label={status === 'complete' ? 'เซ็ตเสร็จแล้ว' : 'เซ็ตยังไม่เสร็จ'}>
                  {status === 'complete' ? <Icon name="check" className="h-5 w-5 text-success" /> : <span className="h-3 w-3 border border-line-strong" />}
                </span>
              </div>
            ))}
          </div>
        </main>

        <aside className="col-span-4 mt-8 min-w-0 border-t border-line pt-5 tablet:col-span-2 tablet:mt-0 tablet:border-t-0 tablet:border-l tablet:pl-5 desktop:col-span-3">
          <p className="text-xs font-semibold tracking-[0.06em] text-ink-muted">REST TIMER</p>
          <p className="mt-3 text-data-xl tabular-nums">01:24</p>
          <Divider className="my-5" />
          <p className="text-sm leading-6 text-ink-secondary">ตัวจับเวลาและการบันทึกเป็น placeholder; ไม่มี state persistence ใน foundation นี้</p>
        </aside>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas p-4 tablet:static tablet:mt-8 tablet:border-t-0 tablet:bg-transparent tablet:p-0">
        <div className="mx-auto flex max-w-content gap-3 tablet:justify-end tablet:px-6 desktop:px-8 large:px-12">
          <Link to="/workout/complete" className={buttonStyles({ variant: "accent", size: "large", fullWidth: true, className: "tablet:w-auto tablet:min-w-56" })}>
            Complete Set <Icon name="check" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CompletionSummaryPage() {
  return (
    <PageFrame
      pageId="P-08"
      title="สรุปการฝึก"
      description="Push A · Completed Session preview · ไม่มีข้อมูลจริงถูกบันทึก"
      action={<Link to="/today" className={buttonStyles()}>เสร็จสิ้น</Link>}
    >
      <div className="page-grid">
        <div className="col-span-4 grid grid-cols-2 gap-x-4 tablet:col-span-8 tablet:grid-cols-4 desktop:col-span-12">
          <StatBlock label="ระยะเวลา" value="64:18" detail="Sample" accent />
          <StatBlock label="Working sets" value="16" />
          <StatBlock label="Volume" value="8,420" unit="KG" />
          <StatBlock label="Personal records" value="02" unit="PR" />
        </div>
        <div className="col-span-4 mt-10 border-t border-line pt-6 tablet:col-span-8 desktop:col-span-8">
          <h2 className="text-h2">Session snapshot</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">หน้านี้มีไว้ยืนยัน destination และ responsive shell เท่านั้น การคำนวณและ snapshot จริงจะอยู่ใน milestone ถัดไป</p>
          <Link to="/history/session-2026-08-04" className={buttonStyles({ variant: "secondary", className: "mt-6" })}>ดูตัวอย่าง History</Link>
        </div>
      </div>
    </PageFrame>
  );
}
