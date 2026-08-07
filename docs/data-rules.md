# Personal Workout Tracking App — Data Rules

**Status:** Domain invariants and consistency policy  
**Sources:** [Product Requirements](product-requirements.md) · [User Flows](user-flows.md)  
**Models:** [Domain Model](domain-model.md) · [Database Schema](database-schema.md)

## 1. Authority and precedence

1. Product Requirements define feature scope and business intent
2. These rules define valid data and mutation behavior
3. Session snapshot rows are authoritative for Active Workout and History after Start
4. Current Plan/Exercise rows are authoritative only for future Session creation
5. Server is authoritative for acknowledged data; IndexedDB is the durable working copy for pending Active Session operations

If a source Plan and Session snapshot disagree, History must use the Session snapshot.

## 2. Identifier, ownership and version rules

- All offline-creatable entities and mutations use client-generated UUIDs
- Every mutation is scoped to authenticated `user_id`; IDs alone never authorize access
- Aggregate roots `Exercise`, `WorkoutTemplate`, `Routine` and `WorkoutSession` carry integer versions
- Update requires expected version; mismatch returns conflict and does not partially apply
- User may have at most one Active Routine and one Active Session
- Non-owner device may read server-synced Active Session but may not edit it
- A retried `operation_id` returns the prior result and must not run the mutation again

## 3. Exercise and Muscle rules

- Exercise name is required and normalized for case-insensitive duplicate checks
- Starter Exercise has no owner; Custom Exercise has exactly one owner
- Exercise has exactly one primary Muscle
- Exercise may have zero or more unique secondary Muscles
- A Muscle cannot be both primary and secondary for the same Exercise
- Secondary Muscle sequence numbers are unique and positive
- Referenced Exercise/Muscle records are archived, not hard-deleted
- SessionExercise stores display-relevant Exercise/Muscle snapshots; History does not depend on current catalog names

## 4. Routine, Template and Plan Day rules

- Routine is the persisted Workout Plan and owns an ordered list of RoutineDays
- RoutineDay sequence is unique, contiguous after save and starts at 1
- Each RoutineDay references exactly one usable WorkoutTemplate
- WorkoutTemplate owns ordered TemplateExercises; each TemplateExercise references one Exercise
- TemplateExercise owns ordered SetPrescriptions; planned set count is derived from their row count
- Active Routine requires at least one Day, each referenced Template requires at least one Exercise, and each planned Exercise requires at least one SetPrescription
- Weekly frequency target is an integer 1–7 and does not schedule calendar dates
- Any child mutation increments the parent Template/Routine revision in the same transaction
- Archiving a Template referenced by an active Routine is blocked until the reference is removed or another Routine is activated
- Changing Active Routine is blocked while an Active Session exists

## 5. Snapshot rules

### Snapshot boundary

Starting a planned workout copies one consistent RoutineDay/Template revision into:

- WorkoutSession snapshot headers
- SessionExercise names, equipment, muscle roles, order and notes
- SessionSet kind, to-failure flag, target reps, target weight, target effort, target rest and order

The snapshot plus owner-device claim is atomic. Partial snapshots are invalid and must roll back.

### Historical isolation

- No Plan update may cascade to WorkoutSession, SessionExercise or SessionSet
- Session source IDs are provenance links only
- History and Progress queries must never substitute a current Template/Exercise field for a snapshot field
- If a source record is later archived or exceptionally purged, the Session remains readable
- Active Session may alter its own exercise order, planned targets and sets; these changes never update the source Template
- Completed Session edits occur only through History flow and set `edited_at`; they invalidate affected Progress results

### Snapshot example

On 7 August, the Session snapshot records:

- Exercise: Bench Press
- Set kind: WORKING; `is_to_failure = false`
- Target/actual load: `70 KG`
- Actual reps: `8`
- Effort: `RPE 8`

If the Template changes next month to Incline Bench Press at `80 KG`, the 7 August History remains Bench Press `70 KG × 8 @ RPE 8`. Joining the old Session to the new Template for display is a data bug.

## 6. Set rules

### Set kinds and failure intent

