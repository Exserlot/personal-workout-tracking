import { createContext, useContext } from "react";
import type { WorkoutRepository } from "./domain/workout";

export const WorkoutRepositoryContext = createContext<WorkoutRepository | null>(null);

export function useWorkoutRepository() {
  const repository = useContext(WorkoutRepositoryContext);
  if (!repository) throw new Error("WorkoutRepositoryProvider is missing");
  return repository;
}
