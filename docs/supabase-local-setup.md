# Supabase Local Setup

Exercise Library ใช้ Supabase Postgres, REST API และ Auth โดย browser รับเฉพาะ publishable key เท่านั้น ห้ามใส่ secret หรือ service-role key ใน `.env.local`, source code หรือ Git

## 1. Start local services

เปิด Docker Desktop ให้ engine ทำงาน แล้วรันจาก repository root:

```powershell
pnpm exec supabase start
pnpm exec supabase db reset
```

หลังแก้ `supabase/config.toml` ให้ restart services หนึ่งครั้ง:

```powershell
pnpm exec supabase stop
pnpm exec supabase start
```

Local endpoints หลักคือ API `http://127.0.0.1:54321` และ Studio `http://127.0.0.1:54323`

## 2. Configure the browser

สร้าง `.env.local` ซึ่งถูก Git ignore:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key จาก pnpm exec supabase status>
```

อย่าใช้ค่าที่ระบุว่า `Secret` หรือ `service_role` กับตัวแปร `VITE_*`

## 3. Create the private owner

Public signup ถูกปิดไว้ด้วย `auth.enable_signup = false` ตาม product requirements แต่ email provider ยังคงเปิดเพื่อให้ owner login ด้วย email/password ได้ ให้สร้าง owner ผ่าน Studio เท่านั้น:

1. เปิด `http://127.0.0.1:54323`
2. ไปที่ **Authentication → Users → Add user**
3. ใส่อีเมลและรหัสผ่านสำหรับ local development
4. เปิด **Auto Confirm User** แล้วบันทึก

ข้อมูลบัญชีนี้อยู่ใน local Docker เท่านั้น และอาจหายเมื่อหยุด Supabase พร้อมลบ volumes ห้าม commit รหัสผ่านลง repository

## 4. Run and test the real flow

```powershell
pnpm dev
```

เปิด `http://localhost:5173` แล้วตรวจตามลำดับ:

1. ระบบส่งไปหน้า Login เมื่อยังไม่มี session
2. Login ด้วย owner ที่สร้างไว้ แล้วเปิด **Exercises**
3. ต้องเห็น Starter Exercises 50 รายการ จาก catalog ที่รวม Parallel Bar Dips และรายการที่ซ้ำข้ามกลุ่มใช้ record เดียว
4. สร้าง Custom Exercise แล้ว refresh หน้า; รายการต้องยังอยู่
5. เปิดรายละเอียด แก้ข้อมูล และบันทึก
6. Archive รายการ แล้วตรวจด้วยตัวกรอง Archived
7. ไปที่ Settings และออกจากระบบ; protected routes ต้องกลับไป Login

รัน automated checks ด้วย `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` และ `pnpm test:e2e` เมื่อ dev server พร้อม

## Migration policy

### Planning module local checks

Migrations `202608080003_planning.sql` through `202608080005_planning_constraint_names.sql` create the Template, Routine, ordered child tables and integrity constraints. Migrations `202608080006_starter_exercise_catalog.sql` and `202608080007_parallel_bar_dips.sql` add the expanded starter exercise catalog. After pulling them, apply pending migrations incrementally (or reset a disposable local database so all migrations and starter exercises are applied):

```powershell
pnpm exec supabase db push --local
# For a disposable local database only:
pnpm exec supabase db reset
```

The browser only calls authenticated REST/RPC endpoints. Create a Template from **Plans → สร้าง Template**, add one or more Starter Exercises, save it, then create a Routine and add the saved Template as an ordered day. `Activate` must make that Routine the only active Routine; **Today** should then show its next Template. Empty Templates can be saved, but a Routine cannot be saved or activated until every referenced Template has at least one Exercise with a prescription.

For database-level checks, run the migration reset first and inspect policies and constraints in Studio’s SQL editor while authenticated. Verify that a second active Routine is rejected, that an archived Template referenced by a non-archived Routine cannot be archived, and that activating a Routine resets `next_workout_index` to `0`. The UI maps revision conflicts, authorization failures, validation failures and offline errors to explicit states.

Planning mutations are online-only in this slice. Active Workout snapshot, session ownership and offline workout writes are deferred to M-03; do not add a Start Workout action to the Today preview until that milestone.

### Starter exercise catalog

Migrations `202608080006_starter_exercise_catalog.sql` and `202608080007_parallel_bar_dips.sql` expand the starter catalog to 50 unique exercises covering the requested chest, back, arms, legs and core placements, including standard Parallel Bar Dips. They preserve the original six starter UUIDs, keep starter rows ownerless, and replace secondary-muscle rows in sequence. Apply and validate them with:

```powershell
pnpm exec supabase db push --local
pnpm exec supabase db lint --local
pnpm exec supabase test db
```

The same catalog is included in `supabase/seed.sql` for fresh local databases. Stable IDs make the seed safe to rerun; conflicting starter names fail instead of overwriting another exercise, and unchanged metadata does not increment `version`.

### M-03 workout execution

Migration `202608080008_workout_execution.sql` adds the device registry, workout
session snapshot tables, owner-device checks, and transactional RPCs for start,
set commands, finish, and discard. Migration
`202608080009_active_session_plan_guard.sql` blocks changes to an active Routine
while its session is running. Apply both with the normal local reset/push flow:

```powershell
pnpm exec supabase db reset
pnpm exec supabase db lint --local
pnpm exec supabase test db
```

The browser registers a stable installation id before Start/Resume. The
`fitness-workout-device-id` value is not a secret and may be removed to simulate
a new device. Start, set mutations, Finish, and Discard require a live
authenticated connection and are confirmed by the RPC response. IndexedDB keeps
only the last acknowledged session, input drafts, current exercise, and the
device-local rest timer; it is not an offline mutation queue in M-03.

To verify the flow, login with the local owner, activate a Routine, open Today,
start its next Template, complete a set, refresh, and finish. A second browser
installation can read the active snapshot but cannot mutate it. Template edits
after Start must not change the session snapshot. Run `pnpm test:e2e` for the
mobile execution and refresh coverage.

### M-04 offline recovery

Migration `202608120003_workout_conflict_recovery.sql` adds the authenticated
`workout_remote_abandon_session` RPC. It is receipt-backed and changes an
Active Session to Discarded without advancing a Routine; it does not require
the requesting browser to be the owner device. The browser archives its local
copy before clearing a conflict queue. P-13 displays queue health, conflict
comparison, recovery archive export, and logout warnings. Apply and verify the
complete local stack with:

```powershell
pnpm exec supabase db reset
pnpm exec supabase db lint --local
pnpm exec supabase test db
```

Recovery JSON exports contain only local workout data and operation metadata;
they never include access tokens or service-role credentials.

เพิ่ม migration ใหม่แบบ timestamped ใต้ `supabase/migrations/`; ห้ามแก้ migration ที่ถูกใช้งานแล้ว Seed catalog ใน `supabase/seed.sql` ต้องรันซ้ำได้ Mutation RPC อนุญาตเฉพาะ `authenticated`; RLS ตรวจว่า `owner_user_id = auth.uid()`
