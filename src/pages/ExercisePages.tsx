import { Link, useParams } from "react-router-dom";
import { PageFrame } from "../components/layout/PageFrame";
import { Input } from "../components/ui/Input";
import { SectionHeader } from "../components/ui/SectionHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { buttonStyles } from "../components/ui/buttonStyles";

const library = [
  ["Barbell Bench Press", "Chest", "Barbell", "Starter"],
  ["Back Squat", "Quadriceps", "Barbell", "Starter"],
  ["Romanian Deadlift", "Hamstrings", "Barbell", "Starter"],
  ["Cable Lateral Raise", "Shoulders", "Cable", "Custom"],
];

export function ExerciseLibraryPage() {
  return (
    <PageFrame
      pageId="P-03"
      title="คลังท่าฝึก"
      description="ค้นหาและจัดการ Starter Exercises และ Custom Exercises"
      action={<Link to="/exercises/new" className={buttonStyles()}>สร้างท่าฝึก</Link>}
    >
      <div className="page-grid">
        <aside className="col-span-4 min-w-0 tablet:col-span-3 desktop:col-span-3">
          <Input label="ค้นหาท่าฝึก" placeholder="เช่น Bench Press" type="search" />
          <div className="mt-6 grid grid-cols-2 gap-3 tablet:grid-cols-1">
            <Input label="กล้ามเนื้อ" value="ทั้งหมด" readOnly />
            <Input label="อุปกรณ์" value="ทั้งหมด" readOnly />
          </div>
        </aside>
        <section className="col-span-4 mt-8 min-w-0 tablet:col-span-5 tablet:mt-0 desktop:col-span-9">
          <SectionHeader eyebrow="04 RESULTS" title="รายการปัจจุบัน" />
          <div className="mt-4" role="list">
            {library.map(([name, muscle, equipment, source]) => (
              <Link
                key={name}
                to={`/exercises/${name === "Barbell Bench Press" ? "bench-press" : "sample"}`}
                className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line-subtle py-3 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="mt-1 text-sm text-ink-muted">{muscle} · {equipment}</p>
                </div>
                <span className="text-xs font-semibold text-ink-secondary">{source}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PageFrame>
  );
}

export function ExerciseEditorPage() {
  const { exerciseId } = useParams();
  const isNew = exerciseId === "new";

  return (
    <PageFrame
      pageId="P-04"
      title={isNew ? "สร้างท่าฝึก" : "Barbell Bench Press"}
      description="Exercise Detail / Editor — ฟอร์มนี้เป็น static placeholder และยังไม่บันทึกข้อมูล"
      action={<Link to="/exercises" className={buttonStyles({ variant: "quiet" })}>กลับไปคลัง</Link>}
    >
      <div className="page-grid">
        <section className="col-span-4 space-y-5 tablet:col-span-6 desktop:col-span-7">
          <Input label="ชื่อท่าฝึก" defaultValue={isNew ? "" : "Barbell Bench Press"} placeholder="ชื่อท่าฝึก" />
          <div className="grid gap-5 tablet:grid-cols-2">
            <Input label="กล้ามเนื้อหลัก" defaultValue={isNew ? "" : "Chest"} />
            <Input label="อุปกรณ์" defaultValue={isNew ? "" : "Barbell"} />
          </div>
          <Input label="กล้ามเนื้อรอง" defaultValue={isNew ? "" : "Triceps, Front deltoids"} helperText="รองรับหลายรายการใน feature implementation" />
        </section>
        <aside className="col-span-4 mt-10 tablet:col-span-2 tablet:mt-0 desktop:col-span-4 desktop:col-start-9">
          <EmptyState
            marker="INFO"
            title="ยังไม่มีการบันทึก"
            description="Foundation นี้แสดงเฉพาะโครง form, spacing และ state anatomy เท่านั้น"
          />
        </aside>
      </div>
    </PageFrame>
  );
}
