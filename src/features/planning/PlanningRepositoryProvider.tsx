import type { ReactNode } from "react";
import { PlanningRepositoryContext } from "./PlanningRepositoryContext";
import type { PlanningRepository } from "./data/PlanningRepository";

export function PlanningRepositoryProvider({ repository, children }: { repository: PlanningRepository; children: ReactNode }) {
  return <PlanningRepositoryContext.Provider value={repository}>{children}</PlanningRepositoryContext.Provider>;
}
