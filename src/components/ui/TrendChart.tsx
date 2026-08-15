import { useId } from "react";
import { Link } from "react-router-dom";
import { chartCoordinates } from "./trendChartGeometry";

export interface TrendChartPoint {
  sessionId: string;
  completedAt: string;
  value: number;
  isRecord?: boolean;
}

interface TrendChartProps {
  title: string;
  description: string;
  points: TrendChartPoint[];
  formatValue: (value: number) => string;
}

export function TrendChart({ title, description, points, formatValue }: TrendChartProps) {
  const titleId = useId();
  const descriptionId = useId();
  const coordinates = chartCoordinates(points);
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
  const latest = points.at(-1);

  return (
    <figure className="min-w-0 border border-line bg-recessed p-4 tablet:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.05em] text-ink-muted">{title}</p>
          <p className="mt-2 text-data tabular-nums">{latest ? formatValue(latest.value) : "—"}</p>
        </div>
        <p className="text-xs text-ink-muted">{points.length} SESSIONS</p>
      </div>
      <svg viewBox="0 0 560 184" className="mt-6 block h-auto w-full" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
        <title id={titleId}>{title}</title>
        <desc id={descriptionId}>{description}</desc>
        <path d="M0 20H560M0 92H560M0 164H560" stroke="rgb(var(--color-border-subtle))" strokeWidth="1" />
        {coordinates.length > 1 ? <path d={path} fill="none" stroke="rgb(var(--color-text-primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null}
        {coordinates.map((point) => (
          <a key={point.sessionId} href={`/history/${point.sessionId}`} tabIndex={0} aria-label={`${new Date(point.completedAt).toLocaleDateString("th-TH")} ${formatValue(point.value)}${point.isRecord ? " Personal record" : ""}`} className="outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
            <circle cx={point.x} cy={point.y} r={point.isRecord ? 6 : 4} fill={point.isRecord ? "rgb(var(--color-accent))" : "rgb(var(--color-text-primary))"} />
          </a>
        ))}
      </svg>
      <figcaption className="mt-4 border-t border-line-subtle pt-3 text-sm leading-6 text-ink-secondary">{description}</figcaption>
      <details className="mt-4 border-t border-line-subtle pt-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">ดูข้อมูลกราฟแบบตาราง</summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead><tr className="border-b border-line"><th className="py-3 pr-4">วันที่</th><th className="py-3 pr-4">ค่า</th><th className="py-3">Session</th></tr></thead>
            <tbody>{points.map((point) => <tr key={point.sessionId} className="border-b border-line-subtle"><td className="py-3 pr-4">{new Date(point.completedAt).toLocaleDateString("th-TH")}</td><td className="py-3 pr-4 tabular-nums">{formatValue(point.value)}</td><td className="py-3"><Link className="underline underline-offset-4" to={`/history/${point.sessionId}`}>ดู History</Link></td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
