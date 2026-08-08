export type WorkoutSetStatus = "pending" | "completed";

export interface SetValues {
  weight: string;
  reps: string;
  rpe: string;
}

export type PreviousSessionValues = SetValues;

export interface WorkoutSet extends SetValues {
  id: string;
  setNumber: number;
  status: WorkoutSetStatus;
  completedAt: number | null;
}

export interface RestTimerState {
  status: "idle" | "running";
  durationSeconds: number;
  endsAt: number | null;
}

export interface ActiveWorkoutState {
  id: string;
  exerciseName: string;
  muscleLabel: string;
  equipmentLabel: string;
  previousSession: PreviousSessionValues;
  sets: WorkoutSet[];
  restTimer: RestTimerState;
  updatedAt: number;
}

export type SetField = keyof SetValues;
export type SetValidationErrors = Partial<Record<SetField, string>>;

export interface SetTransitionResult {
  state: ActiveWorkoutState;
  errors: SetValidationErrors;
}

const DEFAULT_REST_SECONDS = 90;

function defaultSet(id: string, setNumber: number, values: SetValues): WorkoutSet {
  return {
    id,
    setNumber,
    ...values,
    status: "pending",
    completedAt: null,
  };
}

function cloneValues(values: SetValues): SetValues {
  return { weight: values.weight, reps: values.reps, rpe: values.rpe };
}

export function createInitialActiveWorkoutState(now = Date.now()): ActiveWorkoutState {
  const previousSession: PreviousSessionValues = {
    weight: "70",
    reps: "8",
    rpe: "8",
  };

  return {
    id: "temporary-active-session",
    exerciseName: "Barbell Bench Press",
    muscleLabel: "Chest",
    equipmentLabel: "Barbell",
    previousSession,
    sets: [
      defaultSet("set-1", 1, previousSession),
    ],
    restTimer: {
      status: "idle",
      durationSeconds: DEFAULT_REST_SECONDS,
      endsAt: null,
    },
    updatedAt: now,
  };
}

export function validateSet(values: SetValues): SetValidationErrors {
  const errors: SetValidationErrors = {};
  const weight = values.weight.trim();
  const reps = values.reps.trim();
  const rpe = values.rpe.trim();

  if (!weight) {
    errors.weight = "กรอกน้ำหนักก่อน Complete Set";
  } else if (!Number.isFinite(Number(weight)) || Number(weight) < 0) {
    errors.weight = "น้ำหนักต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป";
  }

  if (!reps) {
    errors.reps = "กรอกจำนวนครั้งก่อน Complete Set";
  } else if (!/^\d+$/.test(reps) || Number(reps) < 1) {
    errors.reps = "Reps ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป";
  }

  if (!rpe) {
    errors.rpe = "กรอก RPE ก่อน Complete Set";
  } else if (
    !Number.isFinite(Number(rpe)) ||
    Number(rpe) < 1 ||
    Number(rpe) > 10 ||
    Math.abs(Number(rpe) * 2 - Math.round(Number(rpe) * 2)) > 0.000001
  ) {
    errors.rpe = "RPE ต้องอยู่ระหว่าง 1–10 และเพิ่มครั้งละ 0.5";
  }

  return errors;
}

export function updateSetDraft(
  state: ActiveWorkoutState,
  setId: string,
  patch: Partial<SetValues>,
  now = Date.now(),
): ActiveWorkoutState {
  return {
    ...state,
    sets: state.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
    updatedAt: now,
  };
}

export function startRestTimer(
  state: ActiveWorkoutState,
  now = Date.now(),
): ActiveWorkoutState {
  return {
    ...state,
    restTimer: {
      ...state.restTimer,
      status: "running",
      endsAt: now + state.restTimer.durationSeconds * 1000,
    },
    updatedAt: now,
  };
}

export function skipRestTimer(state: ActiveWorkoutState, now = Date.now()): ActiveWorkoutState {
  return {
    ...state,
    restTimer: { ...state.restTimer, status: "idle", endsAt: null },
    updatedAt: now,
  };
}

