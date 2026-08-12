# Personal Workout Tracking Web App — Project Roadmap Tracker

**สถานะล่าสุด:** 12 สิงหาคม 2026

**Baseline:** commit `847960f`

**Current focus:** M-05A — Workout History

**MVP target:** M-01 ถึง M-07 ผ่าน Definition of Done

เอกสารนี้เป็น living roadmap สำหรับติดตามงานตั้งแต่เริ่มโครงการจนพร้อมใช้งานจริง ส่วนรายละเอียดสถาปัตยกรรมและเหตุผลของแต่ละ milestone ให้อ้างอิง [Development Roadmap](development-roadmap.md)

## 1. วิธีใช้เอกสารนี้

### สถานะ

| สถานะ | ความหมาย |
| --- | --- |
| `DONE` | implementation และเกณฑ์ตรวจสอบของขอบเขตนั้นผ่านแล้ว |
| `PARTIAL` | มีบางส่วนใช้งานได้ แต่ยังไม่ผ่าน exit criteria ทั้งหมด |
| `NEXT` | งานลำดับถัดไปที่ควรเริ่ม |
| `PENDING` | ยังไม่เริ่มหรือยังเป็น placeholder |
| `DEFERRED` | อยู่นอก MVP และห้ามดึงเข้ามาโดยไม่ปรับ scope |
| `BLOCKED` | เริ่มไม่ได้จนกว่าจะมีการตัดสินใจหรือ dependency ครบ |

กติกาการอัปเดต:

1. อัปเดตวันที่, Current focus และตารางภาพรวมทุกครั้งที่ปิด milestone
2. เปลี่ยน checkbox เป็น `[x]` เมื่อมีหลักฐานตรวจสอบแล้วเท่านั้น
3. เพิ่มลิงก์ commit หรือ PR ใน Milestone Log หลังส่งมอบแต่ละช่วง
4. ให้มี `NEXT` เพียง milestone เดียว
5. ถ้า scope เปลี่ยน ให้อัปเดต [Product Requirements](product-requirements.md), [User Flows](user-flows.md) และ roadmap นี้พร้อมกัน

## 2. Product objective และขอบเขต

สร้าง private, strength-first workout tracker สำหรับ owner คนเดียว โดย:

- Desktop/laptop ใช้วางแผน Routine และดู History/Progress
- Phone ใช้เริ่มและบันทึก Workout อย่างรวดเร็วด้วยมือเดียว
- Session ที่เริ่มแล้วต้องรักษา snapshot แม้ Template/Routine ภายหลังเปลี่ยน
- Active Workout ต้องทนต่อ refresh, browser restart และ network interruption
- MVP ใช้ Supabase, relational data, authenticated RLS และ modular monolith

MVP ครอบคลุม Exercise Library, Workout Templates, Routine, Today, Active Workout, History, Basic Progress, Settings/Sync visibility, responsive UX และ release operations

นอก MVP: cardio-specific tracking, calendar scheduling, coaching, live multi-device editing, social features, wearable integrations และ ExerciseDB media integration

## 3. ภาพรวมสถานะ

| Milestone | สถานะ | ผลลัพธ์หลัก | Dependency |
| --- | --- | --- | --- |
| M-00 Product & Design Definition | `DONE` | Requirements, flows, IA, design, domain และ data rules | — |
| M-01 Foundation & Private Auth | `PARTIAL` | App shell, Supabase local, auth และ design foundation ใช้งานได้ | M-00 |
| M-02 Exercise Library & Planning | `DONE` | Exercise → Template → Routine → Activate ทำงานจริง | M-01 |
| M-03 Today & Online Workout Execution | `DONE` | Start/Resume → Log → Finish/Discard ทำงานแบบ online-first | M-02 |
| M-04 Offline Reliability & Ownership | `DONE` | Offline Set mutations, idempotent Session lifecycle, conflict recovery, remote abandon และ P-13 sync visibility | M-03 |
| M-05A Workout History | `PENDING` | Completed Session list/detail/edit/delete | M-03, M-04 contracts |
| M-05B Basic Progress | `PENDING` | Volume, e1RM, PR และ Exercise trends | M-05A |
| M-06 Responsive & Accessibility QA | `PARTIAL` | Cross-device and accessibility release quality | M-02–M-05 |
| M-07 Release Hardening | `PENDING` | Production deploy, security, backup และ observability | M-01–M-06 |

