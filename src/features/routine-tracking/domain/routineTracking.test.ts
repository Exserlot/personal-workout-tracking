import { describe, expect, it } from "vitest";
import { groupRoutineWeekDays, type RoutineWeekDayStatus } from "./routineTracking";

const days: RoutineWeekDayStatus[] = [
  { id: "push", routineDayId: "routine-push", templateId: "template", displayOrder: 1, dayLabel: "Push", templateName: "Push", completedCount: 0, activeCount: 0 },
  { id: "pull", routineDayId: "routine-pull", templateId: "template", displayOrder: 2, dayLabel: "Pull", templateName: "Pull", completedCount: 0, activeCount: 0 },
  { id: "legs", routineDayId: "routine-legs", templateId: "template", displayOrder: 3, dayLabel: "Legs", templateName: "Legs", completedCount: 2, activeCount: 0 },
];

describe("routine week recommendation grouping", () => {
  it("recommends every uncovered Routine Day and keeps covered Days repeatable", () => {
    const result = groupRoutineWeekDays(days);
    expect(result.recommended.map((day) => day.dayLabel)).toEqual(["Push", "Pull"]);
    expect(result.repeat).toEqual([expect.objectContaining({ dayLabel: "Legs", completedCount: 2 })]);
  });
});
