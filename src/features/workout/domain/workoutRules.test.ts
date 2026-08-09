import { describe, expect, it } from "vitest";
import { commandValues, draftFromSet, pauseTimer, remainingTimerSeconds, skipTimer, timerAfterComplete, validateSetDraft } from "./workoutRules";

describe("online workout set rules", () => {
  it("requires weight and positive integer reps but keeps effort optional", () => {
    expect(validateSetDraft({ weight: "", weightUnit: "KG", reps: "0", effortMetric: "", effort: "" })).toMatchObject({ weight: expect.any(String), reps: expect.any(String) });
    expect(validateSetDraft({ weight: "72.5", weightUnit: "KG", reps: "8", effortMetric: "", effort: "" })).toEqual({});
  });

  it("accepts decimal kilograms and converts pounds canonically", () => {
    expect(commandValues({ weight: "72.5", weightUnit: "KG", reps: "8", effortMetric: "RPE", effort: "8.5" })).toMatchObject({ actualWeight: { value: 72.5, unit: "KG", kg: 72.5 }, actualReps: 8, actualEffort: { metric: "RPE", value: 8.5 } });
    expect(commandValues({ weight: "160", weightUnit: "LB", reps: "5", effortMetric: "RIR", effort: "2" }).actualWeight.kg).toBe(72.5748);
  });

  it("rest timer supports pause, reset and skip", () => {
    const running = timerAfterComplete(90, 1_000);
    expect(remainingTimerSeconds(running, 31_000)).toBe(60);
    const paused = pauseTimer(running, 31_000);
    expect(paused).toMatchObject({ status: "paused", pausedRemainingSeconds: 60, endsAt: null });
    expect(skipTimer(paused).status).toBe("idle");
  });

  it("uses targets before previous-session fallback for an initial set", () => {
    const draft = draftFromSet({ id: "new", sourceTemplateSetId: null, sequence: 2, kind: "WORKING", isToFailure: false, targetRepsMin: 8, targetRepsMax: 10, targetWeight: null, targetEffort: null, targetRestSeconds: 90, actualWeight: null, actualReps: null, actualEffort: null, actualRestSeconds: null, status: "PENDING", completedAt: null, notes: "" }, { weight: { value: 70, unit: "KG", kg: 70 }, reps: 7, effort: { metric: "RPE", value: 8 } });
    expect(draft).toMatchObject({ weight: "70", reps: "8", effortMetric: "RPE", effort: "8" });
  });

  it("defaults a bodyweight set to zero without replacing previous added weight", () => {
    const set = { id: "bodyweight", sourceTemplateSetId: null, sequence: 1, kind: "WORKING" as const, isToFailure: false, targetRepsMin: 8, targetRepsMax: 10, targetWeight: null, targetEffort: null, targetRestSeconds: 90, actualWeight: null, actualReps: null, actualEffort: null, actualRestSeconds: null, status: "PENDING" as const, completedAt: null, notes: "" };
    const zeroDraft = draftFromSet(set, undefined, { defaultWeight: { value: 0, unit: "KG", kg: 0 } });
    const previousDraft = draftFromSet(set, { weight: { value: 10, unit: "KG", kg: 10 }, reps: 8, effort: null }, { defaultWeight: { value: 0, unit: "KG", kg: 0 } });

    expect(zeroDraft.weight).toBe("0");
    expect(previousDraft.weight).toBe("10");
  });
});
