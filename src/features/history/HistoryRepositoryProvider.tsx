import type { ReactNode } from "react";
import type { HistoryRepository } from "./domain/history";
import { HistoryRepositoryContext } from "./HistoryRepositoryContext";

export function HistoryRepositoryProvider({ repository, children }: { repository: HistoryRepository; children: ReactNode }) {
  return <HistoryRepositoryContext.Provider value={repository}>{children}</HistoryRepositoryContext.Provider>;
}
