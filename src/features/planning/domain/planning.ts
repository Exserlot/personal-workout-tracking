export type EffortMetric = "RPE" | "RIR";
export type WeightUnit = "KG" | "LB";
export type SetKind = "WARM_UP" | "WORKING" | "DROP";

export interface SetPrescription {
  id: string;
  sequence: number;
  kind: SetKind;
  isToFailure: boolean;
  repsMin: number;
  repsMax: number;
  targetWeightValue: number | null;
  targetWeightUnit: WeightUnit | null;
  targetWeightKg: number | null;
  targetEffortMetric: EffortMetric | null;
  targetEffortValue: number | null;
  restSeconds: number;
}

export interface TemplateExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseArchivedAt: string | null;
  sequence: number;
  notes: string;
  prescriptions: SetPrescription[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  notes: string;
  revision: number;
  archivedAt: string | null;
  exercises: TemplateExercise[];
}

export interface WorkoutTemplateSummary {
  id: string;
  name: string;
  notes: string;
  revision: number;
  archivedAt: string | null;
  exerciseCount: number;
  setCount: number;
}

export interface GroupedExerciseTargetDraft {
  clientId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseArchivedAt: string | null;
  notes: string;
  setCount: number;
  repsMin: number;
  repsMax: number;
  targetWeightValue: number | null;
  targetWeightUnit: WeightUnit;
  targetEffortMetric: EffortMetric | null;
  targetEffortValue: number | null;
  restSeconds: number;
}

export interface WorkoutTemplateDraft {
  name: string;
  notes: string;
  exercises: GroupedExerciseTargetDraft[];
}

export interface RoutineDay {
  id: string;
  templateId: string;
  templateName: string;
  templateArchivedAt: string | null;
  sequence: number;
  label: string;
  notes: string;
}

export interface Routine {
  id: string;
  name: string;
  weeklyFrequencyTarget: number;
  nextWorkoutIndex: number;
  isActive: boolean;
  revision: number;
  archivedAt: string | null;
  days: RoutineDay[];
}

export interface RoutineSummary extends Omit<Routine, "days"> {
  days: RoutineDay[];
}

export interface RoutineDayDraft {
  clientId: string;
  templateId: string;
  templateName: string;
  templateArchivedAt: string | null;
  label: string;
  notes: string;
}

export interface RoutineDraft {
  name: string;
  weeklyFrequencyTarget: number;
  days: RoutineDayDraft[];
}

export interface ActiveRoutinePreview {
  routineId: string;
  routineRevision: number;
  routineDayId: string;
  routineName: string;
  weeklyFrequencyTarget: number;
  nextWorkoutIndex: number;
  dayCount: number;
  dayLabel: string;
  template: WorkoutTemplate;
}
