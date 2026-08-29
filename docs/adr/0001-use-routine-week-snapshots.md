---
status: accepted
date: 2026-08-20
---

# Use Routine Week snapshots instead of a sequence pointer

Routine is a weekly set of selectable Routine Days, not a fixed cycle. Use an immutable RoutineWeekPlan snapshot per Monday–Sunday period, derive Frequency and Coverage from Completed Routine Sessions, and remove `next_workout_index` so the user may choose any Day without losing adherence history.

## Considered options

- Keep the sequence pointer and treat out-of-order choices as ad-hoc: rejected because those Sessions would not satisfy the Routine and the system could not report which weekly Days were missed.
- Evaluate History against the current mutable Routine: rejected because mid-week edits would rewrite prior expectations and make zero-session weeks ambiguous.

## Consequences

- The first Routine Session locks that week's plan; later Routine changes take effect in the next Routine Week.
- Weekly plans and Day labels must be snapshotted even for weeks with no Sessions.
- Session attribution uses `started_at`; a week may remain provisional while a crossing Active Session is unresolved.
- Planning and History require activation, weekly-plan and notification records beyond the existing Routine/Session schema.
