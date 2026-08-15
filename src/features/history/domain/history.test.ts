import { describe, expect, it } from "vitest";
import { formatHistoryDuration, historyDraftEquals, historySummaryFromSession, resequenceExercises, resequenceSets, validateHistoryDraft } from "./history";
import type { WorkoutSession } from "../../workout/domain/workout";

const session: WorkoutSession = {
  id: "session-1", ownerDeviceId: "device-1", sourceType: "AD_HOC", sourceRoutineId: null, sourceRoutineDayId: null, sourceTemplateId: null, sourceRoutineRevision: null, sourceTemplateRevision: null, routineNameSnapshot: null, dayLabelSnapshot: null, templateNameSnapshot: "History", status: "COMPLETED", startedAt: "2026-08-10T10:00:00.000Z", completedAt: "2026-08-10T11:05:00.000Z", notes: "", version: 2, editedAt: null, exercises: [{ id: "exercise-1", sourceTemplateExerciseId: null, sourceExerciseId: "source-1", sequence: 1, name: "Bench Press", equipmentCode: "barbell", muscles: [], notes: "", sets: [{ id: "set-1", sourceTemplateSetId: null, sequence: 1, kind: "WORKING", isToFailure: false, targetRepsMin: 8, targetRepsMax: 10, targetWeight: null, targetEffort: null, targetRestSeconds: 90, actualWeight: { value: 70, unit: "KG", kg: 70 }, actualReps: 8, actualEffort: null, actualRestSeconds: null, status: "COMPLETED", completedAt: "2026-08-10T10:10:00.000Z", notes: "" }] }], deletedAt: null,
};

describe("history domain", () => {
  it("calculates duration, working volume and summary fields", () => {
    const summary = historySummaryFromSession(session);
    expect(summary).toMatchObject({ durationSeconds: 3900, volumeKg: 560, completedWorkingSetCount: 1 });
  });

  it("re-sequences immutable exercise and set arrays", () => {
    const exercises = resequenceExercises([{ ...session.exercises[0], sequence: 4 }, { ...session.exercises[0], id: "exercise-2", sequence: 9 }]);
    expect(exercises.map((item) => item.sequence)).toEqual([1, 2]);
    const sets = resequenceSets([{ ...session.exercises[0].sets[0], sequence: 4 }, { ...session.exercises[0].sets[0], id: "set-2", sequence: 9 }]);
    expect(sets.map((item) => item.sequence)).toEqual([1, 2]);
  });

  it("validates completed and non-completed actual values", () => {
    const draft = { notes: "", exercises: [{ ...session.exercises[0], sets: [{ ...session.exercises[0].sets[0], actualWeight: null }] }] };
    expect(Object.keys(validateHistoryDraft(draft))).toContain("exercise-0-set-0-weight");
    const invalidPending = { notes: "", exercises: [{ ...session.exercises[0], sets: [{ ...session.exercises[0].sets[0], status: "PENDING" as const }] }] };
    expect(Object.keys(validateHistoryDraft(invalidPending))).toContain("exercise-0-set-0");
  });

  it("keeps a new set detached from template targets and validates cleared status values", () => {
    const newSet = {
      ...session.exercises[0].sets[0],
      id: "new-set",
      sourceTemplateSetId: null,
      targetRepsMin: null,
      targetRepsMax: null,
      targetWeight: null,
      targetEffort: null,
      targetRestSeconds: 0,
      status: "PENDING" as const,
      actualWeight: null,
      actualReps: null,
      actualEffort: null,
      actualRestSeconds: null,
      completedAt: null,
    };
    expect(newSet.sourceTemplateSetId).toBeNull();
    expect(newSet.targetWeight).toBeNull();
    expect(validateHistoryDraft({ notes: "", exercises: [{ ...session.exercises[0], sets: [newSet] }] })).toEqual({});
  });

  it("compares drafts and formats duration", () => {
    const draft = { notes: session.notes, exercises: session.exercises };
    expect(historyDraftEquals(draft, { notes: session.notes, exercises: session.exercises })).toBe(true);
    expect(historyDraftEquals(draft, { ...draft, notes: "changed" })).toBe(false);
    expect(formatHistoryDuration(3660)).toBe("1ชม. 1น.");
  });
});