### งานสามลำดับถัดไป

1. สร้าง Workout History list/detail/edit/delete ใน M-05A
2. คำนวณ Basic Progress, volume, e1RM, PR และ exercise trends ใน M-05B
3. ปิด responsive/accessibility QA และ release hardening ใน M-06–M-07

## 4. M-00 — Product and Design Definition

**Status:** `DONE`

- [x] Product requirements, MVP boundary และ acceptance criteria
- [x] User flows UF-01–UF-11
- [x] Information architecture และ page inventory P-01–P-13
- [x] Swiss dark design system และ responsive rules
- [x] Domain model, logical database schema และ data consistency rules
- [x] Development milestones และ traceability
- [x] Contributor guide และ local Supabase setup

**Evidence:** เอกสารหลักทั้งหมดใน `docs/` และ commits `822a179`–`a94afc9`

**Exit criteria:** คำศัพท์ Exercise, Workout Template, Routine, Active Session และ Completed Session สอดคล้องกัน และ snapshot เป็น business rule กลางของระบบ

## 5. M-01 — Foundation and Private Auth

**Status:** `DONE`

### เสร็จแล้ว

- [x] React, TypeScript, Vite, Tailwind และ strict typecheck
- [x] CSS variables, typography, 4/8/12-column grid และ shared UI primitives
- [x] Responsive shell: desktop sidebar, tablet navigation และ mobile bottom navigation
- [x] Supabase local stack, migrations, seed และ setup instructions
- [x] Private email/password login, persistent session และ protected routes
- [x] Browser-safe publishable key; ไม่มี service-role key ใน client
- [x] Base unit, integration และ Playwright test commands

### ยังต้องปิดก่อน release

- [ ] เพิ่ม web app manifest, icons และ installability criteria
- [ ] เพิ่ม service worker/offline application shell โดยไม่ cache private API responses ผิดนโยบาย
- [ ] กำหนด development/staging/production environment strategy
- [ ] เพิ่ม application error reporting และ server mutation observability
- [ ] เขียน production backup/restore runbook และทดสอบ restore
- [ ] อัปเดต README Current Status ให้ตรงกับ implementation ล่าสุด

**Exit criteria:** Owner login เข้า protected installable shell ได้, unauthorized access ถูกปฏิเสธ, production configuration ไม่มี secret รั่ว และมีหลักฐาน restore/observability ก่อนเปิดใช้จริง

## 6. M-02 — Exercise Library and Planning

**Status:** `DONE`

### Exercise Library — P-03/P-04

- [x] Starter catalog 50 Exercises พร้อม muscles, equipment และ notes
- [x] Search, muscle/equipment/status filters และ pagination
- [x] Responsive desktop table และ mobile list
- [x] Create/Edit Custom Exercise พร้อม accessible validation
- [x] Archive แทน hard delete; Starter read-only
- [x] Loading, updating, empty, error และ retry states
- [x] Dirty-form confirmation และ responsive action bar

### Planning — P-05/P-06

- [x] Create/Edit/Duplicate/Archive Workout Template
- [x] Ordered Exercises และ per-set targets: reps, weight, RPE/RIR และ rest
- [x] Create/Edit Routine พร้อม ordered days และ weekly frequency
- [x] Single Active Routine, Activate/Inactive และ revision conflict handling
- [x] ป้องกัน archive invalid references และ archived Exercise warnings
- [x] Focused Routine Editor และ step-based mobile Template Editor
- [x] Today preview resolve ตาม Routine sequence

