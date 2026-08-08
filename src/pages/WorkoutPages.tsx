import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/icons/Icon";
import { Button } from "../components/ui/Button";
import { buttonStyles } from "../components/ui/buttonStyles";
import { Divider } from "../components/ui/Divider";
import { PageFrame } from "../components/layout/PageFrame";
import { StatBlock } from "../components/ui/StatBlock";
import { RestTimer } from "../features/workout/components/RestTimer";
import { WorkoutSetRow } from "../features/workout/components/WorkoutSetRow";
import {
  appendSet,
  completeSet,
  createInitialActiveWorkoutState,
  editCompletedSet,
  remainingRestSeconds,
  resetRestTimer,
  skipRestTimer,
  updateSetDraft,
  type ActiveWorkoutState,
  type SetField,
  type SetValidationErrors,
} from "../features/workout/domain/setLogging";
import { loadActiveWorkout, saveActiveWorkout } from "../features/workout/data/activeWorkoutStore";
import { useKeyboardInset } from "../features/workout/useKeyboardInset";

type HydrationStatus = "loading" | "ready" | "error";

function SessionIndex({ state }: { state: ActiveWorkoutState }) {
  return (
    <aside className="hidden desktop:col-span-3 desktop:block">
      <p className="text-xs font-semibold tracking-[0.06em] text-ink-muted">SESSION INDEX</p>
      <ol className="mt-4 border-t border-line">
        {[state.exerciseName, "Incline Dumbbell Press", "Overhead Press", "Cable Fly"].map((name, index) => (
          <li key={name} className={`border-b border-line-subtle py-3 text-sm ${index === 0 ? "text-accent" : "text-ink-secondary"}`}>
            <span className="mr-3 text-xs tabular-nums">0{index + 1}</span>{name}
          </li>
        ))}
      </ol>
    </aside>
  );
}

function ActiveWorkoutLoading() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-content bg-canvas px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-8 large:px-12" role="status">
      <div className="h-6 w-36 bg-interactive motion-safe:animate-pulse" />
      <div className="mt-8 h-10 max-w-md bg-interactive motion-safe:animate-pulse" />
      <div className="mt-8 h-48 max-w-3xl bg-interactive motion-safe:animate-pulse" />
      <span className="sr-only">กำลังโหลด Active Workout</span>
    </div>
  );
}

function ActiveWorkoutError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-content items-start px-4 py-10 tablet:px-6 desktop:px-8 large:px-12">
      <section role="alert" className="w-full border-t-2 border-error pt-5">
        <p className="text-xs font-semibold tracking-[0.08em] text-error">STORAGE ERROR</p>
        <h1 className="mt-3 text-h2">เปิด Active Workout ไม่ได้</h1>
        <p className="mt-3 max-w-xl leading-7 text-ink-secondary">
          อุปกรณ์นี้ไม่สามารถอ่าน session จาก IndexedDB ได้ ข้อมูลในหน้านี้ยังไม่ถูกลบ กรุณาลองอีกครั้ง
        </p>
        <Button variant="secondary" className="mt-6" onClick={onRetry}>ลองอีกครั้ง</Button>
      </section>
    </div>
  );
}

