import type { ReactNode } from "react";
import type { RoutineTrackingRepository } from "./data/RoutineTrackingRepository";
import { RoutineTrackingRepositoryContext } from "./RoutineTrackingRepositoryContext";

export function RoutineTrackingRepositoryProvider({ repository, children }: { repository: RoutineTrackingRepository; children: ReactNode }) {
  return <RoutineTrackingRepositoryContext.Provider value={repository}>{children}</RoutineTrackingRepositoryContext.Provider>;
}
