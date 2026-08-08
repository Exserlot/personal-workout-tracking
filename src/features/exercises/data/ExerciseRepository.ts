import type {
  Exercise,
  ExerciseDraft,
  ExerciseQuery,
} from "../domain/exercise";
import type { ExerciseValidationErrors } from "../domain/exerciseRules";

export type ExerciseRepositoryErrorCode =
  | "validation"
  | "not-found"
  | "read-only"
  | "archived"
  | "unknown";

export class ExerciseRepositoryError extends Error {
  constructor(
    public readonly code: ExerciseRepositoryErrorCode,
    message: string,
    public readonly fieldErrors: ExerciseValidationErrors = {},
  ) {
    super(message);
    this.name = "ExerciseRepositoryError";
  }
}

export interface ExerciseRepository {
  list(query: ExerciseQuery): Promise<Exercise[]>;
  getById(id: string): Promise<Exercise | null>;
  create(draft: ExerciseDraft): Promise<Exercise>;
  update(id: string, draft: ExerciseDraft): Promise<Exercise>;
  archive(id: string): Promise<Exercise>;
}

export function isExerciseRepositoryError(error: unknown): error is ExerciseRepositoryError {
  return error instanceof ExerciseRepositoryError;
}
