import type { ReactNode } from "react";
import { WorkoutRepositoryContext } from "./WorkoutRepositoryContext";
import type { WorkoutRepository } from "./domain/workout";

export function WorkoutRepositoryProvider({ repository, children }: { repository: WorkoutRepository; children: ReactNode }) {
  return <WorkoutRepositoryContext.Provider value={repository}>{children}</WorkoutRepositoryContext.Provider>;
}
