import type {
  GroupedExerciseTargetDraft,
  RoutineDraft,
  Routine,
  WorkoutTemplateDraft,
  WorkoutTemplateSummary,
} from "./planning";

export type PlanningActionKey = "create-template" | "create-routine" | "activate-routine";

export interface PlanningAction {
  key: PlanningActionKey;
  label: string;
  variant: "primary" | "secondary";
  target?: "templates" | "routines";
}

export interface PlanningValidationErrors {
  name?: string;
  weeklyFrequencyTarget?: string;
  days?: string;
  exercises?: string;
  exerciseErrors?: Record<string, string[]>;
}

export function expandGroupedTarget(target: GroupedExerciseTargetDraft) {
  return Array.from({ length: Math.max(0, target.setCount) }, (_, index) => ({
    sequence_no: index + 1,
    set_kind_code: "WORKING",
    is_to_failure: false,
    target_reps_min: target.repsMin,
    target_reps_max: target.repsMax,
    target_weight_value: target.targetWeightValue,
    target_weight_unit: target.targetWeightValue === null ? null : target.targetWeightUnit,
    target_effort_metric: target.targetEffortMetric,
    target_effort_value: target.targetEffortMetric === null ? null : target.targetEffortValue,
    target_rest_seconds: target.restSeconds,
  }));
}

export function validateWorkoutTemplateDraft(draft: WorkoutTemplateDraft): PlanningValidationErrors {
  const errors: PlanningValidationErrors = {};
  if (!draft.name.trim()) errors.name = "กรอกชื่อ Workout Template";
  if (draft.name.trim().length > 160) errors.name = "ชื่อ Template ต้องไม่เกิน 160 ตัวอักษร";

  const exerciseErrors: Record<string, string[]> = {};
  for (const exercise of draft.exercises) {
    const current: string[] = [];
    if (!exercise.exerciseId) current.push("เลือก Exercise");
    if (!Number.isInteger(exercise.setCount) || exercise.setCount < 1) current.push("จำนวนเซ็ตต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป");
    if (!Number.isInteger(exercise.repsMin) || exercise.repsMin < 1) current.push("Reps ต่ำสุดต้องเป็นจำนวนเต็มบวก");
    if (!Number.isInteger(exercise.repsMax) || exercise.repsMax < exercise.repsMin) current.push("Reps สูงสุดต้องไม่น้อยกว่าค่าต่ำสุด");
    if (exercise.targetWeightValue !== null && (!Number.isFinite(exercise.targetWeightValue) || exercise.targetWeightValue < 0)) current.push("น้ำหนักต้องเป็น 0 หรือมากกว่า");
    if (!Number.isInteger(exercise.restSeconds) || exercise.restSeconds < 0) current.push("เวลาพักต้องเป็นจำนวนเต็มตั้งแต่ 0 วินาที");
    if (exercise.targetEffortMetric === "RPE") {
      const value = exercise.targetEffortValue;
      if (value === null || value < 1 || value > 10 || Math.abs(value * 2 - Math.round(value * 2)) > 0.000001) current.push("RPE ต้องอยู่ระหว่าง 1–10 และเพิ่มครั้งละ 0.5");
    }
    if (exercise.targetEffortMetric === "RIR") {
      const value = exercise.targetEffortValue;
      if (value === null || !Number.isInteger(value) || value < 0 || value > 10) current.push("RIR ต้องเป็นจำนวนเต็มระหว่าง 0–10");
    }
    if (current.length > 0) exerciseErrors[exercise.clientId] = current;
  }
  if (Object.keys(exerciseErrors).length > 0) errors.exerciseErrors = exerciseErrors;
  return errors;
}

export function validateRoutineDraft(draft: RoutineDraft): PlanningValidationErrors {
  const errors: PlanningValidationErrors = {};
  if (!draft.name.trim()) errors.name = "กรอกชื่อ Routine";
  if (!Number.isInteger(draft.weeklyFrequencyTarget) || draft.weeklyFrequencyTarget < 1 || draft.weeklyFrequencyTarget > 7) {
    errors.weeklyFrequencyTarget = "เป้าหมายต้องเป็นจำนวนเต็ม 1–7 ครั้งต่อสัปดาห์";
  }
  if (draft.days.length === 0) errors.days = "Routine ต้องมี Template อย่างน้อยหนึ่งวัน";
  if (draft.days.some((day) => !day.templateId || day.templateArchivedAt)) errors.days = "Routine มี Template ที่ใช้ไม่ได้หรือถูก Archive";
  return errors;
}

export function hasPlanningValidationErrors(errors: PlanningValidationErrors) {
  return Object.keys(errors).length > 0;
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function clampNextWorkoutIndex(index: number, dayCount: number) {
  if (dayCount <= 0) return 0;
  return Math.min(Math.max(0, index), dayCount - 1);
}

export function eligibleTemplates(templates: WorkoutTemplateSummary[]) {
  return templates.filter((template) => !template.archivedAt && template.exerciseCount > 0 && template.setCount > 0);
}

export function otherRoutines(routines: Routine[]) {
  return routines.filter((routine) => !routine.isActive && !routine.archivedAt);
}

export function plansPageActions(
  templates: WorkoutTemplateSummary[],
  routines: Routine[],
): PlanningAction[] {
  const hasEligibleTemplate = eligibleTemplates(templates).length > 0;
  const active = routines.some((routine) => routine.isActive);
  const hasSavedRoutine = routines.some((routine) => !routine.archivedAt);
  if (!hasEligibleTemplate) return [{ key: "create-template", label: "สร้าง Template", variant: "primary" }];
  if (!active && hasSavedRoutine) {
    return [
      { key: "activate-routine", label: "เลือก Routine เพื่อเปิดใช้งาน", variant: "primary", target: "routines" },
      { key: "create-routine", label: "สร้าง Routine", variant: "secondary" },
    ];
  }
  if (!active) {
    return [
      { key: "create-routine", label: "สร้าง Routine", variant: "primary" },
      { key: "create-template", label: "สร้าง Template", variant: "secondary" },
    ];
  }
  return [
    { key: "create-template", label: "สร้าง Template", variant: "primary" },
    { key: "create-routine", label: "สร้าง Routine", variant: "secondary" },
  ];
}
