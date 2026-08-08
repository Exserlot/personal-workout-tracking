import { describe, expect, it } from "vitest";
import {
  appendSet,
  completeSet,
  createInitialActiveWorkoutState,
  editCompletedSet,
  hydrateActiveWorkoutState,
  remainingRestSeconds,
  updateSetDraft,
  validateSet,
} from "./setLogging";

describe("workout set logging transitions", () => {
  it("blocks completion when required values are missing", () => {
    const state = createInitialActiveWorkoutState(1_000);
    const incomplete = updateSetDraft(state, "set-1", { weight: "", reps: "", rpe: "" }, 1_001);
    const result = completeSet(incomplete, "set-1", 1_002);

    expect(result.errors).toEqual({
      weight: "กรอกน้ำหนักก่อน Complete Set",
      reps: "กรอกจำนวนครั้งก่อน Complete Set",
      rpe: "กรอก RPE ก่อน Complete Set",
    });
    expect(result.state.sets[0].status).toBe("pending");
    expect(result.state.restTimer.status).toBe("idle");
  });

  it("accepts decimal kilograms and starts the rest timer on completion", () => {
    const state = createInitialActiveWorkoutState(1_000);
    const withValues = updateSetDraft(state, "set-1", { weight: "72.5", reps: "8", rpe: "8.5" }, 1_001);
    const result = completeSet(withValues, "set-1", 2_000);

    expect(result.errors).toEqual({});
    expect(result.state.sets[0]).toMatchObject({ weight: "72.5", reps: "8", rpe: "8.5", status: "completed" });
    expect(remainingRestSeconds(result.state, 2_000)).toBe(90);
    expect(remainingRestSeconds(result.state, 92_001)).toBe(0);
  });

  it("defaults an appended set to the last completed set", () => {
    const state = createInitialActiveWorkoutState(1_000);
    const withValues = updateSetDraft(state, "set-1", { weight: "72.5", reps: "7", rpe: "9" }, 1_001);
    const completed = completeSet(withValues, "set-1", 2_000).state;
    const next = appendSet(completed, 3_000);

    expect(next.sets.at(-1)).toMatchObject({ setNumber: 2, weight: "72.5", reps: "7", rpe: "9", status: "pending" });
  });

  it("allows editing a completed set without starting another rest timer", () => {
    const state = createInitialActiveWorkoutState(1_000);
    const completed = completeSet(state, "set-1", 2_000).state;
    const editedDraft = updateSetDraft(completed, "set-1", { weight: "70.5" }, 3_000);
    const edited = editCompletedSet(editedDraft, "set-1", 4_000);

    expect(edited.errors).toEqual({});
    expect(edited.state.sets[0]).toMatchObject({ weight: "70.5", status: "completed" });
    expect(edited.state.restTimer.status).toBe("running");
    expect(validateSet({ weight: "72.55", reps: "8", rpe: "8" }).weight).toBeUndefined();
  });

  it("hydrates a persisted state so refresh does not lose completed values", () => {
    const state = createInitialActiveWorkoutState(1_000);
    const completed = completeSet(
      updateSetDraft(state, "set-1", { weight: "72.5", reps: "8", rpe: "8" }, 1_001),
      "set-1",
      2_000,
    ).state;

    const hydrated = hydrateActiveWorkoutState(JSON.parse(JSON.stringify(completed)));
    expect(hydrated?.sets[0]).toMatchObject({ weight: "72.5", status: "completed" });
    expect(hydrated?.restTimer.endsAt).toBe(92_000);
  });
});
