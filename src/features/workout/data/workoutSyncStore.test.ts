import { describe, expect, it } from "vitest";
import type { OfflineSetCommand, OfflineWorkoutCommand, SyncOperation, WorkoutSession } from "../domain/workout";
import { completionSummaryFromSession } from "../domain/workout";
import { WorkoutQueueError, applyOfflineSetCommand, applyOfflineWorkoutCommand, expectedVersionForPending, projectPendingOperations, retryDelayMs } from "./workoutSyncStore";

function session(): WorkoutSession {
  return {
    id: "session-1",
    ownerDeviceId: "device-1",
    sourceType: "AD_HOC",
    sourceRoutineId: null,
    sourceRoutineDayId: null,
    sourceRoutineWeekPlanId: null,
    sourceRoutineWeekPlanDayId: null,
    sourceTemplateId: null,
    sourceRoutineRevision: null,
    sourceTemplateRevision: null,
    routineNameSnapshot: null,
    dayLabelSnapshot: null,
    templateNameSnapshot: "Workout",
    status: "ACTIVE",
    startedAt: "2026-08-11T08:00:00.000Z",
    completedAt: null,
    notes: "",
    version: 4,
    editedAt: null,
    exercises: [{
      id: "exercise-1",
      sourceTemplateExerciseId: null,
      sourceExerciseId: "source-1",
      sequence: 1,
      name: "Bench Press",
      equipmentCode: "barbell",
      muscles: [],
      notes: "",
      sets: [
        {
          id: "set-1",
          sourceTemplateSetId: null,
          sequence: 1,
          kind: "WORKING",
          isToFailure: false,
          targetRepsMin: 8,
          targetRepsMax: 12,
          targetWeight: null,
          targetEffort: null,
          targetRestSeconds: 90,
          actualWeight: null,
          actualReps: null,
          actualEffort: null,
          actualRestSeconds: null,
          status: "PENDING",
          completedAt: null,
          notes: "",
        },
        {
          id: "set-2",
          sourceTemplateSetId: null,
          sequence: 2,
          kind: "WORKING",
          isToFailure: false,
          targetRepsMin: 8,
          targetRepsMax: 12,
          targetWeight: null,
          targetEffort: null,
          targetRestSeconds: 90,
          actualWeight: null,
          actualReps: null,
          actualEffort: null,
          actualRestSeconds: null,
          status: "PENDING",
          completedAt: null,
          notes: "",
        },
      ],
    }],
  };
}

const command = (setId: string) => ({
  action: "complete_set" as const,
  setId,
  actualWeight: { value: 72.5, unit: "KG" as const, kg: 72.5 },
  actualReps: 8,
  actualEffort: { metric: "RPE" as const, value: 8.5 },
});

function operation(commandValue: OfflineWorkoutCommand, createdAt: number): SyncOperation {
  return {
    operationId: `operation-${createdAt}`,
    userId: "user-1",
    sessionId: "session-1",
    deviceId: "device-1",
    command: commandValue,
    expectedVersion: 4,
    createdAt,
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: 0,
    status: "PENDING",
    lastErrorCode: null,
  };
}

