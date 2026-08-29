import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageFrame } from "../components/layout/PageFrame";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { buttonStyles } from "../components/ui/buttonStyles";
import { usePlanningRepository } from "../features/planning/PlanningRepositoryContext";
import type {
  TemplateExercise,
  WorkoutTemplate,
  WorkoutTemplateSummary,
} from "../features/planning/domain/planning";
import { PlanningRepositoryError } from "../features/planning/data/PlanningRepository";
import { AdHocWorkoutDialog } from "../features/workout/components/AdHocWorkoutDialog";
import { useWorkoutRepository } from "../features/workout/WorkoutRepositoryContext";
import { useAuth } from "../features/auth/AuthContext";
import { loadLatestSessionCache } from "../features/workout/data/activeSessionCache";
import { listSyncOperations } from "../features/workout/data/workoutSyncStore";
import { useWorkoutSync } from "../features/workout/WorkoutSyncContext";
import { useRoutineTrackingRepository } from "../features/routine-tracking/RoutineTrackingRepositoryContext";
import { RoutineTrackingRepositoryError } from "../features/routine-tracking/data/RoutineTrackingRepository";
import type { RoutineWeekDayStatus, RoutineWeekSummary } from "../features/routine-tracking/domain/routineTracking";
import { groupRoutineWeekDays } from "../features/routine-tracking/domain/routineTracking";
import { getDeviceId } from "../features/workout/data/deviceIdentity";
import type {
  PreviousExerciseValues,
  WorkoutSession,
} from "../features/workout/domain/workout";
import { WorkoutRepositoryError } from "../features/workout/domain/workout";
import {
  compactExercisePreview,
  eligibleAdHocTemplates,
  formatPreviousPerformance,
  resolveTodayContentState,
  summarizeActiveSession,
} from "../features/workout/domain/todayRules";

type LoadStatus = "initial" | "refreshing" | "ready" | "error";
type SessionSource = "server" | "cache" | null;

interface PlannedRoutinePreview {
  week: RoutineWeekSummary;
  day: RoutineWeekDayStatus;
  template: WorkoutTemplate;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof WorkoutRepositoryError ||
    error instanceof PlanningRepositoryError ||
    error instanceof RoutineTrackingRepositoryError
    ? error.message
    : fallback;
}

function formatStartedAt(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function TodayLoading() {
  return (
    <PageFrame
      pageId="P-02"
      eyebrow="P-02 · TODAY"
      title="การฝึกของวันนี้"
      description="กำลังตรวจสอบ Session และแผนถัดไป"
    >
      <div className="page-grid" role="status">
        <div className="col-span-4 tablet:col-span-5 desktop:col-span-8">
          <div className="h-4 w-28 bg-interactive motion-safe:animate-pulse" />
          <div className="mt-4 h-12 max-w-md bg-interactive motion-safe:animate-pulse" />
          <div className="mt-5 h-12 w-full max-w-xs bg-interactive motion-safe:animate-pulse" />
          <div className="mt-8 h-48 bg-interactive motion-safe:animate-pulse" />
        </div>
        <div className="col-span-4 mt-8 h-56 bg-interactive motion-safe:animate-pulse tablet:col-span-3 tablet:mt-0 desktop:col-span-4" />
        <span className="sr-only">กำลังโหลดการฝึกของวันนี้</span>
      </div>
    </PageFrame>
  );
}

function ActionError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-4 border-l-2 border-error pl-4 text-sm text-error">
      {message}
    </div>
  );
}

