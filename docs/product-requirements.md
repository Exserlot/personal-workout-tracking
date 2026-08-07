# Personal Workout Tracking Web App — Product Requirements

**สถานะ:** MVP specification  
**ผู้ใช้หลัก:** Owner account หนึ่งคน  
**กรอบการพัฒนา:** Solo development 6–8 สัปดาห์  
**เอกสารที่เกี่ยวข้อง:** [User Flows](user-flows.md) · [Information Architecture](information-architecture.md) · [Development Roadmap](development-roadmap.md)

## 1. Product vision

สร้างเว็บแอปส่วนตัวสำหรับวางแผน บันทึก และติดตามการฝึกเวทอย่างเป็นระบบ โดยให้ผู้ใช้วางแผนและวิเคราะห์ข้อมูลบนจอใหญ่ แต่บันทึกเซ็ตบนโทรศัพท์ได้รวดเร็ว เชื่อถือได้ และไม่สูญหายเมื่อสัญญาณอินเทอร์เน็ตไม่เสถียร

ผลิตภัณฑ์นี้แก้ปัญหาการกระจายข้อมูลระหว่างโน้ต ตารางคำนวณ และแอปจับเวลา ด้วยการทำให้ Routine, Workout Session, History และ Progress ใช้ข้อมูลชุดเดียวกัน

## 2. Target user และบริบทการใช้

### 2.1 Primary user

- ผู้ใช้คนเดียวซึ่งเป็นเจ้าของข้อมูลและระบบ
- ฝึกเวทโดยใช้ sets, weight, reps และ RIR เป็นข้อมูลหลัก
- ต้องการติดตาม progressive overload ราย Exercise
- ยังไม่ต้องการ social, trainer-client หรือ community features

### 2.2 Device context

| อุปกรณ์ | งานหลัก | UX priority |
| --- | --- | --- |
| Desktop / laptop | สร้าง Exercise, Workout Template, Routine และดูสถิติ | information density, keyboard support, comparison |
| Tablet | วางแผนหรือบันทึก workout ตามสถานการณ์ | adaptive one/two-column layout |
| Phone | เปิด Today’s Workout และบันทึกระหว่างฝึก | speed, touch accuracy, offline reliability |

## 3. Goals และ success criteria

### 3.1 Product goals

1. ผู้ใช้สร้างและเปิดใช้ Routine แรกได้โดยไม่ต้องเตรียม Exercise Library เองทั้งหมด
2. ผู้ใช้เห็น workout ถัดไปทันที โดยไม่ต้องจัดตารางใหม่เมื่อพลาดวันฝึก
3. ผู้ใช้บันทึก working set ได้ในหน้าจอเดียวและอ้างอิงผลงานครั้งก่อนได้
4. Active Workout รอดจาก reload, ปิดแท็บ และการขาดอินเทอร์เน็ตชั่วคราว
5. History เป็นแหล่งข้อมูลเดียวสำหรับ Progress และคำนวณใหม่เมื่อข้อมูลย้อนหลังเปลี่ยน

### 3.2 MVP success criteria