**Evidence:** migrations `202608080003`–`202608100001`, repository/unit/database/E2E tests และ commits `ef8a3ab`, `f44944f`, `847960f`

**Exit criteria:** สร้าง Template → Routine A/B/C → Activate → Today แสดงลำดับ A ได้ และการแก้แผนไม่แก้ Session snapshot

## 7. M-03 — Today and Online Workout Execution

**Status:** `DONE`

- [x] Today state resolution: Active Session → Planned → No Routine
- [x] Planned และ Ad-hoc Start พร้อมป้องกัน double submit
- [x] Transactional Template/Routine snapshot
- [x] Single Active Session และ owner-device enforcement
- [x] Responsive Active Workout workspace
- [x] Complete/Edit/Skip/Add/Delete/Reorder Set
- [x] Add/Remove/Reorder Exercise และ Session/Exercise notes
- [x] Weight decimals, KG/LB representation และ optional RPE/RIR
- [x] Previous-session values และ fast repeat defaults
- [x] Rest timer: running, pause, reset และ skip
- [x] Acknowledged session, drafts, position และ timer cache ใน IndexedDB
- [x] Finish/Discard และ atomic Routine advancement
- [x] Completion Summary จาก Session จริง
- [x] Today next-action-first redesign และ accessible Ad-hoc dialog
- [x] Snapshot isolation, RLS, owner device และ lifecycle database tests

**Evidence:** migrations `202608080008`–`202608100001`, 54 unit tests และ 14 Playwright tests ผ่าน ณ commit `847960f`

**Boundary:** Start และทุก mutation ยังต้อง online; IndexedDB ยังเป็น cache ไม่ใช่ authoritative offline journal

**Exit criteria:** Online planned/ad-hoc flows จบได้ครบ, Discard ไม่เลื่อน Routine, Finish เลื่อนครั้งเดียว และ Template edit ไม่เปลี่ยน snapshot

## 8. M-04 — Offline Reliability and Device Ownership

**Status:** `DONE`

**Recommended decision:** Start Workout ต้อง online แต่เมื่อมี Active Session แล้ว ให้ Log/Edit/Finish/Discard ระหว่าง offline ได้ ขอบเขตนี้ลดความเสี่ยงและไม่ต้อง resolve Routine/Template จาก cache เพื่อสร้าง Session ใหม่

### M-04.1 Contract and local data model

**Status:** `DONE`

- [x] ยืนยัน offline boundary และเขียน acceptance scenarios
- [x] กำหนด `SyncOperation`: operation ID, Session ID, device ID, command, base version, timestamps, attempts และ status
- [x] เพิ่ม IndexedDB schema migration โดยรักษา acknowledged cache เดิม
- [x] ทำ local entity update และ journal append ใน transaction เดียว
- [x] กำหนด ordering ต่อ Session และห้าม queue ข้าม conflict

### M-04.2 Offline Set Mutations and Server Idempotency

**Status:** `DONE` — Complete, Edit, Skip, Add และ Delete Set ใช้ local-first queue และ idempotent server effect แล้ว

- [x] เพิ่ม `mutation_receipts` migration ตาม [Database Schema](database-schema.md)
- [x] ให้ mutation RPC รับ stable operation ID
- [x] Complete/Edit/Skip/Add/Delete ใช้ immutable local reducer และ atomic queue append
- [x] Retry operation เดิมต้องคืนผลเดิมและไม่สร้าง/แก้/ลบ Set ซ้ำ
- [x] กำหนด retryable, permanent, authorization และ conflict errors
- [x] Finish/Discard retry ต้อง idempotent และ atomic

### M-04.3 Sync coordinator

**Status:** `DONE` Set mutation queue, Session lifecycle และ authenticated coordinator เสร็จแล้ว

- [x] ส่ง queued operations ตามลำดับเมื่อ online
- [x] ใช้ bounded backoff โดยไม่เปลี่ยน operation ID
- [x] อัปเดต last acknowledged version และ last synced time
- [x] Resume sync หลัง refresh/browser restart
- [x] ป้องกัน response เก่า overwrite local revision ใหม่กว่า
- [x] ป้องกัน logout ที่จะทิ้ง pending operations โดยไม่มีคำเตือน

