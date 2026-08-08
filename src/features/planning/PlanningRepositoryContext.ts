import { createContext, useContext } from "react";
import type { PlanningRepository } from "./data/PlanningRepository";

export const PlanningRepositoryContext = createContext<PlanningRepository | null>(null);

export function usePlanningRepository() {
  const repository = useContext(PlanningRepositoryContext);
  if (!repository) throw new Error("usePlanningRepository must be used inside PlanningRepositoryProvider");
  return repository;
}
