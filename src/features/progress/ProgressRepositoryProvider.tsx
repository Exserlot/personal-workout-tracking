import type { PropsWithChildren } from "react";
import { ProgressRepositoryContext } from "./ProgressRepositoryContext";
import type { ProgressRepository } from "./domain/progress";

export function ProgressRepositoryProvider({ repository, children }: PropsWithChildren<{ repository: ProgressRepository }>) {
  return <ProgressRepositoryContext.Provider value={repository}>{children}</ProgressRepositoryContext.Provider>;
}
