import { describe, expect, it } from "vitest";
import { estimated1RmKg, formatProgressWeight, progressRangeStart, weightFromKg } from "./progress";

describe("progress domain", () => {
  it("calculates Epley only for positive weights and 1–10 reps", () => {
    expect(estimated1RmKg(100, 10)).toBe(133.3333);
    expect(estimated1RmKg(0, 10)).toBeNull();
    expect(estimated1RmKg(100, 11)).toBeNull();
  });

  it("converts display units without changing canonical kilograms", () => {
    expect(weightFromKg(45.3592, "LB")).toBe(100);
    expect(formatProgressWeight(45.3592, "KG")).toBe("45.4 KG");
  });

  it("builds rolling range boundaries", () => {
    const now = new Date("2026-08-15T00:00:00.000Z");
    expect(progressRangeStart("30D", now)).toBe("2026-07-16T00:00:00.000Z");
    expect(progressRangeStart("ALL", now)).toBeNull();
  });
});
