import { describe, expect, it } from "vitest";
import type { TemplateExercise, WorkoutTemplateSummary } from "../../planning/domain/planning";
import type { WorkoutSession } from "./workout";
import {
  compactExercisePreview,
  eligibleAdHocTemplates,
  filterAdHocTemplates,
  formatPreviousPerformance,
  resolveTodayContentState,
  summarizeActiveSession,
} from "./todayRules";

const sessionSet = (id: string, status: "COMPLETED" | "PENDING") => ({
  id,
  sourceTemplateSetId: null,
  sequence: id === "set-1" ? 1 : 2,
  kind: "WORKING" as const,
  isToFailure: false,
  targetRepsMin: 8,
  targetRepsMax: 10,
  targetWeight: null,
  targetEffort: null,
  targetRestSeconds: 90,
  actualWeight: status === "COMPLETED" ? { value: 70, unit: "KG" as const, kg: 70 } : null,
  actualReps: status === "COMPLETED" ? 8 : null,
  actualEffort: null,
  actualRestSeconds: null,
  status,
  completedAt: status === "COMPLETED" ? "2026-08-10T10:05:00.000Z" : null,
  notes: "",
});

const session: WorkoutSession = {
  id: "session-1",
  ownerDeviceId: "device-1",
  sourceType: "PLANNED",
  sourceRoutineId: "routine-1",
  sourceRoutineDayId: "day-1",
  sourceRoutineWeekPlanId: "week-1",
  sourceRoutineWeekPlanDayId: "week-day-1",
  sourceTemplateId: "template-1",
  sourceRoutineRevision: 1,
  sourceTemplateRevision: 1,
  routineNameSnapshot: "Push Pull",
  dayLabelSnapshot: "Push Day",
  templateNameSnapshot: "Push A",
  status: "ACTIVE",
  startedAt: "2026-08-10T10:00:00.000Z",
  completedAt: null,
  notes: "",
  version: 2,
  editedAt: null,
  exercises: [{
    id: "session-exercise-1",
    sourceTemplateExerciseId: "template-exercise-1",
    sourceExerciseId: "exercise-1",
    sequence: 1,
    name: "Bench Press",
    equipmentCode: "barbell",
    muscles: [],
    notes: "",
    sets: [sessionSet("set-1", "COMPLETED"), sessionSet("set-2", "PENDING")],
  }],
};

const exercise = (id: string) => ({ id, exerciseId: id }) as TemplateExercise;
const template = (
  id: string,
  exerciseCount = 1,
  setCount = 3,
  archivedAt: string | null = null,
): WorkoutTemplateSummary => ({
  id,
  name: id,
  notes: "",
  revision: 1,
  archivedAt,
  exerciseCount,
  setCount,
});

describe("Today rules", () => {
  it("gives Active Session priority over loading, preview and errors", () => {
    expect(resolveTodayContentState({
      initialLoading: true,
      activeSession: session,
      preview: {} as never,
      fatalError: true,
    })).toBe("active-session");
  });

  it("resolves the remaining Today states", () => {
    expect(resolveTodayContentState({ initialLoading: true, activeSession: null, preview: null, fatalError: false })).toBe("initial-loading");
    expect(resolveTodayContentState({ initialLoading: false, activeSession: null, preview: {} as never, fatalError: false })).toBe("planned-workout");
    expect(resolveTodayContentState({ initialLoading: false, activeSession: null, preview: null, fatalError: true })).toBe("fatal-error");
    expect(resolveTodayContentState({ initialLoading: false, activeSession: null, preview: null, fatalError: false })).toBe("no-routine");
  });

  it("summarizes completed and total sets", () => {
    expect(summarizeActiveSession(session)).toEqual({
      exerciseCount: 1,
      completedSetCount: 1,
      totalSetCount: 2,
    });
  });

  it("formats previous performance with optional effort", () => {
    expect(formatPreviousPerformance()).toBe("ยังไม่มีข้อมูลครั้งก่อน");
    expect(formatPreviousPerformance({
      weight: { value: 72.5, unit: "KG", kg: 72.5 },
      reps: 8,
      effort: { metric: "RPE", value: 8.5 },
      completedAt: "2026-08-09T10:00:00.000Z",
    })).toBe("ครั้งก่อน 72.5 KG × 8 · RPE 8.5");
  });

  it("limits compact Exercise previews to four rows", () => {
    const exercises = [1, 2, 3, 4, 5].map((value) => exercise(String(value)));
    expect(compactExercisePreview(exercises, false)).toHaveLength(4);
    expect(compactExercisePreview(exercises, true)).toHaveLength(5);
  });

  it("filters eligible Ad-hoc Templates and searches by name", () => {
    const templates = [
      template("Push Day"),
      template("Pull Day"),
      template("Empty", 0, 0),
      template("Archived", 1, 3, "2026-08-01"),
    ];
    const eligible = eligibleAdHocTemplates(templates);
    expect(eligible.map((item) => item.name)).toEqual(["Push Day", "Pull Day"]);
    expect(filterAdHocTemplates(eligible, "pull").map((item) => item.name)).toEqual(["Pull Day"]);
  });
});