- Allowed kind codes: `WARM_UP`, `WORKING`, `DROP`
- Failure Set is represented by `is_to_failure = true`; it is unrelated to sync/error status
- `is_to_failure` may combine with WORKING or DROP, allowing a Drop Set taken to failure
- `WARM_UP + is_to_failure` is invalid
- Set kind and failure flag are stored on both prescription and SessionSet so later plan changes cannot reclassify History
- MVP Progress includes `WORKING` only and excludes `WARM_UP`
- `DROP` and `is_to_failure = true` are supported structurally but require an explicit versioned analytics policy before contributing to PR/volume calculations

### Prescription and actual values

- Target fields describe the effective Session prescription; actual fields describe performance
- `PENDING` Set may have incomplete actual fields
- `COMPLETED` Set requires positive integer reps, completion timestamp and a valid weight pair when load is recorded
- `SKIPPED` Set does not contribute to metrics
- Weight is nonnegative; bodyweight/external-load semantics are deferred and must not be inferred from zero
- Target reps minimum/maximum are positive and `min <= max`
- Rest target is nonnegative seconds; actual rest is optional and nonnegative
- Sequence is unique and positive within each Exercise; reordering must update all affected positions atomically
- Added Session Set has null `source_template_set_id`; deleting it from Active Session must not touch the Template

## 7. Effort rules: RPE and RIR

- Effort is a pair: `metric` + `value`; both are null or both are present
- Allowed metrics are `RPE` and `RIR`
- RPE range is `1.0–10.0`, using increments of `0.5`
- RIR range is `0–10`, using integer values
- A Set stores at most one effort pair; do not persist both RPE and RIR for the same target or actual entry
- Do not silently convert and overwrite RPE/RIR. If UI shows an estimate, label it derived and preserve the entered pair
- Template target effort and actual effort are independent; an actual Set may use another metric if UI explicitly supports it

This tagged-value approach reconciles the existing RIR requirement with the new RPE requirement without ambiguous dual columns.

## 8. Weight and unit rules

### Stored representation

When weight exists, store all three values together:

- `weight_value`: original decimal entered by the User
- `weight_unit`: `KG` or `LB`
- `weight_kg`: canonical decimal for comparisons/calculations

All three are null or all three are present. The server computes canonical kg; clients may preview but cannot authoritatively supply a conflicting result.

### Conversion

- `KG`: canonical value equals entered value
- `LB`: canonical kg = entered value × `0.45359237`
- Round canonical storage once to 4 decimal kg using a documented half-up rule
- Never convert canonical kg back and overwrite original input
- History defaults to the original entered value/unit; global display-unit conversion is presentation only
- Aggregations compare canonical kg, not mixed entered values

### Trade-off

Keeping original and canonical values preserves “70 KG” exactly and supports cross-unit analytics. It also creates duplication: any write path that updates only one value causes inconsistency. Therefore weight mutations must use one domain service/database transaction and direct column updates are forbidden.

## 9. Session lifecycle rules

Valid transitions:

```text
not-created → ACTIVE → COMPLETED
                     ↘ DISCARDED
```

- Leaving the screen does not change ACTIVE status
- COMPLETED requires `completed_at`; ACTIVE/DISCARDED must not use it as completion evidence
- COMPLETED or DISCARDED cannot transition back to ACTIVE
- Planned Session advances `next_workout_index` once on completion
- Ad-hoc and discarded Sessions never advance Routine
- Finish + Routine advancement + idempotency receipt commit atomically on server
- Soft-deleted Completed Session is excluded from History default queries and all Progress calculations
- Retrospective edit does not change source Plan revisions or Routine position

## 10. Offline, sync and concurrency rules

- Active Session mutations write local entity and SyncOperation in one IndexedDB transaction
- Sync operation includes operation ID, device ID, Session ID and expected version
- Server checks idempotency receipt before applying business logic
- Operations for one Session are processed in revision order
- Server timeout leaves operation pending; retry reuses the same ID
- Version/owner-device conflict stops the affected Session queue; no last-write-wins or automatic field merge
- Network response with older version cannot overwrite newer local pending state
- Logout must not erase pending operations automatically
- Mutation receipt retention must exceed the supported offline retry window
- Snapshot Start retries from a consistent source revision; it never mixes children from two Template revisions

## 11. History and Progress rules