describe("workout sync projection", () => {
  it("completes a decimal-weight set without mutating the acknowledged session", () => {
    const acknowledged = session();
    const projected = applyOfflineSetCommand(acknowledged, command("set-1"), "2026-08-11T08:10:00.000Z");
    expect(acknowledged.exercises[0].sets[0].status).toBe("PENDING");
    expect(projected.exercises[0].sets[0]).toMatchObject({ status: "COMPLETED", actualWeight: { value: 72.5, unit: "KG" }, actualReps: 8, actualEffort: { metric: "RPE", value: 8.5 } });
  });

  it("projects Add, Complete and Edit for the same client-created Set in order", () => {
    const add: OfflineSetCommand = {
      action: "add_set",
      sessionExerciseId: "exercise-1",
      setId: "set-3",
      sequence: 3,
      kind: "WORKING",
      targetRepsMin: 8,
      targetRepsMax: 10,
      targetWeight: { value: 80, unit: "LB", kg: 36.2874 },
      targetEffort: { metric: "RIR", value: 2 },
      targetRestSeconds: 120,
    };
    const complete: OfflineSetCommand = {
      action: "complete_set",
      setId: "set-3",
      actualWeight: { value: 80, unit: "LB", kg: 36.2874 },
      actualReps: 9,
      actualEffort: { metric: "RIR", value: 2 },
    };
    const edit: OfflineSetCommand = {
      action: "edit_set",
      setId: "set-3",
      actualWeight: { value: 82.5, unit: "LB", kg: 37.4214 },
      actualReps: 8,
      actualEffort: { metric: "RPE", value: 8.5 },
    };
    const projected = [add, complete, edit].reduce(
      (current, item, index) => applyOfflineSetCommand(current, item, `2026-08-11T08:1${index}:00.000Z`),
      session(),
    );
    expect(projected.exercises[0].sets[2]).toMatchObject({
      id: "set-3",
      sequence: 3,
      status: "COMPLETED",
      actualWeight: { value: 82.5, unit: "LB", kg: 37.4214 },
      actualReps: 8,
      actualEffort: { metric: "RPE", value: 8.5 },
    });
  });

  it("skips only a pending Set and rejects a duplicate transition", () => {
    const skipped = applyOfflineSetCommand(session(), { action: "skip_set", setId: "set-1" });
    expect(skipped.exercises[0].sets[0].status).toBe("SKIPPED");
    expect(() => applyOfflineSetCommand(skipped, { action: "skip_set", setId: "set-1" }))
      .toThrowError(expect.objectContaining<Partial<WorkoutQueueError>>({ code: "duplicate" }));
  });

  it("deletes a Set, resequences the remainder and protects the last Set", () => {
    const deleted = applyOfflineSetCommand(session(), { action: "delete_set", setId: "set-1" });
    expect(deleted.exercises[0].sets).toMatchObject([{ id: "set-2", sequence: 1 }]);
    expect(() => applyOfflineSetCommand(deleted, { action: "delete_set", setId: "set-2" }))
      .toThrowError(expect.objectContaining<Partial<WorkoutQueueError>>({ code: "invalid" }));
  });

  it("allocates ordered server versions and reapplies remaining operations", () => {
    const acknowledged = session();
    const operations = [operation(command("set-1"), 1), operation(command("set-2"), 2)];
    expect(expectedVersionForPending(acknowledged, operations)).toBe(6);
    const projected = projectPendingOperations(acknowledged, operations);
    expect(projected.version).toBe(4);
    expect(projected.exercises[0].sets.every((set) => set.status === "COMPLETED")).toBe(true);
  });

  it("uses bounded exponential retry delays", () => {
    expect([0, 1, 2, 3, 4, 5, 8].map(retryDelayMs)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
  });

  it("finishes and discards immutably, and rejects a second terminal transition", () => {
    const acknowledged = session();
    const finished = applyOfflineWorkoutCommand(acknowledged, { action: "finish_session" }, "2026-08-11T08:30:00.000Z");
    expect(acknowledged.status).toBe("ACTIVE");
    expect(finished).toMatchObject({ status: "COMPLETED", completedAt: "2026-08-11T08:30:00.000Z" });
    expect(() => applyOfflineWorkoutCommand(finished, { action: "discard_session" })).toThrowError(expect.objectContaining<Partial<WorkoutQueueError>>({ code: "invalid" }));
    expect(applyOfflineWorkoutCommand(acknowledged, { action: "discard_session" }).status).toBe("DISCARDED");
  });

  it("projects queued Set operations before a terminal lifecycle command", () => {
    const finish: OfflineWorkoutCommand = { action: "finish_session" };
    const operations = [operation(command("set-1"), 1), { ...operation(finish, 2), expectedVersion: 5 }];
    const projected = projectPendingOperations(session(), operations);
    expect(projected.status).toBe("COMPLETED");
    expect(projected.exercises[0].sets[0].status).toBe("COMPLETED");
    expect(expectedVersionForPending(session(), operations)).toBe(6);
  });

  it("builds a provisional completion summary from the local projection", () => {
    const completed = applyOfflineSetCommand(session(), command("set-1"));
    const finished = applyOfflineWorkoutCommand(completed, { action: "finish_session" }, "2026-08-11T08:30:00.000Z");
    const summary = completionSummaryFromSession(finished);
    expect(summary).toMatchObject({ sessionId: "session-1", completedWorkingSetCount: 1, pendingSetCount: 1, durationSeconds: 1800 });
  });
});