### M-04.4 UX and recovery

**Status:** `DONE` — conflict recovery, remote abandon, Recovery Archive และ P-13 sync visibility ใช้งานได้

- [x] แสดง `Saved locally`, `Syncing`, `Synced`, `Offline`, `Conflict`
- [x] Active Workout ใช้ Complete/Edit/Skip/Add/Delete Set ต่อได้เมื่อ offline
- [x] Today เปิด cached Active Session ได้โดยไม่เสนอ Start ซ้ำ
- [x] Non-owner device ปิด mutation controls ทั้ง client และ server
- [x] Conflict screen แสดง local/server summary โดยไม่มี last-write-wins
- [x] เพิ่ม explicit remote abandon พร้อม destructive confirmation
- [x] P-13 แสดง queue count, last sync, retry และ recovery guidance

### M-04.5 Verification

**Status:** `DONE` for M-04 Offline Reliability and Recovery

- [x] Unit: operation ordering, reducers, retry classification และ backoff
- [x] Integration/E2E: IndexedDB migration และ atomic local write/journal
- [x] Database: receipt uniqueness, RLS, Set mutation idempotent retry และ version conflict
- [x] E2E: offline Set mutations → refresh/reconnect → ordered sync ครั้งเดียว
- [x] E2E: offline Finish และ Discard ไม่เลื่อน Routine ซ้ำ
- [x] E2E: other-device conflict และ remote abandon
- [x] Corrupt queue ต้องรักษาข้อมูลต้นฉบับและแสดง recovery state

**Exit criteria:** network interruption หรือ browser restart ไม่ทำให้ SetLog สูญหายหรือซ้ำ, non-owner mutation ถูกปฏิเสธ และ conflict ไม่ overwrite ข้อมูลเงียบ ๆ

## M-04.4 completion note

**Status:** `DONE` for the Session lifecycle slice.

- Finish and Discard now use the local-first queue with a terminal barrier.
- Lifecycle operations use the existing mutation receipt and idempotent RPC contract.
- Today and Completion Summary preserve terminal-pending local state until acknowledgement.
- Database coverage verifies exactly-once Finish, no Routine advancement on Discard, retry behavior, and terminal-state rejection.
- Conflict comparison/rebase, remote abandon, logout warnings และ P-13 Sync Status เสร็จแล้ว โดยไม่ใช้ automatic merge หรือ last-write-wins

## 9. M-05A — Workout History

**Status:** `PENDING` — หน้า P-09/P-10 ปัจจุบันเป็น static placeholder

- [ ] เพิ่ม History domain/repository แยกจาก Workout Execution commands
- [ ] List Completed Sessions ใหม่ไปเก่า พร้อม pagination/filter ตามช่วงเวลา
- [ ] Session Detail แสดง snapshot, exercises, sets, notes และ edit marker
- [ ] Retrospective Edit ใช้ validation เดียวกับ Workout sets
- [ ] Soft delete พร้อมผลกระทบต่อ Progress และ confirmation
- [ ] Archived Exercises ยังแสดง snapshot name เดิม
- [ ] History mutation online-only และใช้ expected revision
- [ ] Loading, empty, updating, error, conflict และ success states
- [ ] Responsive desktop table/mobile labeled list
- [ ] Repository, database และ E2E tests

**Exit criteria:** Completed Session ทุกค่าตรวจย้อนกลับได้; edit/delete ไม่กระทบ Template และ soft-deleted Session หายจาก History ปกติ

## 10. M-05B — Basic Progress

**Status:** `PENDING` — หน้า P-11/P-12 และ chart ปัจจุบันเป็น static placeholder

