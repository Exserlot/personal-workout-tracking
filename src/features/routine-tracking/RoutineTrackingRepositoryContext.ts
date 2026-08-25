import { createContext, useContext } from "react";
import type { RoutineTrackingRepository } from "./data/RoutineTrackingRepository";

export const RoutineTrackingRepositoryContext = createContext<RoutineTrackingRepository | null>(null);

export function useRoutineTrackingRepository() {
  const repository = useContext(RoutineTrackingRepositoryContext);
  if (!repository) throw new Error("RoutineTrackingRepositoryProvider is required");
  return repository;
}
