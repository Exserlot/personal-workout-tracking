import type {
  TemplateExercise,
  WorkoutTemplateSummary,
} from "../../planning/domain/planning";
import type {
  PreviousExerciseValues,
  WorkoutSession,
} from "./workout";

export type TodayContentState =
  | "initial-loading"
  | "terminal-pending"
  | "active-session"
  | "planned-workout"
  | "no-routine"
  | "fatal-error";

export function resolveTodayContentState({
  initialLoading,
  terminalSession,
  activeSession,
  preview,
  fatalError,
}: {
  initialLoading: boolean;
  terminalSession?: WorkoutSession | null;
  activeSession: WorkoutSession | null;
  preview: object | null;
  fatalError: boolean;
}): TodayContentState {
  if (terminalSession) return "terminal-pending";
  if (activeSession) return "active-session";
  if (initialLoading) return "initial-loading";
  if (preview) return "planned-workout";
  if (fatalError) return "fatal-error";
  return "no-routine";
}

export function summarizeActiveSession(session: WorkoutSession) {
  const sets = session.exercises.flatMap((exercise) => exercise.sets);
  return {
    exerciseCount: session.exercises.length,
    completedSetCount: sets.filter((set) => set.status === "COMPLETED").length,
    totalSetCount: sets.length,
  };
}

export function formatPreviousPerformance(previous?: PreviousExerciseValues) {
  if (!previous?.weight || previous.reps === null) return "ยังไม่มีข้อมูลครั้งก่อน";
  const effort = previous.effort
    ? ` · ${previous.effort.metric} ${previous.effort.value}`
    : "";
  return `ครั้งก่อน ${previous.weight.value} ${previous.weight.unit} × ${previous.reps}${effort}`;
}

export function compactExercisePreview(
  exercises: TemplateExercise[],
  expanded: boolean,
  limit = 4,
) {
  return expanded ? exercises : exercises.slice(0, limit);
}

export function eligibleAdHocTemplates(templates: WorkoutTemplateSummary[]) {
  return templates.filter(
    (template) =>
      !template.archivedAt &&
      template.exerciseCount > 0 &&
      template.setCount > 0,
  );
}

export function filterAdHocTemplates(
  templates: WorkoutTemplateSummary[],
  search: string,
) {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return templates;
  return templates.filter((template) =>
    template.name.toLocaleLowerCase().includes(term),
  );
}
