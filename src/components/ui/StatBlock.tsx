import { cn } from "../../lib/cn";

interface StatBlockProps {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  accent?: boolean;
  showTopRule?: boolean;
  className?: string;
}

export function StatBlock({ label, value, unit, detail, accent, showTopRule = true, className }: StatBlockProps) {
  return (
    <div className={cn("min-w-0 py-4", showTopRule && "border-t border-line-subtle", className)}>
      <div className={cn("mb-4 h-0.5 w-5", accent ? "bg-accent" : "bg-line-strong")} aria-hidden="true" />
      <p className="text-xs font-semibold tracking-[0.05em] text-ink-muted">{label}</p>
      <p className="mt-2 flex min-w-0 items-baseline gap-2 tabular-nums">
        <span className="truncate text-data text-ink">{value}</span>
        {unit ? <span className="text-xs font-semibold text-ink-muted">{unit}</span> : null}
      </p>
      {detail ? <p className="mt-1 text-sm text-ink-secondary">{detail}</p> : null}
    </div>
  );
}