export function resetRestTimer(state: ActiveWorkoutState, now = Date.now()): ActiveWorkoutState {
  return startRestTimer(
    {
      ...state,
      restTimer: { ...state.restTimer, status: "running" },
    },
    now,
  );
}

export function completeSet(
  state: ActiveWorkoutState,
  setId: string,
  now = Date.now(),
): SetTransitionResult {
  const set = state.sets.find((candidate) => candidate.id === setId);
  if (!set) return { state, errors: {} };

  const errors = validateSet(set);
  if (Object.keys(errors).length > 0) return { state, errors };

  const nextState: ActiveWorkoutState = {
    ...state,
    sets: state.sets.map((candidate) =>
      candidate.id === setId
        ? { ...candidate, status: "completed", completedAt: candidate.completedAt ?? now }
        : candidate,
    ),
    updatedAt: now,
  };

  return {
    state: set.status === "completed" ? nextState : startRestTimer(nextState, now),
    errors: {},
  };
}

export function editCompletedSet(
  state: ActiveWorkoutState,
  setId: string,
  now = Date.now(),
): SetTransitionResult {
  const set = state.sets.find((candidate) => candidate.id === setId);
  if (!set || set.status !== "completed") return { state, errors: {} };

  const errors = validateSet(set);
  if (Object.keys(errors).length > 0) return { state, errors };

  return {
    state: {
      ...state,
      updatedAt: now,
    },
    errors: {},
  };
}

export function appendSet(state: ActiveWorkoutState, now = Date.now()): ActiveWorkoutState {
  const lastCompleted = [...state.sets].reverse().find((set) => set.status === "completed");
  const defaults = cloneValues(lastCompleted ?? state.previousSession);
  const nextNumber = state.sets.reduce((max, set) => Math.max(max, set.setNumber), 0) + 1;

  return {
    ...state,
    sets: [...state.sets, defaultSet(`set-${nextNumber}`, nextNumber, defaults)],
    updatedAt: now,
  };
}

export function remainingRestSeconds(state: ActiveWorkoutState, now = Date.now()) {
  if (state.restTimer.status !== "running" || state.restTimer.endsAt === null) return 0;
  return Math.max(0, Math.ceil((state.restTimer.endsAt - now) / 1000));
}

export function hydrateActiveWorkoutState(value: unknown): ActiveWorkoutState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ActiveWorkoutState>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.exerciseName !== "string" ||
    !candidate.previousSession ||
    !Array.isArray(candidate.sets) ||
    !candidate.restTimer
  ) {
    return null;
  }

  const sets = candidate.sets.filter((set): set is WorkoutSet => {
    if (!set || typeof set !== "object") return false;
    const current = set as Partial<WorkoutSet>;
    return (
      typeof current.id === "string" &&
      typeof current.setNumber === "number" &&
      typeof current.weight === "string" &&
      typeof current.reps === "string" &&
      typeof current.rpe === "string" &&
      (current.status === "pending" || current.status === "completed")
    );
  });
  if (sets.length === 0) return null;

  const timer = candidate.restTimer as Partial<RestTimerState>;
  return {
    id: candidate.id,
    exerciseName: candidate.exerciseName,
    muscleLabel: candidate.muscleLabel ?? "",
    equipmentLabel: candidate.equipmentLabel ?? "",
    previousSession: {
      weight: candidate.previousSession.weight ?? "",
      reps: candidate.previousSession.reps ?? "",
      rpe: candidate.previousSession.rpe ?? "",
    },
    sets: sets.map((set) => ({ ...set })),
    restTimer: {
      status: timer.status === "running" ? "running" : "idle",
      durationSeconds: typeof timer.durationSeconds === "number" ? timer.durationSeconds : DEFAULT_REST_SECONDS,
      endsAt: typeof timer.endsAt === "number" ? timer.endsAt : null,
    },
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
  };
}