- [ ] กำหนด progress query/read model จาก Completed working sets เท่านั้น
- [ ] Volume = canonical weight × reps
- [ ] Estimated 1RM ใช้ Epley เฉพาะ 1–10 reps
- [ ] Best weight, best reps at weight และ PR detection
- [ ] Exercise trends พร้อมช่วงเวลาและ source-session links
- [ ] Warm-up, discarded และ soft-deleted Sessions ไม่เข้าการคำนวณ
- [ ] History edit/delete invalidate หรือคำนวณผลใหม่
- [ ] KG/LB display conversion ไม่แก้ canonical/source value
- [ ] Empty/recalculating/error/stale states
- [ ] Accessible chart summary/table alternative
- [ ] Unit, query, invalidation และ E2E tests

**Exit criteria:** ทุก metric trace กลับ Session ได้ และ edit/delete ทำให้ผลลัพธ์ใหม่ถูกต้องโดยไม่มีค่าค้าง

## 11. M-06 — Responsive and Accessibility QA

**Status:** `PARTIAL` — P-02–P-07 ผ่าน redesign หลักแล้ว แต่ P-08–P-13 ยังไม่ครบ

- [x] Swiss dark tokens, grid, typography และ minimal-shadow primitives
- [x] Today, Exercise, Planning และ Active Workout responsive composition
- [x] Visible focus, 44px controls และหลักการ dialog focus trap ใน core flows
- [ ] Audit ทุก P-01–P-13 ที่ 320, 360, 600, 768, 1024, 1280 และ 1600px
- [ ] ตรวจ keyboard-only, screen reader names และ focus order
- [ ] ตรวจ WCAG 2.2 AA contrast และ non-color status cues
- [ ] ตรวจ reduced motion และ timer feedback
- [ ] ตรวจ mobile keyboard/safe-area กับทุก sticky action
- [ ] เพิ่ม chart alternative และ accessible data table
- [ ] ตรวจภาษาไทย/อังกฤษ, terminology และข้อความ implementation ที่หลุดสู่ UI
- [ ] Cross-browser smoke: Chromium, Firefox และ WebKit

**Exit criteria:** Core flows ใช้ keyboard/touch ได้, ไม่มี horizontal overflow, focus ไม่หาย และข้อมูลสำคัญเข้าถึงได้โดยไม่พึ่งสีหรือกราฟเพียงอย่างเดียว

## 12. M-07 — Release Hardening

**Status:** `PENDING`

- [ ] เลือก production hosting และ Supabase project
- [ ] สร้าง production owner account และยืนยัน public registration ปิด
- [ ] Apply migrations บน staging แล้ว production ด้วย documented procedure
- [ ] Audit RLS, grants, browser keys และ secret scanning
- [ ] เพิ่ม error reporting, sync telemetry และ privacy-safe logs
- [ ] เปิด automated backups และทำ restore rehearsal
- [ ] กำหนด retention, account recovery และ incident procedure
- [ ] ตรวจ performance budget และ production bundle
- [ ] รัน full regression, DB tests และ manual device smoke
- [ ] ทำ release checklist, version/tag และ rollback instructions

**Exit criteria:** deploy ซ้ำได้, restore ได้จริง, secrets ไม่รั่ว, RLS ป้องกัน cross-user access และ owner ทำ core flow บน production ได้ครบ

## 13. Requirement traceability

| Requirement | Flow | Pages | Milestone | สถานะ |
| --- | --- | --- | --- | --- |
| FR-AU-01–03 | UF-01 | P-01, P-13 | M-01, M-07 | `PARTIAL` |
| FR-EX-01–04 | UF-02 | P-03, P-04 | M-02 | `DONE` |
| FR-PL-01–05 | UF-03 | P-05, P-06 | M-02 | `DONE` |
| FR-TD-01–04 | UF-04, UF-05 | P-02 | M-02, M-03 | `DONE` |
| FR-AW-01–07 | UF-05–07 | P-07, P-08 | M-03 | `DONE` online |
| FR-AW-08–09 | UF-06, UF-08, UF-09 | P-07, P-13 | M-04 | `DONE` |
| FR-AW-10–11 | UF-07 | P-02, P-07, P-08 | M-03, M-04 | `DONE` |
| FR-HI-01–05 | UF-10 | P-09, P-10 | M-05A | `PENDING` |
| FR-PR-01–05 | UF-11 | P-11, P-12 | M-05B | `PENDING` |
| FR-ST-01–03 | UF-06, UF-08, UF-09 | P-07, P-13 | M-03–M-05 | `PARTIAL` |
| NFR-01–02, 09 | ทุก core flow | P-01–P-13 | M-01, M-06 | `PARTIAL` |
| NFR-03–04 | UF-05–09 | P-02, P-07, P-13 | M-04 | `DONE` |
| NFR-05–08 | UF-01, UF-08–11 | ทุก protected page | M-01, M-07 | `PARTIAL` |