- Only `COMPLETED`, non-deleted Sessions are eligible
- MVP volume and estimated 1RM use `WORKING` Sets with `COMPLETED` status
- Warm-up, skipped, discarded and soft-deleted data are excluded
- Volume uses canonical kg × actual reps
- Estimated 1RM uses Epley for 1–10 reps as defined in Product Requirements
- Every derived value retains a link to source Session/SessionSet
- History edits/deletes invalidate derived caches; stale values must be marked, not shown as current
- Progress is derived data and is never edited directly
- Future inclusion of DROP/failure sets requires an analytics-policy version and backfill/recalculation decision

## 12. Delete and archive rules

- Exercise, Muscle, Template and Routine definitions use archive state
- Normal UI never hard-deletes a definition referenced by Planning or History
- Completed Session uses soft delete; MVP has no restore UI
- Cascade delete is allowed only inside an uncommitted/failed Session snapshot transaction
- Exceptional retention purge may null source provenance FKs but must retain snapshot-owned content until History itself is legally/explicitly purged

## 13. Common inconsistency risks

| Risk | Example | Prevention / detection |
| --- | --- | --- |
| Live Plan joined into History | Bench Press becomes Incline Bench after Template edit | History repository selects snapshot columns only; regression test |
| Partial snapshot | Session exists but some Exercises/Sets are missing | one transaction; ACTIVE set only at successful commit |
| Mixed Template revisions | Exercise order from revision 4, sets from revision 5 | expected revision + consistent read/lock |
| Duplicate offline mutation | Retry inserts the same completed set twice | client UUID + mutation receipt/idempotency key |
| Two Active Sessions | phone and desktop start concurrently | unique active constraint + transactional check |
| Unit drift | `155 LB` repeatedly converts to changing kg/lb values | preserve original pair; one canonical conversion |
| Weight pair mismatch | entered `70 KG` but canonical field reflects another value | server computes canonical value; paired-field constraint/audit |
| Dual effort conflict | Set stores RPE 8 and RIR 4 simultaneously | tagged metric/value pair; mutually exclusive validation |
| Set count drift | Template says 3 sets but contains 4 rows | derive count from set rows only |
| Sequence collision | two Exercises both position 2 after reorder | unique constraint + atomic reorder |
| Routine advances twice | Finish request retries | atomic finish transaction + idempotency receipt |
| Archived source breaks History | Exercise name disappears after archive | snapshot display fields; archive instead of hard delete |
| Stale Progress | edited Set still shows old PR | invalidation transaction + stale marker/recalculation |
| DROP/failure metric ambiguity | future set unexpectedly changes historical PR | orthogonal kind/flag plus versioned analytics policy before inclusion |

## 14. Validation ownership

| Rule type | Primary enforcement | Secondary enforcement |
| --- | --- | --- |
| Required fields/ranges | application domain service | database CHECK/NOT NULL where portable |
| Ownership/authorization | server application layer | row-level policy if selected vendor supports it |
| Unique active Routine/Session | database unique constraint | transactional application check |
| Snapshot atomicity | database transaction | integration tests |
| Idempotency | mutation receipt PK | client stable operation IDs |
| Sequence uniqueness | database unique constraint | application reorder validation |
| RPE/RIR and weight pairing | domain value objects | database pair/null checks |
| Historical isolation | repository/query boundaries | regression tests comparing before/after Plan edits |

## 15. Required consistency tests

1. Start Session from Template revision N, edit Template to N+1, and confirm Session snapshot is unchanged
2. Log Bench Press `70 KG × 8 @ RPE 8`, change the Plan next month, and confirm old History remains exact
3. Retry Start, Complete Set and Finish commands; confirm one Session, one Set and one Routine advance
4. Start concurrently from two devices; confirm at most one Active Session
5. Convert equivalent KG/LB inputs and confirm canonical comparison without changing original display values
6. Attempt invalid primary/secondary Muscle overlap, RPE/RIR pair, weight triplet and sequence collision
7. Edit/soft-delete Completed Session and confirm Progress invalidation
8. Archive Exercise/Template and confirm Session snapshot remains readable

## 16. Open implementation decisions

These are deliberately deferred until the database vendor and application stack are selected:

- Exact decimal precision beyond the proposed ranges
- Partial unique index versus transaction/trigger fallback
- Row-level security implementation
- Mutation receipt retention duration
- Whether actual rest duration is measured automatically in MVP
- Whether full retrospective edit diffs require an audit-event table

None of these decisions may weaken snapshot isolation or historical fidelity.