export function ActiveWorkoutPage() {
  const [state, setState] = useState<ActiveWorkoutState>(() => createInitialActiveWorkoutState());
  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>("loading");
  const [storageError, setStorageError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, SetValidationErrors>>({});
  const [clock, setClock] = useState(() => Date.now());
  const stateRef = useRef(state);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const keyboardInset = useKeyboardInset();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let active = true;
    setHydrationStatus("loading");
    setStorageError("");
    loadActiveWorkout().then(
      (stored) => {
        if (!active) return;
        const next = stored ?? createInitialActiveWorkoutState();
        stateRef.current = next;
        setState(next);
        setHydrationStatus("ready");
      },
      () => {
        if (!active) return;
        setStorageError("เปิด IndexedDB ไม่สำเร็จ");
        setHydrationStatus("error");
      },
    );
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (hydrationStatus !== "ready") return;
    saveActiveWorkout(state).catch(() => setStorageError("บันทึก local session ไม่สำเร็จ ลองอีกครั้งหรือเปิดพื้นที่จัดเก็บของ browser"));
  }, [hydrationStatus, state]);

  useEffect(() => {
    if (state.restTimer.status !== "running") return;
    const interval = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [state.restTimer.endsAt, state.restTimer.status]);

  const setStateAndRef = useCallback((next: ActiveWorkoutState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  function handleSetChange(setId: string, field: SetField, value: string) {
    setFieldErrors((current) => ({ ...current, [setId]: { ...current[setId], [field]: undefined } }));
    setStateAndRef(updateSetDraft(stateRef.current, setId, { [field]: value }));
  }

  function saveSet(setId: string) {
    const current = stateRef.current;
    const target = current.sets.find((set) => set.id === setId);
    if (!target) return;
    const result = target.status === "completed" ? editCompletedSet(current, setId) : completeSet(current, setId);
    if (Object.keys(result.errors).length > 0) {
      setFieldErrors((errors) => ({ ...errors, [setId]: result.errors }));
      const firstInvalidField = Object.keys(result.errors)[0] as SetField | undefined;
      if (firstInvalidField) window.setTimeout(() => inputRefs.current[`${setId}-${firstInvalidField}`]?.focus(), 0);
      return;
    }
    setFieldErrors((errors) => {
      const next = { ...errors };
      delete next[setId];
      return next;
    });
    setStateAndRef(result.state);
    setClock(Date.now());
  }

  function addSet() {
    setStateAndRef(appendSet(stateRef.current));
  }

  function registerInput(setId: string, field: SetField, element: HTMLInputElement | null) {
    inputRefs.current[`${setId}-${field}`] = element;
  }

  const currentPendingSet = state.sets.find((set) => set.status === "pending");
  const remainingSeconds = remainingRestSeconds(state, clock);
  const style = { "--keyboard-inset": `${keyboardInset}px` } as CSSProperties;

  if (hydrationStatus === "loading") return <ActiveWorkoutLoading />;
  if (hydrationStatus === "error") return <ActiveWorkoutError onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />;

  return (
    <div
      data-testid="active-workout"
      style={style}
      className="min-h-dvh bg-canvas pb-[calc(112px+env(safe-area-inset-bottom)+var(--keyboard-inset))] text-ink tablet:pb-8"
    >
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-canvas px-4 tablet:static tablet:mx-auto tablet:max-w-content tablet:px-0 desktop:px-8 large:px-12">
        <Link to="/today" className="flex h-11 w-11 items-center justify-center text-ink-secondary hover:text-ink" aria-label="ออกจาก Active Workout">
          <Icon name="close" />
        </Link>
        <p className="text-xs font-semibold tracking-[0.08em] tabular-nums">01 / 04</p>
        <Button variant="quiet" className="h-11 w-11 px-0" aria-label="ตัวเลือกเพิ่มเติม">
          <Icon name="menu" />
        </Button>
      </header>

      <div className="page-grid mx-auto max-w-content px-4 pt-6 tablet:px-6 tablet:pt-8 desktop:px-8 large:px-12">
        <SessionIndex state={state} />

        <section className="col-span-4 min-w-0 tablet:col-span-6 desktop:col-span-6 desktop:px-5" aria-labelledby="active-workout-title">
          <p className="text-xs font-semibold tracking-[0.06em] text-accent">P-07 · ACTIVE SESSION</p>
          <h1 id="active-workout-title" className="mt-4 text-[30px] font-bold leading-9 tracking-[-0.025em] tablet:text-h1">{state.exerciseName}</h1>
          <p className="mt-2 text-sm text-ink-muted">{state.muscleLabel} · {state.equipmentLabel} · Working sets</p>
          {storageError ? (
            <p role="status" className="mt-4 border-l-2 border-warning pl-3 text-sm leading-6 text-warning">{storageError}</p>
          ) : null}

          <section aria-labelledby="previous-session-heading" className="mt-6 border border-line bg-surface p-4">
            <p id="previous-session-heading" className="text-xs font-semibold text-ink-muted">ครั้งก่อน</p>
            <p className="mt-2 text-base font-semibold tabular-nums">
              {state.previousSession.weight} KG × {state.previousSession.reps} REPS @ RPE {state.previousSession.rpe}
            </p>
            <p className="mt-1 text-sm text-ink-secondary">ค่าก่อนหน้าใช้เป็นค่าเริ่มต้นสำหรับเซ็ตใหม่</p>
          </section>

          <section aria-labelledby="set-log-heading" className="mt-6">
            <div className="flex items-end justify-between gap-3 border-b border-line pb-2">
              <div>
                <p className="text-xs font-semibold tracking-[0.06em] text-ink-muted">SET LOG</p>
                <h2 id="set-log-heading" className="mt-2 text-h3">บันทึกเซ็ต</h2>
              </div>
              <p className="text-sm tabular-nums text-ink-muted">{state.sets.filter((set) => set.status === "completed").length} / {state.sets.length} เสร็จแล้ว</p>
            </div>

            <div className="mt-3 grid grid-cols-[2.25rem_repeat(3,minmax(0,1fr))] gap-2 text-center text-[10px] font-semibold tracking-[0.04em] text-ink-muted tablet:grid-cols-[2.5rem_repeat(3,minmax(0,1fr))_8rem] tablet:gap-3">
              <span>SET</span><span>KG</span><span>REPS</span><span>RPE</span><span className="col-span-4 tablet:col-span-1">STATUS</span>
            </div>

            <div>
              {state.sets.map((set) => (
                <WorkoutSetRow
                  key={set.id}
                  set={set}
                  errors={fieldErrors[set.id] ?? {}}
                  onChange={(field, value) => handleSetChange(set.id, field, value)}
                  onSave={() => saveSet(set.id)}
                  onRegisterInput={(field, element) => registerInput(set.id, field, element)}
                />
              ))}
            </div>

            <Button variant="secondary" className="mt-4 w-full tablet:w-auto" onClick={addSet}>
              + เพิ่ม Set
            </Button>
          </section>
        </section>

        <aside className="col-span-4 mt-8 min-w-0 border-t border-line pt-5 tablet:col-span-2 tablet:mt-0 tablet:border-l tablet:border-t-0 tablet:pl-5 desktop:col-span-3">
          <RestTimer
            timer={state.restTimer}
            remainingSeconds={remainingSeconds}
            onSkip={() => setStateAndRef(skipRestTimer(stateRef.current))}
            onReset={() => setStateAndRef(resetRestTimer(stateRef.current))}
          />
          <Divider className="my-5" />
          <p className="text-sm leading-6 text-ink-secondary">ข้อมูลจะถูกเก็บในเครื่องนี้ก่อน เพื่อให้บันทึกต่อได้แม้ network ไม่เสถียร</p>
        </aside>
      </div>

      <div
        className="safe-bottom fixed inset-x-0 bottom-[var(--keyboard-inset)] z-30 border-t border-line bg-canvas p-4 tablet:static tablet:mx-auto tablet:mt-8 tablet:max-w-content tablet:border-t-0 tablet:bg-transparent tablet:p-0 tablet:px-6 desktop:px-8 large:px-12"
      >
        <div className="mx-auto flex max-w-content gap-3 tablet:justify-end">
          <Button
            variant="accent"
            size="large"
            fullWidth
            className="tablet:w-auto tablet:min-w-56"
            data-testid="primary-set-action"
            onClick={() => (currentPendingSet ? saveSet(currentPendingSet.id) : addSet())}
          >
            {currentPendingSet ? "Complete Set" : "เพิ่ม Set"}
            {currentPendingSet ? <Icon name="check" /> : null}
          </Button>
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