## 14. Quality gates

### ทุก feature slice

- [ ] Requirement, business rule และ out-of-scope ชัดเจนก่อนแก้ code
- [ ] UI เรียกข้อมูลผ่าน repository interface
- [ ] Supabase responses ผ่าน runtime validation
- [ ] RLS/authorization และ expected revision ถูกทดสอบ
- [ ] Loading, empty, error, offline/conflict และ success ที่เกี่ยวข้องครบ
- [ ] Unit, repository/database และ primary E2E flow ผ่าน
- [ ] ไม่มี horizontal overflow ที่ 320px และ focus มองเห็นได้
- [ ] ไม่มี credential, production data หรือ health information ใน Git/log
- [ ] Documentation และ roadmap อัปเดตพร้อม implementation

### คำสั่งตรวจมาตรฐาน

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec supabase db lint --local
pnpm exec supabase test db
pnpm test:e2e
git diff --check
```

การเปลี่ยน migration ต้องตรวจ `supabase db reset` บนฐาน local ที่ยอมล้างข้อมูลได้ และ `supabase db push --local` บนฐานที่ต้องรักษาข้อมูล

## 15. Definition of Done สำหรับ MVP

MVP ถือว่าเสร็จเมื่อ:

- M-01 ถึง M-07 ไม่มีสถานะ `PARTIAL`, `NEXT`, `PENDING` หรือ `BLOCKED`
- Owner ทำ flow Login → Exercise → Template → Routine → Today → Workout → History → Progress ได้ครบ
- Active Workout ทำต่อได้เมื่อ offline และ sync โดยไม่สูญหายหรือซ้ำ
- Snapshot เก่าไม่เปลี่ยนตาม Template/Routine ปัจจุบัน
- History edit/delete ทำให้ Progress คำนวณใหม่ถูกต้อง
- Core flows ผ่าน mobile, tablet, desktop, keyboard และ accessibility gates
- Production RLS, backup/restore, monitoring และ rollback ผ่านการทดสอบ

## 16. Milestone log

| วันที่ | Milestone | Commit/หลักฐาน | หมายเหตุ |
| --- | --- | --- | --- |
| 8 ส.ค. 2026 | M-00/M-01 foundation | `822a179`, `a94afc9` | เอกสาร, app shell, auth และ Supabase Exercise slice |
| 8–10 ส.ค. 2026 | M-02 | `ef8a3ab`, `f44944f` | Planning, starter catalog และ UX redesign |
| 10 ส.ค. 2026 | M-03 | `847960f` | Online execution, Today redesign, migrations และ regression tests |
| — | M-04 | — | Completed; next M-05A |
| — | M-05A/M-05B | — | History และ Progress |
| — | M-06/M-07 | — | QA และ production release |

## 17. Future backlog

รายการต่อไปนี้เป็น `DEFERRED` จนกว่า MVP Definition of Done จะผ่าน:

- Exercise media จาก external API
- Cardio-specific metrics และ GPS
- Calendar/day-of-week scheduling
- Coaching, recommendations และ auto-progression
- Live multi-device editing หรือ automatic merge
- Social sharing, public profiles และ multi-user accounts
- Wearables, Apple Health, Google Health Connect และ notifications ขั้นสูง
