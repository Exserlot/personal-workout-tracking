import { Link } from "react-router-dom";
import { PageFrame } from "../components/layout/PageFrame";
import { SectionHeader } from "../components/ui/SectionHeader";
import { StatBlock } from "../components/ui/StatBlock";
import { buttonStyles } from "../components/ui/buttonStyles";

const sessions = [
  ["04 AUG 2026", "Push A", "64 min", "8,420 kg"],
  ["01 AUG 2026", "Pull B", "72 min", "9,180 kg"],
  ["29 JUL 2026", "Legs C", "68 min", "11,360 kg"],
  ["26 JUL 2026", "Push A", "61 min", "8,060 kg"],
];

export function HistoryPage() {
  return (
    <PageFrame pageId="P-09" title="ประวัติการฝึก" description="Completed Sessions เรียงจากใหม่ไปเก่า">
      <SectionHeader eyebrow="04 SESSIONS" title="รายการล่าสุด" description="Static session rows เปลี่ยนจาก table เป็น labeled rows บน mobile" />
      <div className="mt-5 border-t border-line">
        {sessions.map(([date, label, duration, volume], index) => (
          <Link
            key={date}
            to="/history/session-2026-08-04"
            className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line-subtle py-4 hover:bg-surface tablet:grid-cols-[10rem_minmax(0,1fr)_8rem_8rem] tablet:items-center"
          >
            <p className="text-xs font-semibold tabular-nums text-ink-muted">{date}</p>
            <div className="min-w-0">
              <p className="font-semibold">{label}</p>
              <p className="mt-1 text-sm text-ink-muted tablet:hidden">{duration} · {volume}</p>
            </div>
            <p className="hidden text-right text-sm tabular-nums text-ink-secondary tablet:block">{duration}</p>
            <p className={`hidden text-right text-sm font-semibold tabular-nums tablet:block ${index === 0 ? "text-accent" : "text-ink"}`}>{volume}</p>
          </Link>
        ))}
      </div>
    </PageFrame>
  );
}

export function HistoryDetailPage() {
  return (
    <PageFrame
      pageId="P-10"
      title="Push A · 04 August"
      description="History Detail / Edit — snapshot ตัวอย่างที่ไม่เปลี่ยนตาม Template"
      action={<Link to="/history" className={buttonStyles({ variant: "quiet" })}>กลับไป History</Link>}
    >
      <div className="page-grid">
        <div className="col-span-4 grid grid-cols-2 gap-x-4 tablet:col-span-8 tablet:grid-cols-4 desktop:col-span-12">
          <StatBlock label="Duration" value="64:18" accent />
          <StatBlock label="Exercises" value="05" />
          <StatBlock label="Working sets" value="16" />
          <StatBlock label="Volume" value="8,420" unit="KG" />
        </div>
        <section className="col-span-4 mt-10 tablet:col-span-8 desktop:col-span-8">
          <SectionHeader eyebrow="SESSION SNAPSHOT" title="Barbell Bench Press" description="ค่า 70 kg ในรายการนี้เป็น sample snapshot และแยกจากแผนปัจจุบัน" />
          <div className="mt-5 grid grid-cols-4 border-y border-line py-4 text-center">
            <div><p className="text-xs text-ink-muted">SET</p><p className="mt-2 font-semibold">02</p></div>
            <div><p className="text-xs text-ink-muted">KG</p><p className="mt-2 font-semibold">70</p></div>
            <div><p className="text-xs text-ink-muted">REPS</p><p className="mt-2 font-semibold">8</p></div>
            <div><p className="text-xs text-ink-muted">RIR</p><p className="mt-2 font-semibold">2</p></div>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
