import type { ReactNode } from "react";
import type { ExerciseRepository } from "./data/ExerciseRepository";
import { ExerciseRepositoryContext } from "./ExerciseRepositoryContext";

export function ExerciseRepositoryProvider({
  repository,
  children,
}: {
  repository: ExerciseRepository;
  children: ReactNode;
}) {
  return (
    <ExerciseRepositoryContext.Provider value={repository}>
      {children}
    </ExerciseRepositoryContext.Provider>
  );
}
