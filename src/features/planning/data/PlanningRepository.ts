import type {
  ActiveRoutinePreview,
  Routine,
  RoutineDraft,
  WorkoutTemplate,
  WorkoutTemplateDraft,
  WorkoutTemplateSummary,
} from "../domain/planning";
import type { PlanningValidationErrors } from "../domain/planningRules";

export type PlanningRepositoryErrorCode = "validation" | "not-found" | "conflict" | "referenced" | "offline" | "unknown";

export class PlanningRepositoryError extends Error {
  constructor(
    public readonly code: PlanningRepositoryErrorCode,
    message: string,
    public readonly fieldErrors: PlanningValidationErrors = {},
  ) {
    super(message);
    this.name = "PlanningRepositoryError";
  }
}

export interface PlanningRepository {
  listTemplates(includeArchived?: boolean): Promise<WorkoutTemplateSummary[]>;
  getTemplate(id: string): Promise<WorkoutTemplate | null>;
  createTemplate(draft: WorkoutTemplateDraft): Promise<WorkoutTemplate>;
  updateTemplate(id: string, expectedRevision: number, draft: WorkoutTemplateDraft): Promise<WorkoutTemplate>;
  duplicateTemplate(id: string): Promise<WorkoutTemplate>;
  archiveTemplate(id: string, expectedRevision: number): Promise<void>;
  listRoutines(includeArchived?: boolean): Promise<Routine[]>;
  getRoutine(id: string): Promise<Routine | null>;
  createRoutine(draft: RoutineDraft): Promise<Routine>;
  updateRoutine(id: string, expectedRevision: number, draft: RoutineDraft): Promise<Routine>;
  activateRoutine(id: string, expectedRevision: number): Promise<Routine>;
  deactivateRoutine(id: string, expectedRevision: number): Promise<Routine>;
  archiveRoutine(id: string, expectedRevision: number): Promise<void>;
  getActiveRoutinePreview(): Promise<ActiveRoutinePreview | null>;
}
