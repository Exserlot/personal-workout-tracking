# Personal Workout Tracking App — Logical Database Schema

**Status:** Vendor-neutral relational design; not executable DDL  
**Sources:** [Domain Model](domain-model.md) · [Data Rules](data-rules.md) · [Product Requirements](product-requirements.md)

## 1. Schema conventions

- Primary keys are client-generatable UUIDs so offline operations can use stable IDs
- Timestamps are UTC with timezone-aware types; User timezone is a display preference
- Mutable aggregate roots carry `version` for optimistic concurrency
- User-owned rows include `user_id` directly or inherit it through a constrained parent
- `archived_at` hides catalog/plan definitions; `deleted_at` soft-deletes historical Sessions
- Code columns use constrained strings, not vendor-native database enums, to keep future additive migrations portable
- Numeric examples are recommendations; final precision must be confirmed with the selected database

Common columns such as `id`, `created_at` and `updated_at` are omitted from some tables below when repetitive.

## 2. Identity and preferences

### `users`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK; maps managed-auth identity |
| `timezone` | varchar | required; IANA timezone |
| `display_weight_unit` | varchar(2) | `KG` or `LB`; default `KG` |
| `created_at`, `updated_at` | timestamptz | required |

### `devices`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK; client-generated |
| `user_id` | UUID | FK users; required |
| `label` | varchar | optional user-facing label |
| `last_seen_at` | timestamptz | required |
| `revoked_at` | timestamptz | nullable |

Index `devices(user_id, last_seen_at desc)`.

## 3. Exercise Catalog

### `muscles`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK |
| `code` | varchar | unique, stable normalized code |
| `name` | varchar | required display name |
| `archived_at` | timestamptz | nullable |

### `exercises`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK |
| `owner_user_id` | UUID | nullable for Starter Library; FK users for custom |
| `name` | varchar | required |
| `normalized_name` | varchar | required; case-insensitive uniqueness per owner |
| `equipment_code` | varchar | required controlled code |
| `primary_muscle_id` | UUID | FK muscles; required |
| `notes` | text | nullable |
| `archived_at` | timestamptz | nullable |
| `version` | integer | required; optimistic concurrency |

Recommended uniqueness:

- Starter catalog: unique `normalized_name` where `owner_user_id` is null
- Custom catalog: unique `(owner_user_id, normalized_name)` where owner is not null

### `exercise_secondary_muscles`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `exercise_id` | UUID | FK exercises; part of PK |
| `muscle_id` | UUID | FK muscles; part of PK |
| `sequence_no` | integer | positive; unique per Exercise |

Application/database validation must reject a secondary `muscle_id` equal to the Exercise’s `primary_muscle_id`.

## 4. Planning schema

### `workout_templates`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK |
| `user_id` | UUID | FK users; required |
| `name` | varchar | required |
| `notes` | text | nullable |
| `revision` | integer | required; increment on child mutation |
| `archived_at` | timestamptz | nullable |

### `template_exercises`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK |
| `template_id` | UUID | FK workout_templates; required |
| `exercise_id` | UUID | FK exercises; required |
| `sequence_no` | integer | positive; unique per Template |
| `notes` | text | nullable |

### `template_set_prescriptions`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK |
| `template_exercise_id` | UUID | FK template_exercises; required |
| `sequence_no` | integer | positive; unique per TemplateExercise |
| `set_kind_code` | varchar | `WARM_UP`, `WORKING`, `DROP` |
| `is_to_failure` | boolean | default false; invalid with WARM_UP |
| `target_reps_min` | integer | positive; required for the current strength-first planning MVP |
| `target_reps_max` | integer | positive; `>= target_reps_min` |
| `target_weight_value` | decimal(10,3) | nonnegative; nullable |
| `target_weight_unit` | varchar(2) | `KG`/`LB`; required with weight value |
| `target_weight_kg` | decimal(12,4) | canonical; required with weight value |
| `target_effort_metric` | varchar(3) | `RPE`/`RIR`; nullable |
| `target_effort_value` | decimal(3,1) | required iff metric exists |
| `target_rest_seconds` | integer | nonnegative |

Set count is `count(template_set_prescriptions)`; no duplicated `set_count` column.