- ไม่มี Active Workout data สูญหายจากการ reload หรือ offline/online transition ใน acceptance tests
- การ retry sync operation เดิมไม่สร้าง Exercise, Session หรือ SetLog ซ้ำ
- ผู้ใช้เริ่มหรือกลับเข้าสู่ workout ที่ค้างได้จาก Today ภายในหนึ่ง primary action
- ทุก MVP requirement มี flow, page, milestone และ test ที่ trace ได้จาก [Development Roadmap](development-roadmap.md#9-cross-document-traceability)
- Core flows ใช้งานได้บน phone portrait, tablet และ desktop โดย layout เปลี่ยนโครงสร้างตามอุปกรณ์

## 4. Product terminology

| Term | ความหมายมาตรฐาน |
| --- | --- |
| Exercise | ท่าฝึกจาก Starter Library หรือท่าที่ผู้ใช้สร้างเอง |
| Workout Template | แบบฝึกที่เก็บลำดับ Exercise และ target sets/reps/RIR/rest |
| Routine | ลำดับ Workout Templates พร้อมเป้าหมายจำนวนครั้งต่อสัปดาห์ |
| Active Routine | Routine เดียวที่ใช้ resolve Today’s Workout |
| Workout Session | เหตุการณ์ฝึกจริงที่สร้างจาก Template snapshot หรือเริ่มแบบ ad-hoc |
| Active Session | Workout Session ที่เริ่มแล้วแต่ยังไม่ completed หรือ discarded |
| Completed Session | Workout Session ที่จบแล้วและนำไปคำนวณ History/Progress |
| Owner device | อุปกรณ์ที่เริ่ม Active Session และมีสิทธิ์แก้ session นั้น |
| Working set | เซ็ตหลักที่นำไปคำนวณ volume, estimated 1RM และ PR |
| Warm-up set | เซ็ตเตรียมความพร้อมที่เก็บใน History แต่ไม่นำไปคำนวณ Progress |

## 5. Functional requirements

### 5.1 Authentication และ account

- **FR-AU-01 — Private owner login:** ระบบต้องใช้ managed authentication และอนุญาตเฉพาะ owner account ที่เตรียมไว้
- **FR-AU-02 — Closed registration:** MVP ต้องไม่มี public registration, invitation หรือ password sharing flow
- **FR-AU-03 — Persistent session:** ผู้ใช้ที่ผ่านการยืนยันตัวตนแล้วต้องกลับเข้าแอปบนอุปกรณ์เดิมได้โดยไม่ต้อง login ใหม่ทุกครั้ง ภายใต้นโยบายของ auth provider

### 5.2 Exercise Library

- **FR-EX-01 — Starter Library:** ระบบต้องมีรายการท่าพื้นฐานที่ค้นหาได้ พร้อมชื่อ primary muscle, secondary muscles และ equipment
- **FR-EX-02 — Search and filter:** ผู้ใช้ต้องค้นหาด้วยชื่อและกรองตาม muscle/equipment ได้
- **FR-EX-03 — Custom Exercise:** ผู้ใช้ต้องสร้างและแก้ Exercise ส่วนตัวได้ โดยชื่อห้ามว่างและต้องไม่ซ้ำแบบ case-insensitive ภายใน owner account
- **FR-EX-04 — Archive:** Exercise ที่ถูกอ้างอิงโดย Template หรือ Session ต้อง archive แทน hard delete และยังแสดงชื่อเดิมใน History

### 5.3 Workout Plans และ Routine

- **FR-PL-01 — Template management:** ผู้ใช้ต้องสร้าง แก้ duplicate archive และเรียง Exercise ใน Workout Template ได้
- **FR-PL-02 — Exercise targets:** TemplateExercise ต้องกำหนด target set count, rep range, target RIR, rest duration และ optional note ได้
- **FR-PL-03 — Ordered Routine:** Routine ต้องเก็บ Workout Templates เป็นลำดับ เช่น A → B → C พร้อม weekly frequency target จำนวนเต็ม 1–7 ครั้งต่อสัปดาห์
- **FR-PL-04 — Single Active Routine:** มี Active Routine ได้ครั้งละหนึ่งรายการ การ activate รายการใหม่ต้อง deactivate รายการเดิม
- **FR-PL-05 — Stable history:** การแก้หรือ archive Template/Routine ต้องไม่เปลี่ยน Session ที่เริ่มหรือ completed ไปแล้ว

### 5.4 Today’s Workout

- **FR-TD-01 — Resolve next workout:** เมื่อไม่มี Active Session หน้า Today ต้องแสดง Template ตาม `next-workout index` ของ Active Routine โดยไม่พิจารณาวันที่พลาด
- **FR-TD-02 — Resume priority:** เมื่อมี Active Session หน้า Today ต้องแสดง Resume เป็น primary action แทน Start
- **FR-TD-03 — Empty guidance:** ถ้ายังไม่มี Active Routine หน้า Today ต้องแนะนำให้สร้างหรือ activate Routine
- **FR-TD-04 — Ad-hoc entry:** ผู้ใช้ต้องเริ่ม workout เปล่าหรือจาก Template ที่ไม่ใช่รายการถัดไปได้ในฐานะ ad-hoc session

### 5.5 Active Workout

- **FR-AW-01 — Template snapshot:** เมื่อเริ่มจาก Template ระบบต้อง snapshot ชื่อ ลำดับ Exercise และ targets ลง Session ก่อนเปิดให้บันทึก
- **FR-AW-02 — Single Active Session:** Owner account ต้องมี Active Session ได้ครั้งละหนึ่งรายการ
- **FR-AW-03 — Device ownership:** เฉพาะ owner device ที่เริ่ม Session เท่านั้นที่แก้ set, exercise, note หรือสถานะ completed ได้ อุปกรณ์อื่นดู server-synced state ได้แบบ read-only
- **FR-AW-04 — Set logging:** ผู้ใช้ต้องเพิ่ม แก้ complete และลบ SetLog ที่มี set type, weight ตั้งแต่ 0 ขึ้นไป, reps เป็นจำนวนเต็มบวก และ RIR เป็นจำนวนเต็ม 0–10 ได้
- **FR-AW-05 — Fast repeat entry:** ระบบต้องเสนอค่าจาก working set ล่าสุดของ Exercise นั้นเพื่อช่วยกรอก โดยผู้ใช้ต้องยืนยันก่อนบันทึก
- **FR-AW-06 — Session flexibility:** ผู้ใช้ต้องเพิ่ม ลบ และเรียง Exercise หรือปรับจำนวนเซ็ตใน Session ได้ โดยไม่แก้ Template ต้นทาง
- **FR-AW-07 — Rest timer:** เมื่อ complete set ระบบต้องเริ่ม rest timer ตาม target ของ Exercise และให้ pause, reset หรือ skip ได้
- **FR-AW-08 — Durable local state:** ทุก mutation ของ Active Session ต้องบันทึกลง IndexedDB ก่อนถือว่าสำเร็จใน UI
- **FR-AW-09 — Idempotent sync:** Pending operations ต้อง sync เมื่อ online โดย retry ได้และไม่สร้างข้อมูลซ้ำ
- **FR-AW-10 — Exit, finish and discard:** การออกจากหน้าไม่จบ Session; Finish เปลี่ยนเป็น completed; Discard ต้องยืนยันและไม่นำ Session ไปคำนวณ Progress
- **FR-AW-11 — Routine advancement:** Routine เลื่อนไป Template ถัดไปเมื่อ planned Session ถูก completed เท่านั้น; ad-hoc และ discarded Session ไม่เลื่อน Routine

### 5.6 Workout History

- **FR-HI-01 — History list:** ระบบต้องแสดง Completed Sessions เรียงใหม่ไปเก่า พร้อมวันที่ Template/ad-hoc label, duration และ summary
- **FR-HI-02 — Session detail:** ผู้ใช้ต้องดู Exercise, sets, notes และ PR ที่เกิดขึ้นในแต่ละ Session ได้
- **FR-HI-03 — Retrospective edit:** ผู้ใช้ต้องแก้ sets, Exercise และ notes ของ Completed Session ได้ โดยแสดงว่าแก้ย้อนหลังแล้ว
- **FR-HI-04 — Soft delete:** ผู้ใช้ต้อง soft-delete Completed Session หลังยืนยัน; Session ต้องหายจาก History ปกติและไม่ถูกใช้คำนวณ Progress โดย MVP ไม่มี restore UI
- **FR-HI-05 — Progress invalidation:** การแก้หรือลบ Completed Session ต้องทำให้ Progress ที่เกี่ยวข้องถูกคำนวณใหม่

### 5.7 Basic Progress

- **FR-PR-01 — Exercise trends:** ผู้ใช้ต้องเลือก Exercise และดูแนวโน้มตามช่วงเวลาได้
- **FR-PR-02 — Core metrics:** MVP ต้องแสดง best weight, best reps at weight, working-set volume (`weight × reps`) และ estimated 1RM ด้วยสูตร Epley (`weight × (1 + reps / 30)`) สำหรับ working sets 1–10 reps
- **FR-PR-03 — Personal records:** ระบบต้องระบุ PR จาก completed working sets และเชื่อมกลับไปยัง Session ต้นทาง
- **FR-PR-04 — Consistent calculation:** Warm-up sets และ soft-deleted Sessions ต้องไม่ถูกใช้คำนวณ; การแปลงหน่วยต้องไม่เปลี่ยนค่าต้นฉบับ
- **FR-PR-05 — Empty state:** Exercise ที่ยังไม่มี working set ต้องแสดงคำแนะนำแทนกราฟว่าง

### 5.8 Settings และ sync visibility

- **FR-ST-01 — Unit preference:** ค่าเริ่มต้นเป็นกิโลกรัม และผู้ใช้เปลี่ยน display unit ได้โดยไม่แก้ค่ามาตรฐานที่เก็บ
- **FR-ST-02 — Sync status:** ผู้ใช้ต้องเห็นสถานะ synced, pending, offline หรือ conflict และเวลาที่ sync สำเร็จล่าสุด
- **FR-ST-03 — Timer preference:** ผู้ใช้ต้องตั้งค่าเสียง/การสั่นและค่า rest เริ่มต้นได้ภายใต้ความสามารถของ browser

## 6. Business rules และ state model

### 6.1 Business rules

- **BR-01:** Routine ใช้ ordered sequence; การพลาดวันไม่ทำให้ข้าม Template
- **BR-02:** Weekly frequency เป็นเป้าหมายเชิงข้อมูล ไม่ใช่ calendar scheduler
- **BR-03:** Active Routine และ Active Session มีอย่างละไม่เกินหนึ่งรายการต่อ owner account
- **BR-04:** Session snapshot เป็นหลักฐานประวัติและไม่เปลี่ยนตาม Template ภายหลัง
- **BR-05:** Ad-hoc Session ไม่เปลี่ยน `next-workout index`
- **BR-06:** เฉพาะ working sets จาก Completed Sessions ที่ไม่ถูกลบใช้คำนวณ Progress
- **BR-07:** Exercise และ Session ที่ถูกอ้างอิงต้องใช้ archive/soft delete เพื่อรักษาความสมบูรณ์ของ History
- **BR-08:** Server เป็น source of truth สำหรับข้อมูลที่ sync แล้ว; IndexedDB เป็น durable working store สำหรับ Active Session และ pending operations
- **BR-09:** Non-owner device ห้ามแก้ Active Session; การ abandon remote session เป็น explicit administrative action พร้อมคำเตือนและต้องไม่ทับ unsynced local copy

### 6.2 Workout Session states

```text
not-created → active → completed
                    ↘ discarded
```

- `active`: เริ่มแล้ว แก้ได้จาก owner device และ resume ได้
- `completed`: immutable ใน execution flow แต่แก้ย้อนหลังผ่าน History flow ได้
- `discarded`: ไม่อยู่ใน History ปกติและไม่ใช้คำนวณ Progress

## 7. Product data entities

| Entity | ข้อมูลสำคัญ | Ownership / lifecycle |
| --- | --- | --- |
| UserPreference | unit, timer preferences, timezone | owner account |
| Exercise | name, muscles, equipment, source, archived | shared starter data หรือ owner custom data |
| WorkoutTemplate | name, ordered TemplateExercises, archived | owner account |
| TemplateExercise | exercise reference, targets, note, order | อยู่ภายใน Template |
| Routine | ordered Template references, weekly target, next index, active | owner account |
| WorkoutSession | source type, snapshot, status, owner device, timestamps, notes | owner account; server authoritative หลัง sync |
| SessionExercise | Exercise snapshot/reference, order, targets, notes | อยู่ภายใน Session |
| SetLog | stable ID, type, weight, reps, RIR, completed timestamp | อยู่ภายใน Session |
| SyncOperation | operation ID, session ID, mutation, created time, retry state | local-first และลบเมื่อ server acknowledge |

Progress เป็น derived data จาก Completed Sessions ไม่ใช่ editable source entity ใน MVP

## 8. Non-functional requirements

- **NFR-01 — Responsive composition:** รองรับ phone, tablet, laptop และ desktop ด้วยโครงสร้าง navigation/content ที่ต่างกันตาม [Information Architecture](information-architecture.md)
- **NFR-02 — Accessibility:** Core flows ต้องใช้ keyboard ได้, focus มองเห็นชัด, touch target อย่างน้อย 44×44 px และ contrast ผ่าน WCAG 2.2 AA
- **NFR-03 — Offline durability:** Active Session และ pending operations ต้องคงอยู่หลัง reload, browser restart และ network interruption ภายใต้ storage ที่ browser อนุญาต
- **NFR-04 — Data integrity:** ใช้ stable IDs, version checking และ idempotency เพื่อป้องกันข้อมูลซ้ำหรือ silent overwrite
- **NFR-05 — Security:** TLS, managed authentication, owner-level authorization ทุก mutation และไม่มี public signup
- **NFR-06 — Observability:** บันทึก application errors, sync failures และ server-side mutation failures โดยไม่เก็บข้อมูลสุขภาพเกินจำเป็นใน log
- **NFR-07 — Backup:** Managed relational database ต้องมี automated backup และขั้นตอนทดสอบ restore ก่อน production release
- **NFR-08 — Maintainability:** ใช้ modular monolith แยก domain modules; ห้ามเพิ่ม microservices, queue หรือ real-time collaboration ใน MVP
- **NFR-09 — Visual system:** Dark mode, Swiss International Style, grid/typography/dividers แทน shadow และใช้สีแดงเป็น accent อย่างจำกัด

## 9. MVP scope

### Included

- Private owner authentication
- Starter และ Custom Exercise Library
- Workout Templates และ ordered weekly Routine
- Today’s Workout และ ad-hoc entry
- Active Workout พร้อม previous values, rest timer และ flexible session edits
- Local durability, offline logging, retry และ conflict visibility
- Workout History พร้อม retrospective edit และ soft delete
- Exercise-level volume, estimated 1RM, PR และ trends
- Responsive installable PWA, accessibility ขั้นพื้นฐาน, backups และ error monitoring

### Explicitly out of scope

- Cardio, mobility หรือ flexible metric engine
- Calendar scheduling, recurring appointments และ notifications
- Live multi-device editing หรือ seamless session handoff
- Social, sharing, trainer/client roles หรือ billing
- Nutrition, body measurements, progress photos หรือ habit tracking
- AI coaching, automatic progression, warm-up calculator หรือ plate calculator
- Wearable/health-platform integrations
- Native mobile applications
- Public catalog ขนาดใหญ่พร้อมวิดีโอหรือบทความ

## 10. Future scope

1. Cardio/mobility exercise types และ metric model ที่ยืดหยุ่น
2. Calendar planning, training blocks, deloads และ reminders
3. Supersets, circuits, tempo และ advanced set types
4. Automatic progression, warm-up และ plate calculators
5. Bodyweight, measurements, photos และ goals
6. Consistency/adherence analytics
7. CSV/JSON import-export และ printable reports
8. Health platform, wearable และ notification integrations
9. Cross-device handoff, multi-user accounts และ trainer mode

## 11. Acceptance criteria

1. สร้าง Routine A → B → C, complete A, เว้นหลายวัน แล้ว Today ยังแสดง B
2. เริ่ม Session จาก Template แล้วแก้ Template; Active/Completed Session ต้องคง snapshot เดิม
3. เริ่ม Session แล้วพยายามเริ่มอีก Session; ระบบต้องเสนอ Resume หรือ Discard รายการเดิม
4. บันทึกหลายเซ็ตขณะ offline, reload แล้วข้อมูลยังอยู่ครบ
5. reconnect และ retry operation เดิมหลายครั้งแล้ว server มี SetLog เพียงรายการเดียวต่อ stable ID
6. เปิด Active Session จากอุปกรณ์อื่นแล้วแก้ไม่ได้และเห็น owner-device explanation
7. complete planned Session แล้ว Routine เลื่อนไปหนึ่งตำแหน่ง; ad-hoc และ discarded ไม่เลื่อน
8. แก้หรือ soft-delete Completed Session แล้ว metrics และ PR คำนวณใหม่
9. archive Exercise ที่เคยใช้แล้ว History ยังแสดงชื่อและเซ็ตเดิม
10. Phone, tablet และ desktop ผ่าน core-flow responsive และ accessibility checks

## 12. Assumptions และ risks

### Assumptions

- มี owner account เดียวและ timezone หลักเดียวใน MVP
- น้ำหนักเก็บในหน่วยมาตรฐานเดียวและแสดงเป็นกิโลกรัมโดย default
- Critical offline scope ครอบคลุม Active Workout; Plan editing และ Progress ต้อง online
- Starter Library เป็นรายการพื้นฐานพร้อม metadata สั้น ไม่มีสื่อวิดีโอ
- ใช้ managed cloud services เพื่อให้อยู่ในกรอบ 6–8 สัปดาห์

### Risks และ mitigation

| Risk | ผลกระทบ | Mitigation |
| --- | --- | --- |
| Browser ล้าง local storage | Active Session ที่ยังไม่ sync อาจสูญหาย | ขอ persistent storage เมื่อรองรับ, sync เร็วเมื่อ online และแสดง pending status |
| สองอุปกรณ์เริ่ม session ขณะ offline | เกิด session conflict | stable IDs, owner-device/version checks และห้าม silent merge |
| Progress คำนวณไม่ตรงหลังแก้ History | ผู้ใช้ไม่เชื่อถือสถิติ | derived calculation ชุดเดียว, invalidation tests และ trace กลับ Session |
| Scope offline ขยายเกิน Active Workout | Roadmap ล่าช้า | ระบุ offline boundary ชัดและ defer plan/history offline browsing |
| Starter data คุณภาพไม่สม่ำเสมอ | ค้นหาและจัดกลุ่มผิด | จำกัด catalog, ใช้ controlled muscle/equipment vocabulary และ review seed data |
