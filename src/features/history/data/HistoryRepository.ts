import type { HistoryListItem, HistoryRepository } from "../domain/history";
import { HistoryRepositoryError } from "../domain/history";

export type { HistoryRepository };

export function historyListItemFromRow(row: Record<string, unknown>): HistoryListItem {
  if (typeof row.session_id !== "string" || typeof row.completed_at !== "string" || (row.source_type !== "PLANNED" && row.source_type !== "AD_HOC")) throw new HistoryRepositoryError("unknown", "History response มีข้อมูลไม่ครบ");
  const numberValue = (value: unknown, field: string) => {
    const result = Number(value);
    if (!Number.isFinite(result) || result < 0 || (field !== "volume" && !Number.isInteger(result))) throw new HistoryRepositoryError("unknown", `History response มี ${field} ไม่ถูกต้อง`);
    return result;
  };
  return {
    sessionId: row.session_id,
    label: typeof row.label === "string" ? row.label : "Ad-hoc Workout",
    sourceType: row.source_type,
    completedAt: row.completed_at,
    durationSeconds: numberValue(row.duration_seconds, "duration"),
    exerciseCount: numberValue(row.exercise_count, "exercise count"),
    completedWorkingSetCount: numberValue(row.completed_working_set_count, "set count"),
    volumeKg: numberValue(row.volume_kg, "volume"),
    editedAt: typeof row.edited_at === "string" ? row.edited_at : null,
  };
}