### `routines`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK |
| `user_id` | UUID | FK users; required |
| `name` | varchar | required |
| `weekly_frequency_target` | smallint | 1–7 |
| `next_workout_index` | integer | zero-based and within current day count |
| `is_active` | boolean | at most one true per User |
| `revision` | integer | required; increment on child mutation |
| `archived_at` | timestamptz | nullable |

### `routine_days`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK |
| `routine_id` | UUID | FK routines; required |
| `template_id` | UUID | FK workout_templates; required |
| `sequence_no` | integer | positive; unique per Routine |
| `label` | varchar | optional day label override |
| `notes` | text | nullable |

Recommended partial unique index: one `routines(user_id)` where `is_active = true AND archived_at IS NULL`.

## 5. Workout Execution and snapshot schema

### `workout_sessions`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK; client-generated |
| `user_id` | UUID | FK users; required |
| `owner_device_id` | UUID | FK devices; required while ACTIVE |
| `source_type` | varchar | `PLANNED` or `AD_HOC` |
| `source_routine_id` | UUID | nullable provenance FK |
| `source_routine_day_id` | UUID | nullable provenance FK |
| `source_template_id` | UUID | nullable provenance FK |
| `source_routine_revision` | integer | nullable copied revision |
| `source_template_revision` | integer | nullable copied revision |
| `snapshot_schema_version` | integer | required; starts at 1 |
| `routine_name_snapshot` | varchar | nullable for ad-hoc |
| `day_label_snapshot` | varchar | nullable |
| `template_name_snapshot` | varchar | required for planned; nullable ad-hoc |
| `status` | varchar | `ACTIVE`, `COMPLETED`, `DISCARDED` |
| `started_at` | timestamptz | required |
| `completed_at` | timestamptz | required only when COMPLETED |
| `notes` | text | nullable |
| `version` | integer | optimistic concurrency |
| `edited_at` | timestamptz | nullable; retrospective edit marker |
| `deleted_at` | timestamptz | nullable; History soft delete |

Recommended partial unique index: one `workout_sessions(user_id)` where `status = 'ACTIVE' AND deleted_at IS NULL`.

### `workout_session_exercises`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK; client-generated |
| `session_id` | UUID | FK workout_sessions; required |
| `source_template_exercise_id` | UUID | nullable provenance FK |
| `source_exercise_id` | UUID | nullable provenance FK |
| `sequence_no` | integer | positive; unique per Session |
| `exercise_name_snapshot` | varchar | required |
| `equipment_code_snapshot` | varchar | nullable |
| `notes` | text | nullable; session-owned |

### `workout_session_exercise_muscles`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `session_exercise_id` | UUID | FK workout_session_exercises; part of PK |
| `role` | varchar | `PRIMARY` or `SECONDARY`; part of PK with sequence |
| `sequence_no` | integer | positive; unique by SessionExercise/role |
| `source_muscle_id` | UUID | nullable provenance FK |
| `muscle_name_snapshot` | varchar | required |

Exactly one PRIMARY row is required per SessionExercise snapshot; secondary rows are optional.

### `workout_session_sets`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | UUID | PK; client-generated |
| `session_exercise_id` | UUID | FK workout_session_exercises; required |
| `source_template_set_id` | UUID | nullable provenance FK |
| `sequence_no` | integer | positive; unique per SessionExercise |
| `set_kind_code` | varchar | `WARM_UP`, `WORKING`, `DROP` |
| `is_to_failure` | boolean | copied/effective flag; invalid with WARM_UP |
| `target_reps_min`, `target_reps_max` | integer | copied/effective target; nullable |
| `target_weight_value` | decimal(10,3) | copied/effective entered target; nullable |
| `target_weight_unit` | varchar(2) | `KG`/`LB`; paired with target value |
| `target_weight_kg` | decimal(12,4) | canonical target; paired with target value |
| `target_effort_metric` | varchar(3) | `RPE`/`RIR`; nullable |
| `target_effort_value` | decimal(3,1) | paired with metric |
| `target_rest_seconds` | integer | nonnegative |
| `actual_weight_value` | decimal(10,3) | nonnegative; nullable until complete |
| `actual_weight_unit` | varchar(2) | `KG`/`LB`; paired with actual value |
| `actual_weight_kg` | decimal(12,4) | canonical; paired with actual value |
| `actual_reps` | integer | positive for completed set |
| `actual_effort_metric` | varchar(3) | `RPE`/`RIR`; nullable |
| `actual_effort_value` | decimal(3,1) | paired with metric |
| `actual_rest_seconds` | integer | nullable measured duration |
| `status` | varchar | `PENDING`, `COMPLETED`, `SKIPPED` |
| `completed_at` | timestamptz | required iff COMPLETED |
| `notes` | text | nullable |

