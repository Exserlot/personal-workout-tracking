import type { TrendChartPoint } from "./TrendChart";

const WIDTH = 560;
const HEIGHT = 184;
const PADDING_X = 18;
const PADDING_Y = 20;

export function chartCoordinates(points: TrendChartPoint[]) {
  if (points.length === 0) return [];
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum || Math.max(Math.abs(maximum) * 0.1, 1);
  return points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? WIDTH / 2 : PADDING_X + index * ((WIDTH - PADDING_X * 2) / (points.length - 1)),
    y: HEIGHT - PADDING_Y - ((point.value - minimum + (maximum === minimum ? span / 2 : 0)) / span) * (HEIGHT - PADDING_Y * 2),
  }));
}
