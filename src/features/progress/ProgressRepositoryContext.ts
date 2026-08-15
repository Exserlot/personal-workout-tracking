import { createContext, useContext } from "react";
import type { ProgressRepository } from "./domain/progress";

export const ProgressRepositoryContext = createContext<ProgressRepository | null>(null);

export function useProgressRepository(): ProgressRepository {
  const repository = useContext(ProgressRepositoryContext);
  if (!repository) throw new Error("ProgressRepositoryProvider is missing");
  return repository;
}