## 6. Idempotency and sync support

### `mutation_receipts`

| Column | Suggested type | Rules |
| --- | --- | --- |
| `operation_id` | UUID | PK; supplied by client |
| `user_id` | UUID | FK users; required |
| `aggregate_type` | varchar | e.g. `WORKOUT_SESSION` |
| `aggregate_id` | UUID | required |
| `result_version` | integer | version after mutation |
| `processed_at` | timestamptz | required |

The server checks this table before applying a retried operation. Retention must exceed the maximum supported offline retry window; deleting receipts too early can recreate duplicate mutations.

IndexedDB `SyncOperation` records remain client-local and are not duplicated as a server queue table.

## 7. Referential actions

| Relationship | Recommended action | Reason |
| --- | --- | --- |
| User → owned catalog/plans/sessions | RESTRICT in normal operations | avoid accidental account-wide deletion |
| Exercise/Muscle → planning rows | RESTRICT; archive source | plans must not become dangling |
| Template → RoutineDay | RESTRICT while referenced; archive | preserve active plan structure |
| Planning source → Session provenance FK | SET NULL only if exceptional purge is authorized | snapshot remains complete without source |
| Session → SessionExercise → SessionSet | internal cascade only for failed uncommitted creation; soft delete after completion | protect History |
| SessionExercise → muscle snapshot rows | CASCADE within same Session aggregate | snapshot child has no independent lifecycle |

Hard deletion of completed Session data is an administrative retention operation outside normal MVP flows.

## 8. Recommended indexes

- `workout_templates(user_id, archived_at, updated_at desc)`
- `template_exercises(template_id, sequence_no)` unique
- `template_set_prescriptions(template_exercise_id, sequence_no)` unique
- `routine_days(routine_id, sequence_no)` unique
- `workout_sessions(user_id, started_at desc)` excluding soft-deleted rows for History
- `workout_sessions(user_id, status)` for Today/Active Session resolution
- `workout_session_exercises(session_id, sequence_no)` unique
- `workout_session_sets(session_exercise_id, sequence_no)` unique
- `workout_session_sets(status, completed_at)` only if Progress query plan demonstrates need
- `workout_session_exercises(source_exercise_id, session_id)` for Exercise History/Progress
- `mutation_receipts(user_id, processed_at)` for retention cleanup

Do not add analytics indexes speculatively; validate them against real query plans after implementation.

## 9. Snapshot transaction boundary

Start Workout must execute as one logical transaction:

1. Lock or consistently read User’s active-session state
2. Resolve RoutineDay and Template at expected revisions
3. Validate that all referenced Exercises/Sets are usable
4. Insert WorkoutSession with snapshot headers
5. Copy ordered SessionExercises, muscle snapshots and SessionSets
6. Set owner device and ACTIVE status
7. Record idempotency receipt
8. Commit; otherwise roll back every inserted row

No caller may observe an ACTIVE Session with missing snapshot children.

## 10. Schema trade-offs

| Option | Chosen approach | Why / consequence |
| --- | --- | --- |
| JSON snapshot vs normalized rows | Normalized Session tables | safer queries/constraints; more tables and migrations |
| Native DB enums vs codes | constrained varchar codes | portable and easier additive changes; application/database rules must stay aligned |
| Failure as enum vs modifier | `set_kind_code` + `is_to_failure` | supports drop-to-failure; requires cross-field validation |
| One `set_count` vs set rows | set rows only | no count drift; more records |
| Convert weight at query vs write | preserve input + canonical kg at write | fast stable metrics; paired values can diverge if write path is bypassed |
| Full event sourcing vs current state | current state + version/edit marker | MVP complexity stays bounded; no full historical diff of retrospective edits |
| Duplicate Muscle snapshots vs live join | snapshot names per SessionExercise | exact History; deliberate denormalization |

## 11. Not created by this document

- No SQL DDL, migrations, database instance or seed script
- No ORM models or generated types
- No vendor-specific row-level security policy
- No IndexedDB schema implementation
- No Progress materialized view or cache table
