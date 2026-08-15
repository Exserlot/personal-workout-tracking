import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/icons/Icon";
import { PageFrame } from "../components/layout/PageFrame";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { buttonStyles } from "../components/ui/buttonStyles";
import { ArchiveExerciseDialog } from "../features/exercises/components/ArchiveExerciseDialog";
import { ExerciseFilters } from "../features/exercises/components/ExerciseFilters";
import { ExerciseForm } from "../features/exercises/components/ExerciseForm";
import { ExerciseResults } from "../features/exercises/components/ExerciseResults";
import { useExerciseRepository } from "../features/exercises/ExerciseRepositoryContext";
import { isExerciseRepositoryError } from "../features/exercises/data/ExerciseRepository";
import {
  defaultExerciseQuery,
  getEquipmentLabel,
  getMuscleLabel,
  type Exercise,
  type ExerciseDraft,
  type ExerciseQuery,
} from "../features/exercises/domain/exercise";
import {
  clearExerciseFilters,
  hasActiveExerciseFilters,
} from "../features/exercises/domain/exerciseRules";

type LoadState = "loading" | "success" | "error";

function ExerciseListSkeleton() {
  return (
    <div aria-label="กำลังโหลดรายการท่าฝึก" role="status">
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_30%] items-center gap-4 border-b border-line-subtle py-3">
          <span className="h-4 w-3/5 bg-interactive motion-safe:animate-pulse" />
          <span className="h-3 w-full bg-interactive motion-safe:animate-pulse" />
        </div>
      ))}
      <span className="sr-only">กำลังโหลด</span>
    </div>
  );
}

