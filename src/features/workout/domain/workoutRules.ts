import { kgFromWeight, type EffortMetric, type EffortValue, type SessionSet, type WeightUnit, type WeightValue } from "./workout";

export interface SetDraftValue {
  weight: string;
  weightUnit: WeightUnit;
  reps: string;
  effortMetric: EffortMetric | "";
  effort: string;
}

export type SetDraftErrors = Partial<Record<"weight" | "reps" | "effort", string>>;

export function validateSetDraft(draft: SetDraftValue): SetDraftErrors {
  const errors: SetDraftErrors = {};
  const weight = Number(draft.weight.trim());
  const reps = Number(draft.reps.trim());
  const effort = draft.effort.trim() === "" ? null : Number(draft.effort);
  if (!draft.weight.trim() || !Number.isFinite(weight) || weight < 0) errors.weight = "กรอกน้ำหนักตั้งแต่ 0 ขึ้นไป";
  if (!/^\d+$/.test(draft.reps.trim()) || reps < 1) errors.reps = "Reps ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป";
  if (effort !== null) {
    if (!draft.effortMetric) errors.effort = "เลือก RPE หรือ RIR ก่อน";
    else if (draft.effortMetric === "RPE" && (effort < 1 || effort > 10 || !Number.isInteger(effort * 2))) errors.effort = "RPE อยู่ระหว่าง 1–10 เพิ่มทีละ 0.5";
    else if (draft.effortMetric === "RIR" && (effort < 0 || effort > 10 || !Number.isInteger(effort))) errors.effort = "RIR อยู่ระหว่าง 0–10 เป็นจำนวนเต็ม";
  }
  return errors;
}

export function draftFromSet(
  set: SessionSet,
  fallback?: { weight: WeightValue | null; reps: number | null; effort: EffortValue | null },
  options?: { defaultWeight?: WeightValue },
): SetDraftValue {
  const weight = set.actualWeight ?? set.targetWeight ?? fallback?.weight ?? options?.defaultWeight;
  const reps = set.actualReps ?? set.targetRepsMin ?? fallback?.reps;
  const effort = set.actualEffort ?? set.targetEffort ?? fallback?.effort;
  return {
    weight: weight ? String(weight.value) : "",
    weightUnit: weight?.unit ?? "KG",
    reps: reps === null || reps === undefined ? "" : String(reps),
    effortMetric: effort?.metric ?? "",
    effort: effort ? String(effort.value) : "",
  };
}

export function commandValues(draft: SetDraftValue): { actualWeight: WeightValue; actualReps: number; actualEffort: EffortValue | null } {
  const errors = validateSetDraft(draft);
  if (Object.keys(errors).length > 0) throw new Error("Invalid set draft");
  const value = Number(draft.weight);
  const effort = draft.effort.trim() === "" ? null : { metric: draft.effortMetric as EffortMetric, value: Number(draft.effort) };
  return {
    actualWeight: { value, unit: draft.weightUnit, kg: kgFromWeight(value, draft.weightUnit) },
    actualReps: Number(draft.reps),
    actualEffort: effort,
  };
}

export function defaultAddedSetDraft(set: SessionSet, lastCompleted?: SessionSet): SetDraftValue {
  const base = draftFromSet(set);
  const previousWeight = lastCompleted?.actualWeight;
  const previousEffort = lastCompleted?.actualEffort;
  return {
    weight: previousWeight ? String(previousWeight.value) : base.weight,
    weightUnit: previousWeight?.unit ?? base.weightUnit,
    reps: lastCompleted?.actualReps ? String(lastCompleted.actualReps) : base.reps,
    effortMetric: previousEffort?.metric ?? base.effortMetric,
    effort: previousEffort ? String(previousEffort.value) : base.effort,
  };
}

export function remainingTimerSeconds(timer: { status: "idle" | "running" | "paused"; endsAt: number | null; pausedRemainingSeconds: number }, now = Date.now()) {
  if (timer.status === "paused") return Math.max(0, timer.pausedRemainingSeconds);
  if (timer.status !== "running" || timer.endsAt === null) return 0;
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

export function timerAfterComplete(durationSeconds: number, now = Date.now()) {
  return { status: "running" as const, durationSeconds, endsAt: now + durationSeconds * 1000, pausedRemainingSeconds: durationSeconds };
}

export function pauseTimer(timer: { status: "idle" | "running" | "paused"; durationSeconds: number; endsAt: number | null; pausedRemainingSeconds: number }, now = Date.now()) {
  if (timer.status !== "running") return timer;
  return { ...timer, status: "paused" as const, endsAt: null, pausedRemainingSeconds: remainingTimerSeconds(timer, now) };
}

export function resetTimer(timer: { status: "idle" | "running" | "paused"; durationSeconds: number; endsAt: number | null; pausedRemainingSeconds: number }, now = Date.now()) {
  return timerAfterComplete(timer.durationSeconds, now);
}

export function skipTimer(timer: { status: "idle" | "running" | "paused"; durationSeconds: number; endsAt: number | null; pausedRemainingSeconds: number }) {
  return { ...timer, status: "idle" as const, endsAt: null, pausedRemainingSeconds: 0 };
}

export function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}
