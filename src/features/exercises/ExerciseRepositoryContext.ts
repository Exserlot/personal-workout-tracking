import { createContext, useContext } from "react";
import type { ExerciseRepository } from "./data/ExerciseRepository";

export const ExerciseRepositoryContext = createContext<ExerciseRepository | null>(null);

export function useExerciseRepository() {
  const repository = useContext(ExerciseRepositoryContext);
  if (!repository) {
    throw new Error("ExerciseRepositoryProvider is required");
  }
  return repository;
}