export function ExerciseLibraryPage() {
  const repository = useExerciseRepository();
  const location = useLocation();
  const [query, setQuery] = useState<ExerciseQuery>(defaultExerciseQuery);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const hasLoadedRef = useRef(false);
  const requestVersionRef = useRef(0);
  const [debouncedSearch, setDebouncedSearch] = useState(defaultExerciseQuery.search);
  const notice = (location.state as { notice?: string } | null)?.notice;
  const { equipmentCode, muscleCode, status } = query;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(query.search), 250);
    return () => window.clearTimeout(timer);
  }, [query.search]);

  useEffect(() => {
    let active = true;
    const requestVersion = ++requestVersionRef.current;
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) setLoadState("loading");
    else setUpdating(true);
    setErrorMessage("");
    setUpdateError("");
    const requestQuery: ExerciseQuery = {
      search: debouncedSearch,
      equipmentCode,
      muscleCode,
      status,
    };
    repository.list(requestQuery).then(
      (results) => {
        if (!active || requestVersion !== requestVersionRef.current) return;
        setExercises(results);
        setLoadState("success");
        setUpdating(false);
        hasLoadedRef.current = true;
      },
      () => {
        if (!active || requestVersion !== requestVersionRef.current) return;
        if (isInitialLoad) {
          setErrorMessage("โหลด Exercise Library ไม่สำเร็จ ข้อมูลเดิมไม่ได้ถูกเปลี่ยนแปลง");
          setLoadState("error");
        } else {
          setUpdateError("อัปเดตรายการไม่สำเร็จ ข้อมูลเดิมยังอยู่");
        }
        setUpdating(false);
      },
    );
    return () => {
      active = false;
    };
  }, [debouncedSearch, equipmentCode, muscleCode, reloadKey, repository, status]);

  return (
    <PageFrame
      pageId="P-03"
      eyebrow="P-03 · EXERCISE LIBRARY"
      title="คลังท่าฝึก"
      description="ค้นหา Starter Exercises และจัดการ Custom Exercises สำหรับใช้ในแผนการฝึก"
      action={<Link to="/exercises/new" className={buttonStyles()}><Icon name="plus" className="h-4 w-4" />สร้างท่าฝึก</Link>}
    >
      {notice ? (
        <div role="status" className="mb-8 border-l-2 border-success bg-surface px-4 py-3">
          <p className="font-semibold text-success">บันทึกสำเร็จ</p>
          <p className="mt-1 text-sm text-ink-secondary">{notice}</p>
        </div>
      ) : null}

      <div className="page-grid">
        <aside className="col-span-4 min-w-0 tablet:col-span-8 desktop:col-span-3">
          <ExerciseFilters query={query} onChange={setQuery} />
        </aside>

        <section className="col-span-4 mt-8 min-w-0 border-line tablet:col-span-8 tablet:mt-10 desktop:col-span-9 desktop:mt-0">
          <SectionHeader
            eyebrow={loadState === "success" ? `${exercises.length.toString().padStart(2, "0")} RESULTS` : "RESULTS"}
            title="รายการท่าฝึก"
            description="ค้นหาจากชื่อ กล้ามเนื้อ และอุปกรณ์"
            showTopRule={false}
            isTitleDescriptionInline={true}
          />
          <p className="sr-only" aria-live="polite">
            {loadState === "success" ? `พบ ${exercises.length} รายการ` : "กำลังโหลดรายการ"}
          </p>

          <div className="mt-4" aria-busy={loadState === "loading" || updating}>
            {loadState === "loading" ? <ExerciseListSkeleton /> : null}
            {updating ? (
              <p role="status" className="mb-3 border-l-2 border-accent pl-3 text-sm text-ink-muted">
                กำลังอัปเดตรายการ…
              </p>
            ) : null}
            {updateError ? (
              <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-error bg-surface px-4 py-3">
                <p className="text-sm text-error">{updateError}</p>
                <Button variant="secondary" size="compact" onClick={() => setReloadKey((current) => current + 1)}>
                  <Icon name="refresh" className="h-4 w-4" />
                  ลองอีกครั้ง
                </Button>
              </div>
            ) : null}
            {loadState === "error" ? (
              <EmptyState
                marker="ERROR"
                title="เปิดคลังท่าฝึกไม่ได้"
                description={errorMessage}
                action={<Button variant="secondary" onClick={() => setReloadKey((current) => current + 1)}><Icon name="refresh" className="h-4 w-4" />ลองอีกครั้ง</Button>}
              />
            ) : null}
            {loadState === "success" && exercises.length > 0 ? (
              <ExerciseResults exercises={exercises} />
            ) : null}
            {loadState === "success" && exercises.length === 0 ? (
              <>
                <div id="exercise-results" className="sr-only" />
                <EmptyState
                  marker="00"
                  title={hasActiveExerciseFilters(query) ? "ไม่พบท่าฝึกที่ตรงกับตัวกรอง" : "ยังไม่มีท่าฝึก"}
                  description={
                    hasActiveExerciseFilters(query)
                      ? "ลองล้างคำค้นหรือเปลี่ยนกลุ่มกล้ามเนื้อ อุปกรณ์ และสถานะ"
                      : "สร้าง Custom Exercise แรกเพื่อเริ่มจัดคลังท่าฝึก"
                  }
                  action={
                    hasActiveExerciseFilters(query) ? (
                      <Button variant="secondary" onClick={() => setQuery(clearExerciseFilters())}><Icon name="close" className="h-4 w-4" />ล้างตัวกรอง</Button>
                    ) : undefined
                  }
                  showTopRule={false}
                />
              </>
            ) : null}
          </div>
        </section>
      </div>
    </PageFrame>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line-subtle py-4 tablet:grid-cols-[180px_minmax(0,1fr)] tablet:gap-6">
      <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function ReadOnlyExerciseDetail({ exercise }: { exercise: Exercise }) {
  const secondary = exercise.secondaryMuscleCodes.map(getMuscleLabel).join(", ") || "ไม่มี";
  return (
    <div>
      <div className="border-l-2 border-line-strong bg-surface px-4 py-3">
        <p className="font-semibold">
          {exercise.source === "starter" ? "Starter Exercise · Read-only" : "Custom Exercise · Archived"}
        </p>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">
          {exercise.source === "starter"
            ? "Starter Library ใช้เป็นข้อมูลอ้างอิงและแก้ไขไม่ได้"
            : "รายการนี้ถูกซ่อนจากตัวเลือกใหม่ แต่ข้อมูลใน History ยังคงเดิม"}
        </p>
      </div>
      <dl className="mt-6 border-t border-line">
        <DetailRow label="ชื่อท่าฝึก">{exercise.name}</DetailRow>
        <DetailRow label="กล้ามเนื้อหลัก">{getMuscleLabel(exercise.primaryMuscleCode)}</DetailRow>
        <DetailRow label="กล้ามเนื้อรอง">{secondary}</DetailRow>
        <DetailRow label="อุปกรณ์">{getEquipmentLabel(exercise.equipmentCode)}</DetailRow>
        <DetailRow label="คำอธิบาย">{exercise.description || "ไม่มีคำอธิบาย"}</DetailRow>
      </dl>
    </div>
  );
}

export function ExerciseEditorPage() {
  const { exerciseId = "" } = useParams();
  const isNew = exerciseId === "new";
  const repository = useExerciseRepository();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(isNew ? "success" : "loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);

  const loadExercise = useCallback(async () => {
    if (isNew) return;
    setLoadState("loading");
    setErrorMessage("");
    try {
      const result = await repository.getById(exerciseId);
      if (!result) {
        setErrorMessage("ไม่พบ Exercise นี้ อาจถูกลบจาก temporary data หรือ URL ไม่ถูกต้อง");
        setLoadState("error");
        return;
      }
      setExercise(result);
      setLoadState("success");
    } catch {
      setErrorMessage("โหลดรายละเอียดท่าฝึกไม่สำเร็จ กรุณาลองอีกครั้ง");
      setLoadState("error");
    }
  }, [exerciseId, isNew, repository]);

  useEffect(() => {
    void loadExercise();
  }, [loadExercise]);

  useEffect(() => {
    if (!editorDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editorDirty]);

  async function createExercise(draft: ExerciseDraft) {
    const created = await repository.create(draft);
    setEditorDirty(false);
    navigate("/exercises", { state: { notice: `สร้าง ${created.name} แล้ว` } });
  }

  async function updateExercise(draft: ExerciseDraft) {
    if (!exercise) return;
    const updated = await repository.update(exercise.id, draft);
    setEditorDirty(false);
    navigate("/exercises", { state: { notice: `บันทึกการแก้ไข ${updated.name} แล้ว` } });
  }

  async function archiveExercise() {
    if (!exercise) return;
    setArchiveLoading(true);
    setArchiveError("");
    try {
      const archived = await repository.archive(exercise.id);
      navigate("/exercises", { state: { notice: `Archive ${archived.name} แล้ว โดยไม่ลบ History` } });
    } catch (error) {
      setArchiveError(
        isExerciseRepositoryError(error)
          ? error.message
          : "Archive ไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
      setArchiveLoading(false);
    }
  }

  function cancelEditor() {
    if (editorDirty && !window.confirm("มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกหรือไม่?")) return;
    navigate("/exercises");
  }

  const isReadOnly = !isNew && Boolean(exercise) && (exercise?.source === "starter" || Boolean(exercise?.archivedAt));

  const title = isNew ? "สร้างท่าฝึก" : exercise?.name ?? "รายละเอียดท่าฝึก";

  return (
    <PageFrame
      pageId="P-04"
      eyebrow="P-04 · EXERCISE DETAIL"
      title={title}
      description={
        isNew
          ? "เพิ่มท่าฝึกที่คุณใช้ พร้อมกล้ามเนื้อและอุปกรณ์"
          : "ดูหรือแก้ไขรายละเอียดท่าฝึก โดยไม่กระทบ Workout History"
      }
      action={isReadOnly ? <Link to="/exercises" className={buttonStyles({ variant: "quiet" })}><Icon name="arrow" className="h-4 w-4 rotate-180" />กลับไปคลัง</Link> : undefined}
    >
      {loadState === "loading" ? (
        <div role="status" className="max-w-3xl space-y-5" aria-label="กำลังโหลดรายละเอียดท่าฝึก">
          <div className="h-12 bg-interactive motion-safe:animate-pulse" />
          <div className="h-12 bg-interactive motion-safe:animate-pulse" />
          <div className="h-32 bg-interactive motion-safe:animate-pulse" />
        </div>
      ) : null}

      {loadState === "error" ? (
        <EmptyState
          marker="ERROR"
          title="เปิดรายละเอียดท่าฝึกไม่ได้"
          description={errorMessage}
          action={<Button variant="secondary" onClick={() => void loadExercise()}>ลองอีกครั้ง</Button>}
        />
      ) : null}

      {loadState === "success" ? (
        <div className="page-grid">
          <section className="col-span-4 min-w-0 tablet:col-span-7 desktop:col-span-8">
            {isNew ? <ExerciseForm onSubmit={createExercise} onCancel={cancelEditor} onDirtyChange={setEditorDirty} /> : null}
            {!isNew && exercise?.source === "custom" && !exercise.archivedAt ? (
              <ExerciseForm exercise={exercise} onSubmit={updateExercise} onCancel={cancelEditor} onDirtyChange={setEditorDirty} />
            ) : null}
            {!isNew && exercise && (exercise.source === "starter" || exercise.archivedAt) ? (
              <ReadOnlyExerciseDetail exercise={exercise} />
            ) : null}
          </section>

          {!isNew && exercise?.source === "custom" && !exercise.archivedAt ? (
            <aside className="col-span-4 mt-10 tablet:col-span-8 desktop:col-span-3 desktop:col-start-10 desktop:mt-0">
              <div className="border-t border-line pt-4">
                <p className="text-xs font-semibold tracking-[0.08em] text-error">DANGER ZONE</p>
                <h2 className="mt-3 text-h3">หยุดใช้ท่าฝึกนี้</h2>
                <p className="mt-3 text-sm leading-6 text-ink-secondary">
                  Archive จะซ่อนท่านี้จากรายการใช้งาน แต่ไม่ลบข้อมูลย้อนหลัง
                </p>
                <Button variant="destructive" className="mt-5 w-full" onClick={() => setArchiveOpen(true)}>
                  <Icon name="archive" className="h-4 w-4" />
                  Archive Exercise
                </Button>
              </div>
            </aside>
          ) : null}
        </div>
      ) : null}

      {exercise ? (
        <ArchiveExerciseDialog
          exerciseName={exercise.name}
          open={archiveOpen}
          loading={archiveLoading}
          error={archiveError}
          onCancel={() => {
            setArchiveOpen(false);
            setArchiveError("");
          }}
          onConfirm={() => void archiveExercise()}
        />
      ) : null}
    </PageFrame>
  );
}
