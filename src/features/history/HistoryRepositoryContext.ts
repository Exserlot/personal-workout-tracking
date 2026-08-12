import { createContext, useContext } from "react";
import type { HistoryRepository } from "./domain/history";

export const HistoryRepositoryContext = createContext<HistoryRepository | null>(null);

export function useHistoryRepository() {
  const repository = useContext(HistoryRepositoryContext);
  if (!repository) throw new Error("HistoryRepositoryProvider is required");
  return repository;
}