function ExerciseRows({
  exercises,
  previousValues,
}: {
  exercises: TemplateExercise[];
  previousValues: Record<string, PreviousExerciseValues>;
}) {
  return (
    <div className="border-t border-line">
      {exercises.map((exercise) => {
        const first = exercise.prescriptions[0];
        const targetWeight = first?.targetWeightValue === null || !first
          ? "ไม่กำหนดน้ำหนัก"
          : `${first.targetWeightValue} ${first.targetWeightUnit ?? ""}`;
        return (
          <div
            key={exercise.id}
            className="grid min-h-[5rem] grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 border-b border-line-subtle py-3 tablet:grid-cols-[2rem_minmax(0,1fr)_auto]"
          >
            <span className="text-xs tabular-nums text-ink-muted">
              {String(exercise.sequence).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{exercise.exerciseName}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {exercise.prescriptions.length} เซ็ต
                {first ? ` · ${first.repsMin}–${first.repsMax} ครั้ง` : ""}
              </p>
              <p className="mt-1 truncate text-xs text-ink-secondary">
                {formatPreviousPerformance(previousValues[exercise.exerciseId])}
              </p>
            </div>
            <span className="col-start-2 mt-2 text-sm font-semibold tabular-nums text-ink-secondary tablet:col-start-auto tablet:mt-0">
              {targetWeight}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TodayPage() {
  const auth = useAuth();
  const planningRepository = usePlanningRepository();
  const routineTrackingRepository = useRoutineTrackingRepository();
  const workoutRepository = useWorkoutRepository();
  const syncCoordinator = useWorkoutSync();
  const navigate = useNavigate();
  const deviceId = useMemo(() => getDeviceId(), []);
  const userId = auth.session?.user.id ?? "";
  const requestRef = useRef(0);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("initial");
  const [loadError, setLoadError] = useState("");
  const [startError, setStartError] = useState("");
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [terminalSession, setTerminalSession] = useState<WorkoutSession | null>(null);
  const [terminalAction, setTerminalAction] = useState<"finish_session" | "discard_session" | null>(null);
  const [sessionSource, setSessionSource] = useState<SessionSource>(null);
  const [preview, setPreview] = useState<PlannedRoutinePreview | null>(null);
  const [previousValues, setPreviousValues] = useState<Record<string, PreviousExerciseValues>>({});
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [adHocTemplates, setAdHocTemplates] = useState<WorkoutTemplateSummary[]>([]);
  const [adHocLoading, setAdHocLoading] = useState(false);
  const [adHocError, setAdHocError] = useState("");

  const load = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const isCurrent = () => requestRef.current === requestId;
    setLoadStatus("initial");
    setLoadError("");
    setStartError("");
    setTerminalSession(null);
    setTerminalAction(null);
    setPreviousValues({});
    setShowAllExercises(false);

    const cached = await loadLatestSessionCache(userId).catch(() => null);
    const cachedOperations = cached ? await listSyncOperations(userId, cached.sessionId).catch(() => []) : [];
    const cachedTerminalOperation = cachedOperations.find((operation) => operation.status === "PENDING" && (operation.command.action === "finish_session" || operation.command.action === "discard_session"));
    const cachedSession = cached
      && (!cached.userId || cached.userId === userId)
      && cached.session.status === "ACTIVE"
      ? cached.session
      : null;
    const cachedTerminalSession = cached
      && (!cached.userId || cached.userId === userId)
      && cachedTerminalOperation
      && cached.session.status !== "ACTIVE"
      ? cached.session
      : null;
    if (cachedTerminalSession && isCurrent()) {
      setTerminalSession(cachedTerminalSession);
      setTerminalAction(cachedTerminalOperation?.command.action as "finish_session" | "discard_session");
      setActiveSession(null);
      setSessionSource("cache");
      setPreview(null);
      setLoadStatus("refreshing");
    }
    if (cachedSession && isCurrent()) {
      setActiveSession(cachedSession);
      setSessionSource("cache");
      setPreview(null);
      setLoadStatus("refreshing");
    }

    let serverSession: WorkoutSession | null;
    try {
      await workoutRepository.registerDevice(deviceId);
      serverSession = await workoutRepository.getActiveSession(deviceId);
    } catch (error) {
      if (!isCurrent()) return;
      if (cachedTerminalSession) {
        setTerminalSession(cachedTerminalSession);
        setTerminalAction(cachedTerminalOperation?.command.action as "finish_session" | "discard_session");
        setActiveSession(null);
        setSessionSource("cache");
        setPreview(null);
        setLoadError("กำลังแสดงสถานะการจบ Workout ที่บันทึกไว้ในเครื่อง รอการซิงก์");
        setLoadStatus("ready");
      } else if (cachedSession) {
        setActiveSession(cachedSession);
        setSessionSource("cache");
        setPreview(null);
        setLoadError("กำลังแสดงข้อมูลล่าสุดจากอุปกรณ์นี้ เนื่องจากยังเชื่อมต่อ Supabase ไม่ได้");
        setLoadStatus("ready");
      } else {
        setActiveSession(null);
        setSessionSource(null);
        setPreview(null);
        setLoadError(errorMessage(error, "โหลดการฝึกของวันนี้ไม่สำเร็จ"));
        setLoadStatus("error");
      }
      return;
    }

    if (!isCurrent()) return;
    if (cachedTerminalSession) {
      setTerminalSession(cachedTerminalSession);
      setTerminalAction(cachedTerminalOperation?.command.action as "finish_session" | "discard_session");
      setActiveSession(null);
      setSessionSource("cache");
      setPreview(null);
      setLoadStatus("ready");
      return;
    }
    if (serverSession) {
      setActiveSession(serverSession);
      setSessionSource("server");
      setPreview(null);
      setLoadStatus("ready");
      return;
    }

    setActiveSession(null);
    setTerminalSession(null);
    setSessionSource(null);
    try {
      const current = await routineTrackingRepository.getCurrentWeek();
      if (!isCurrent()) return;
      const week = current.currentPlan;
      if (!week || week.days.length === 0) {
        setPreview(null);
        setLoadStatus("ready");
        return;
      }
      const groups = groupRoutineWeekDays(week.days);
      const day = groups.recommended[0] ?? groups.repeat[0];
      if (!day?.templateId) throw new PlanningRepositoryError("not-found", "Template ของ Routine Day นี้ไม่พร้อมใช้งาน");
      const template = await planningRepository.getTemplate(day.templateId);
      if (!template) throw new PlanningRepositoryError("not-found", "ไม่พบ Template ของ Routine Day");
      const nextPreview = { week, day, template };
      setPreview(nextPreview);
      setLoadStatus("ready");
      const exerciseIds = nextPreview.template.exercises.map((exercise) => exercise.exerciseId);
      void workoutRepository.getPreviousValues(exerciseIds).then((values) => {
        if (isCurrent()) setPreviousValues(values);
      }).catch(() => undefined);
    } catch (error) {
      if (!isCurrent()) return;
      setPreview(null);
      setLoadError(errorMessage(error, "โหลดแผนถัดไปไม่สำเร็จ"));
      setLoadStatus("error");
    }
  }, [deviceId, planningRepository, routineTrackingRepository, userId, workoutRepository]);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (!terminalSession) return;
    syncCoordinator.start(terminalSession.id);
    const unsubscribe = syncCoordinator.subscribe(() => {
      if (syncCoordinator.getSnapshot().pendingCount === 0) void load();
    });
    return unsubscribe;
  }, [load, syncCoordinator, terminalSession]);

  useEffect(() => {
    if (activeSession) setAdHocOpen(false);
  }, [activeSession]);

  const loadAdHocTemplates = useCallback(async () => {
    setAdHocLoading(true);
    setAdHocError("");
    try {
      const templates = await planningRepository.listTemplates();
      setAdHocTemplates(eligibleAdHocTemplates(templates));
    } catch (error) {
      setAdHocError(errorMessage(error, "โหลด Templates ไม่สำเร็จ"));
    } finally {
      setAdHocLoading(false);
    }
  }, [planningRepository]);

  const openAdHoc = useCallback(() => {
    setAdHocOpen(true);
    void loadAdHocTemplates();
  }, [loadAdHocTemplates]);

  const closeAdHoc = useCallback(() => {
    setAdHocOpen(false);
  }, []);

  async function selectRoutineDay(day: RoutineWeekDayStatus) {
    if (!preview || !day.templateId || starting) return;
    setStartError("");
    try {
      const template = await planningRepository.getTemplate(day.templateId);
      if (!template) throw new PlanningRepositoryError("not-found", "ไม่พบ Template ของ Routine Day");
      setPreview({ week: preview.week, day, template });
      const values = await workoutRepository.getPreviousValues(template.exercises.map((exercise) => exercise.exerciseId));
      setPreviousValues(values);
      setShowAllExercises(false);
    } catch (error) {
      setStartError(errorMessage(error, "โหลด Routine Day ไม่สำเร็จ"));
    }
  }

  async function startPlanned() {
    if (!preview || starting) return;
    setStarting("planned");
    setStartError("");
    try {
      const session = await workoutRepository.startPlanned({
        sessionId: crypto.randomUUID(),
        deviceId,
        routineWeekPlanId: preview.week.id,
        routineWeekPlanDayId: preview.day.id,
        templateRevision: preview.template.revision,
      });
      navigate(`/workout/active?session=${session.id}`);
    } catch (error) {
      if (error instanceof WorkoutRepositoryError && error.code === "active-exists") {
        await load();
      } else {
        setStartError(errorMessage(error, "เริ่ม Planned Workout ไม่สำเร็จ"));
      }
    } finally {
      setStarting(null);
    }
  }

  async function startAdHoc(template: WorkoutTemplateSummary | null) {
    if (starting) return;
    setStarting(template?.id ?? "blank");
    setAdHocError("");
    try {
      const session = await workoutRepository.startAdHoc({
        sessionId: crypto.randomUUID(),
        deviceId,
        templateId: template?.id ?? null,
        templateRevision: template?.revision,
        name: template ? undefined : "Ad-hoc Workout",
      });
      navigate(`/workout/active?session=${session.id}`);
    } catch (error) {
      if (error instanceof WorkoutRepositoryError && error.code === "active-exists") {
        setAdHocOpen(false);
        await load();
      } else {
        setAdHocError(errorMessage(error, "เริ่ม Ad-hoc Workout ไม่สำเร็จ"));
      }
    } finally {
      setStarting(null);
    }
  }

  const contentState = resolveTodayContentState({
    initialLoading: loadStatus === "initial",
    terminalSession,
    activeSession,
    preview,
    fatalError: loadStatus === "error",
  });

  if (contentState === "initial-loading") return <TodayLoading />;

  if (contentState === "fatal-error") {
    return (
      <PageFrame
        pageId="P-02"
        eyebrow="P-02 · TODAY"
        title="การฝึกของวันนี้"
        description="ยังตรวจสอบ Session และแผนถัดไปไม่ได้"
      >
        <div role="alert" className="border-l-2 border-error pl-5">
          <p className="font-semibold text-error">โหลดข้อมูลไม่สำเร็จ</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-secondary">{loadError}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void load()}>ลองอีกครั้ง</Button>
            <Link to="/plans" className={buttonStyles({ variant: "quiet" })}>ไปที่ Plans</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  const description = terminalSession
    ? "Workout นี้ถูกบันทึกไว้ในเครื่องและกำลังรอการซิงก์"
    : activeSession
    ? "กลับไปทำ Session ที่ยังดำเนินอยู่"
    : preview
      ? `${preview.week.routineName} · ${preview.day.dayLabel}`
      : "จัดการ Routine หรือเริ่มการฝึกแบบอิสระ";
  const dayGroups = preview ? groupRoutineWeekDays(preview.week.days) : null;

  return (
    <PageFrame
      pageId="P-02"
      eyebrow="P-02 · TODAY"
      title="การฝึกของวันนี้"
      description={description}
    >
      {contentState === "terminal-pending" && terminalSession ? (
        <section className="page-grid" data-testid="today-terminal-pending">
          <div className="col-span-4 min-w-0 tablet:col-span-5 desktop:col-span-8">
            <p className="text-xs font-semibold tracking-[0.08em] text-warning">WORKOUT PENDING SYNC</p>
            <h2 className="mt-3 text-h1 text-balance">
              {terminalAction === "finish_session" ? "Workout จบแล้ว รอซิงก์" : "Workout ถูกยกเลิก รอซิงก์"}
            </h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-ink-secondary">
              {terminalAction === "finish_session" ? "ผลการฝึกถูกเก็บในเครื่องแล้ว เปิด Summary ได้ทันที และระบบจะยืนยันกับ server เมื่อออนไลน์" : "การยกเลิกถูกเก็บในเครื่องแล้ว Routine จะไม่เลื่อน และระบบจะยืนยันกับ server เมื่อออนไลน์"}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {terminalAction === "finish_session" ? (
                <Link to={`/workout/complete/${terminalSession.id}`} className={buttonStyles({ variant: "accent", size: "large" })}>เปิด Summary</Link>
              ) : null}
              <Button variant="secondary" size="large" onClick={() => void load()}>ตรวจสอบการซิงก์</Button>
            </div>
            {loadError ? <ActionError message={loadError} /> : null}
          </div>
          <aside className="col-span-4 mt-10 border-t border-line pt-5 tablet:col-span-3 tablet:mt-0 desktop:col-span-4">
            <p className="text-xs font-semibold tracking-[0.08em] text-ink-muted">SYNC STATUS</p>
            <p className="mt-3 text-sm leading-6 text-ink-secondary">ยังไม่สามารถเริ่มหรือ Resume Session ใหม่ได้จนกว่าการดำเนินการนี้จะซิงก์เสร็จ</p>
          </aside>
        </section>
      ) : null}
      {contentState === "active-session" && activeSession ? (() => {
        const summary = summarizeActiveSession(activeSession);
        const ownerDevice = activeSession.ownerDeviceId === deviceId;
        const cached = sessionSource === "cache";
        return (
          <section className="page-grid" data-testid="today-active-session">
            <div className="col-span-4 min-w-0 tablet:col-span-5 desktop:col-span-8">
              <p className="text-xs font-semibold tracking-[0.08em] text-accent">ACTIVE SESSION</p>
              <h2 className="mt-3 text-h1 text-balance">
                {activeSession.templateNameSnapshot ?? "Ad-hoc Workout"}
              </h2>
              <p className="mt-3 text-base leading-7 text-ink-secondary">
                {cached
                  ? "ข้อมูลล่าสุดที่เก็บไว้บนอุปกรณ์นี้"
                  : ownerDevice
                    ? "Session นี้พร้อมทำต่อบนอุปกรณ์นี้"
                    : "Session นี้เริ่มจากอุปกรณ์อื่น เปิดดูหรือย้ายมาทำต่อบนเครื่องนี้ได้"}
              </p>
              <Link
                to={`/workout/active?session=${activeSession.id}`}
                className={buttonStyles({
                  variant: "accent",
                  size: "large",
                  fullWidth: true,
                  className: "mt-6 tablet:w-auto",
                })}
              >
                {cached ? "เปิด Workout" : ownerDevice ? "Resume Workout" : "เปิดเพื่อทำต่อบนเครื่องนี้"}
              </Link>

              {loadStatus === "refreshing" ? (
                <p role="status" className="mt-3 text-sm text-ink-muted">กำลังตรวจสอบข้อมูลกับ Server…</p>
              ) : null}
              {loadError ? (
                <div role="status" className="mt-4 border-l-2 border-warning pl-4 text-sm text-warning">
                  {loadError}
                </div>
              ) : null}
              {!cached && !ownerDevice ? (
                <div className="mt-4 border-l-2 border-warning pl-4 text-sm leading-6 text-ink-secondary">
                  การย้ายสิทธิ์ต้องออนไลน์ และเครื่องเดิมจะเปลี่ยนเป็นอ่านอย่างเดียว
                </div>
              ) : null}

              <div className="mt-8 grid grid-cols-3 border-t border-line">
                <div className="py-4 pr-3">
                  <p className="text-xs text-ink-muted">ท่าฝึก</p>
                  <p className="mt-2 text-h3 tabular-nums">{summary.exerciseCount}</p>
                </div>
                <div className="border-l border-line-subtle px-3 py-4">
                  <p className="text-xs text-ink-muted">เซ็ตที่บันทึก</p>
                  <p className="mt-2 text-h3 tabular-nums">{summary.completedSetCount}</p>
                </div>
                <div className="border-l border-line-subtle py-4 pl-3">
                  <p className="text-xs text-ink-muted">เซ็ตทั้งหมด</p>
                  <p className="mt-2 text-h3 tabular-nums">{summary.totalSetCount}</p>
                </div>
              </div>
            </div>

            <aside className="col-span-4 mt-10 border-t border-line pt-5 tablet:col-span-3 tablet:mt-0 desktop:col-span-4">
              <p className="text-xs font-semibold tracking-[0.08em] text-ink-muted">SESSION CONTEXT</p>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-ink-muted">เริ่มเมื่อ</dt>
                  <dd className="mt-1 text-ink">{formatStartedAt(activeSession.startedAt)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">ประเภท</dt>
                  <dd className="mt-1 text-ink">{activeSession.sourceType === "PLANNED" ? "ตาม Routine" : "Ad-hoc"}</dd>
                </div>
                {activeSession.routineNameSnapshot ? (
                  <div>
                    <dt className="text-ink-muted">Routine</dt>
                    <dd className="mt-1 text-ink">{activeSession.routineNameSnapshot}</dd>
                  </div>
                ) : null}
              </dl>
            </aside>
          </section>
        );
      })() : null}

      {contentState === "planned-workout" && preview ? (
        <section className="page-grid" data-testid="today-planned-workout">
          <div className="col-span-4 min-w-0 tablet:col-span-5 desktop:col-span-8">
            <p className="text-xs font-semibold tracking-[0.08em] text-accent">NEXT WORKOUT</p>
            <h2 className="mt-3 text-h1 text-balance">{preview.template.name}</h2>
            <p className="mt-3 text-base leading-7 text-ink-secondary">
              {preview.week.routineName} · {preview.day.dayLabel}
            </p>
            <div className="mt-6 flex flex-col gap-2 tablet:flex-row tablet:flex-wrap">
              <Button
                variant="accent"
                size="large"
                disabled={Boolean(starting)}
                onClick={() => void startPlanned()}
              >
                {starting === "planned" ? "กำลังเริ่ม…" : "Start Workout"}
              </Button>
              <Button
                variant="secondary"
                size="large"
                disabled={Boolean(starting)}
                onClick={openAdHoc}
              >
                เลือก Ad-hoc Workout
              </Button>
            </div>
            <ActionError message={startError} />

            <div className="mt-8 grid grid-cols-3 border-t border-line">
              <div className="py-4 pr-3">
                <p className="text-xs text-ink-muted">Frequency</p>
                <p className="mt-2 text-h3 tabular-nums">{preview.week.frequencyActual}/{preview.week.frequencyTarget}</p>
              </div>
              <div className="border-l border-line-subtle px-3 py-4">
                <p className="text-xs text-ink-muted">Coverage</p>
                <p className="mt-2 text-h3 tabular-nums">{preview.week.coverageActual}/{preview.week.coverageTarget}</p>
              </div>
              <div className="border-l border-line-subtle py-4 pl-3">
                <p className="text-xs text-ink-muted">ท่าฝึก</p>
                <p className="mt-2 text-h3 tabular-nums">{preview.template.exercises.length}</p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-ink-muted">
              เมื่อเริ่ม ระบบจะเก็บแผนของวันนี้ไว้แยกจาก Template
            </p>

            <div className="mt-8">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-ink-muted">EXERCISE PREVIEW</p>
                  <h3 className="mt-2 text-h3">ท่าฝึกวันนี้</h3>
                </div>
              </div>
              <div className="tablet:hidden" data-testid="mobile-exercise-preview">
                <ExerciseRows
                  exercises={compactExercisePreview(preview.template.exercises, showAllExercises)}
                  previousValues={previousValues}
                />
                {preview.template.exercises.length > 4 ? (
                  <Button
                    variant="quiet"
                    fullWidth
                    className="mt-2"
                    aria-expanded={showAllExercises}
                    onClick={() => setShowAllExercises((current) => !current)}
                  >
                    {showAllExercises ? "ย่อรายการ" : `ดูทั้งหมด ${preview.template.exercises.length} ท่า`}
                  </Button>
                ) : null}
              </div>
              <div className="hidden tablet:block" data-testid="wide-exercise-preview">
                <ExerciseRows exercises={preview.template.exercises} previousValues={previousValues} />
              </div>
            </div>
          </div>

          <aside className="col-span-4 mt-10 border-t border-line pt-5 tablet:col-span-3 tablet:mt-0 desktop:col-span-4">
            <p className="text-xs font-semibold tracking-[0.08em] text-ink-muted">ROUTINE CONTEXT</p>
            <h3 className="mt-3 text-h3">{preview.week.routineName}</h3>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm tablet:grid-cols-1">
              <div>
                <dt className="text-ink-muted">วันที่กำลังจะฝึก</dt>
                <dd className="mt-1 text-xl font-semibold">{preview.day.dayLabel}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">เป้าหมายต่อสัปดาห์</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">{preview.week.frequencyActual}/{preview.week.frequencyTarget} ครั้ง</dd>
              </div>
            </dl>
            {dayGroups ? <div className="mt-6 space-y-5 border-t border-line pt-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-accent">RECOMMENDED</p>
                <div className="mt-2 grid gap-2">{dayGroups.recommended.map((day) => <button key={day.id} type="button" className={`min-h-11 border px-3 py-2 text-left text-sm ${preview.day.id === day.id ? "border-accent text-accent" : "border-line text-ink"}`} onClick={() => void selectRoutineDay(day)}>{day.dayLabel}<span className="block text-xs text-ink-muted">ยังไม่ครอบคลุมสัปดาห์นี้</span></button>)}</div>
                {dayGroups.recommended.length === 0 ? <p className="mt-2 text-sm text-success">Coverage ครบแล้ว คุณยังเลือกเล่นซ้ำได้</p> : null}
              </div>
              {dayGroups.repeat.length ? <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-ink-muted">REPEAT</p>
                <div className="mt-2 grid gap-2">{dayGroups.repeat.map((day) => <button key={day.id} type="button" className={`min-h-11 border px-3 py-2 text-left text-sm ${preview.day.id === day.id ? "border-accent text-accent" : "border-line text-ink"}`} onClick={() => void selectRoutineDay(day)}>{day.dayLabel}<span className="block text-xs text-ink-muted">เล่นแล้ว {day.completedCount} ครั้ง</span></button>)}</div>
              </div> : null}
            </div> : null}
            <Link
              to="/plans"
              className={buttonStyles({ variant: "secondary", fullWidth: true, className: "mt-6" })}
            >
              ดูและแก้ไข Plans
            </Link>
          </aside>
        </section>
      ) : null}

      {contentState === "no-routine" ? (
        <div data-testid="today-no-routine">
          <EmptyState
            marker="00"
            title="ยังไม่มี Active Routine"
            description="จัดการ Template และเปิดใช้งาน Routine เพื่อให้ Today แสดงแผนถัดไป หรือเริ่มการฝึกแบบอิสระสำหรับครั้งนี้"
            showTopRule={false}
            action={
              <div className="flex flex-col gap-2 tablet:flex-row">
                <Link to="/plans" className={buttonStyles({ size: "large" })}>จัดการ Routine</Link>
                <Button variant="secondary" size="large" onClick={openAdHoc}>เริ่ม Ad-hoc Workout</Button>
              </div>
            }
          />
        </div>
      ) : null}

      {adHocOpen && !activeSession ? (
        <AdHocWorkoutDialog
          templates={adHocTemplates}
          loading={adHocLoading}
          error={adHocError}
          busy={Boolean(starting)}
          onClose={closeAdHoc}
          onRetry={() => void loadAdHocTemplates()}
          onStart={(template) => void startAdHoc(template)}
        />
      ) : null}
    </PageFrame>
  );
}
