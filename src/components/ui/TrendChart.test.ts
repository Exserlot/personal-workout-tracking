import { describe, expect, it } from "vitest";
import type { TrendChartPoint } from "./TrendChart";
import { chartCoordinates } from "./trendChartGeometry";

const point = (sessionId: string, value: number): TrendChartPoint => ({ sessionId, value, completedAt: "2026-08-15T00:00:00.000Z" });

describe("chartCoordinates", () => {
  it("centers a single point", () => {
    expect(chartCoordinates([point("one", 10)])[0]).toMatchObject({ x: 280, y: 92 });
  });

  it("keeps an equal-value series finite", () => {
    const result = chartCoordinates([point("one", 10), point("two", 10)]);
    expect(result.every((item) => Number.isFinite(item.x) && Number.isFinite(item.y))).toBe(true);
    expect(result[0]?.y).toBe(result[1]?.y);
  });
});
