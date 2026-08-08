import { InMemoryExerciseRepository } from "./InMemoryExerciseRepository";
import { temporaryExercises } from "./temporaryExercises";

export const temporaryExerciseRepository = new InMemoryExerciseRepository(temporaryExercises);
