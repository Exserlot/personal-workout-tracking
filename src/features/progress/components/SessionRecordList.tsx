import { Link } from "react-router-dom";
import { progressRecordLabel, type ProgressDisplayUnit, type ProgressRecord } from "../domain/progress";

interface SessionRecordListProps {
  records: ProgressRecord[];
  unit: ProgressDisplayUnit;
}

export function SessionRecordList({ records, unit }: SessionRecordListProps) {
  if (records.length === 0) return <p className="border-b border-line-subtle py-5 text-sm text-ink-secondary">Session นี้ไม่มี Personal Record ใหม่</p>;
  return <div className="border-t border-line">{records.map((record, index) => <div key={`${record.kind}-${record.setId}`} className="flex min-h-[68px] items-center gap-3 border-b border-line-subtle py-3"><span className="text-xs tabular-nums text-accent">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{record.exerciseName}</strong><span className="mt-1 block text-sm text-ink-secondary">{progressRecordLabel(record, unit)}</span></span><Link className="shrink-0 text-sm font-semibold underline underline-offset-4" to={`/progress/${record.exerciseId}`}>Progress</Link></div>)}</div>;
}
