import { useEffect, useState } from "react";
import type { ProgressDisplayUnit } from "./domain/progress";

export function progressUnitStorageKey(userId: string) {
  return `fitness-progress-unit:${userId}`;
}

export function loadProgressDisplayUnit(userId: string): ProgressDisplayUnit {
  if (typeof localStorage === "undefined" || !userId) return "KG";
  return localStorage.getItem(progressUnitStorageKey(userId)) === "LB" ? "LB" : "KG";
}

export function useProgressDisplayUnit(userId: string) {
  const [unit, setUnit] = useState<ProgressDisplayUnit>(() => loadProgressDisplayUnit(userId));
  useEffect(() => setUnit(loadProgressDisplayUnit(userId)), [userId]);
  const update = (next: ProgressDisplayUnit) => {
    setUnit(next);
    if (typeof localStorage !== "undefined" && userId) localStorage.setItem(progressUnitStorageKey(userId), next);
  };
  return [unit, update] as const;
}
