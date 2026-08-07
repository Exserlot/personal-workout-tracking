# Personal Workout Tracking Web App — Information Architecture

**Requirements:** [Product Requirements](product-requirements.md)  
**Behavior:** [User Flows](user-flows.md)  
**Delivery:** [Development Roadmap](development-roadmap.md)

## 1. IA principles

1. **Today is the operational home:** หน้าแรกต้องตอบว่า “ต้องทำอะไรต่อ” ภายในไม่กี่วินาที
2. **Plan and perform are separate modes:** การวางแผนเน้นจอใหญ่; Active Workout ลด navigation และ decision บน phone
3. **History is evidence, Progress is interpretation:** สถิติทุกค่าต้องเชื่อมกลับไป Session ต้นทาง
4. **One primary action per state:** Start, Resume, Complete Set หรือ Finish ต้องเด่นกว่าการกระทำรอง
5. **Responsive means recomposition:** desktop, tablet และ phone ใช้ hierarchy เดียวกันแต่เปลี่ยน navigation, grouping และ interaction pattern

## 2. Sitemap และ navigation hierarchy

```text
Authentication
└── P-01 Login

Application
├── P-02 Today
│   └── P-07 Active Workout
│       └── P-08 Completion Summary
├── P-03 Exercise Library
│   └── P-04 Exercise Detail / Editor
├── P-05 Plans & Routines
│   └── P-06 Workout Template Editor
├── P-09 Workout History
│   └── P-10 History Detail / Edit
├── P-11 Progress Overview
│   └── P-12 Exercise Progress Detail
└── P-13 Settings & Sync Status
```

### Global information domains

- **Do now:** Today, Active Workout
- **Prepare:** Exercises, Plans & Routines
- **Review:** History, Progress
- **System:** Account, units, timer preferences, offline/sync state

## 3. Page inventory

### P-01 — Login

- **Goal:** ยืนยัน owner account และเข้าสู่ protected application
- **Primary action:** Log in
- **Key content:** credential fields, auth error, network state
- **States:** idle, submitting, invalid credentials, network error, session expired
- **Related flows:** UF-01

### P-02 — Today

- **Goal:** แสดง next action ตาม Active Session/Active Routine state
- **Primary action:** Resume ถ้ามี Active Session; มิฉะนั้น Start next workout
- **Secondary actions:** View plan, start ad-hoc workout
- **Key content:** next Template preview, previous completion, routine position, sync/owner-device status
- **States:** active-session, next-workout, no-routine, offline-unavailable, locked-by-other-device
- **Related flows:** UF-01, UF-04, UF-05, UF-09

### P-03 — Exercise Library

- **Goal:** ค้นหา เลือก และจัดการ Exercises
- **Primary action:** Create Exercise
- **Key content:** search, muscle/equipment filters, starter/custom indicator, archived filter
- **States:** loading, empty search, offline cached, error, success
- **Related flows:** UF-02, UF-03

### P-04 — Exercise Detail / Editor

- **Goal:** ดู metadata หรือสร้าง/แก้ custom Exercise
- **Primary action:** Save
- **Secondary action:** Archive
- **Key content:** name, muscles, equipment, description, usage references
- **States:** read-only starter, editable custom, validation error, archive warning
- **Related flows:** UF-02

### P-05 — Plans & Routines

- **Goal:** จัดการ Templates, Routine sequence และ Active Routine
- **Primary action:** Create Template หรือ Activate Routine ตาม state
- **Key content:** active badge, weekly frequency, ordered Templates, archived items
- **States:** no-plan, draft, active, blocked-by-active-session, save error
- **Related flows:** UF-01, UF-03

### P-06 — Workout Template Editor

- **Goal:** ประกอบแบบฝึกและกำหนด targets
- **Primary action:** Save Template
- **Key content:** ordered Exercises, set count, rep range, RIR, rest, notes
- **States:** empty, dirty, validation error, archived-exercise warning, saved
- **Related flows:** UF-03

### P-07 — Active Workout

- **Goal:** บันทึก session ด้วยความเร็วและความผิดพลาดต่ำ
- **Primary action:** Complete Set; Finish เมื่อพร้อมจบ
- **Secondary actions:** Add set/exercise, timer controls, session notes, exit
- **Key content:** Exercise ปัจจุบัน, previous values, targets, SetLogs, rest timer, sync status
- **States:** active-synced, active-pending, offline, read-only locked, conflict, finishing
- **Related flows:** UF-05–09

### P-08 — Completion Summary

- **Goal:** ยืนยันผลลัพธ์ session และ PR ที่เกิดขึ้น
- **Primary action:** Done / View History
- **Key content:** duration, volume, exercises, completed sets, PR, pending-sync notice
- **States:** calculated, calculation pending, sync pending, error
- **Related flows:** UF-07

### P-09 — Workout History

- **Goal:** ค้นหา Completed Sessions และเปิดรายละเอียด
- **Primary action:** Open Session
- **Key content:** date, Template/ad-hoc label, duration, volume, exercise summary
- **States:** loading, empty, filtered-empty, offline cached, error
- **Related flows:** UF-07, UF-10

### P-10 — History Detail / Edit

- **Goal:** ตรวจสอบ แก้ หรือ soft-delete Session
- **Primary action:** Save Changes เมื่อ edit; มิฉะนั้น Edit
- **Key content:** Session metadata, exercises, sets, notes, PR links, edited marker
- **States:** view, edit, validation error, delete confirmation, recalculating progress
- **Related flows:** UF-10

### P-11 — Progress Overview

- **Goal:** เลือก Exercise และเห็น recent performance signals
- **Primary action:** Open Exercise Progress
- **Key content:** Exercise search, recent PRs, latest trends
- **States:** loading, no-data, stale/recalculating, error
- **Related flows:** UF-11

### P-12 — Exercise Progress Detail

- **Goal:** วิเคราะห์ progressive overload ราย Exercise
- **Primary action:** Inspect source Session
- **Key content:** best weight, reps, volume, estimated 1RM, PRs, time-range control
- **States:** loading, no-working-sets, recalculating, error, success
- **Related flows:** UF-11

### P-13 — Settings & Sync Status

- **Goal:** จัดการ preferences และตรวจสุขภาพการ sync
- **Primary action:** Save Preferences หรือ Retry Sync ตาม state
- **Key content:** display unit, rest timer behavior, last sync, pending operations, device/session ownership
- **States:** synced, pending, offline, retrying, conflict
- **Related flows:** UF-08, UF-09

## 4. Navigation by device

### Desktop / laptop

- Persistent left rail: Today, Plans, Exercises, History, Progress
- Settings และ sync status อยู่ท้าย rail
- Main content ใช้ 12-column grid
- List-detail flows ใช้ main pane + contextual side pane เมื่อช่วยลดการสลับหน้า
- Template Editor แสดง Exercise Library/selector ควบคู่กับ ordered template canvas

### Tablet

- Landscape: collapsible rail + one/two content panes
- Portrait: compact top bar หรือ navigation drawer; detail เปิดเป็น full pane
- Active Workout ใช้ content column กว้างและ timer rail/section ตาม orientation
- หลีกเลี่ยง desktop hover-only interactions

### Phone

- Bottom navigation: Today, Plans, History, Progress; Exercises และ Settings เข้าผ่าน More/contextual entry
- Active Workout เปิด full-screen focus mode และซ่อน global bottom navigation
- Sticky bottom action สำหรับ Complete Set/Finish โดยเคารพ safe-area inset
- Editors แบ่งเป็น sections/steps; list-detail เปลี่ยนเป็น push navigation
- Tables เปลี่ยนเป็น labeled rows/cards ไม่ใช้ horizontal shrink

## 5. Responsive transformation rules

| Pattern | Desktop | Tablet | Phone |
| --- | --- | --- | --- |
| Global navigation | Persistent rail | Collapsible rail/drawer | Bottom navigation |
| Today | Summary + next workout + context columns | Two sections | Next action first; stacked summary |
| Exercise Library | Filters sidebar + dense list | Collapsible filters | Search first + filter sheet |
| Template Editor | Library and canvas side-by-side | Selector drawer + canvas | Step-based editor |
| Plans/Routine | Sequence grid/table | Reorderable list | Vertical ordered cards |
| Active Workout | Exercise index + working area + timer | Working area + compact index | Full-screen single-exercise focus |
| History | Table/list + detail pane | List then detail | Session cards then push detail |
| Progress | Multi-chart comparison | One/two charts per row | One metric/chart per section |
| Destructive confirmation | Modal | Modal/sheet | Bottom sheet/full-screen confirm |

Breakpoints ต้องพิจารณาจาก content pressure ไม่ผูกกับชื่ออุปกรณ์เพียงอย่างเดียว และต้องทดสอบอย่างน้อย phone portrait, tablet portrait/landscape และ desktop

## 6. Active Workout mobile focus mode

ลำดับข้อมูลจากบนลงล่าง:

1. Session title, elapsed time และ sync indicator
2. Exercise position เช่น `2 / 5` และ Exercise name
3. Target summary และ previous-session reference
4. Set rows พร้อม weight/reps/RIR และ set type
5. Add Set และ Exercise notes
6. Rest timer แบบ compact overlay/section เมื่อทำงาน
7. Sticky Complete Set หรือ Finish action

Interaction rules:

- เปิด numeric keyboard สำหรับ weight/reps
- Complete Set ต้องไม่ต้องเปลี่ยนหน้า
- Previous values เป็น suggestion ไม่ auto-commit
- Offline/pending indicator ต้องมองเห็นแต่ไม่แย่ง primary action
- Back/close ต้องเก็บ Session เป็น active ไม่ตีความว่า Finish
- Conflict/read-only state ต้องปิด mutation controls อย่างชัดเจน

## 7. Visual system direction

### Swiss International Style

- ใช้ modular grid และ baseline rhythm เป็นโครงหลัก
- Typography เป็นตัวสร้าง hierarchy: scale, weight, case และ spacing
- ใช้เส้นแบ่ง 1px และพื้นที่ว่างแทน card shadows
- Alignment ต้องตั้งใจและคงเส้นแกนเดียวกันระหว่าง header, content และ controls
- ตัวเลข performance ใช้ tabular numerals

### Dark mode และสี

- Background: neutral near-black หลายระดับเท่าที่จำเป็นต่อ hierarchy
- Primary text: off-white; secondary text: neutral gray ที่ผ่าน contrast
- Red accent: primary CTA, current/active indicator และ selected data emphasis
- Error, warning และ success ต้องมี label/icon ไม่พึ่งสีแดงหรือสีอย่างเดียว
- หลีกเลี่ยง gradient, glow, glassmorphism และ decorative shadow

### Typography และ density

- ใช้ sans-serif ที่อ่านตัวเลขชัดและรองรับไทย/อังกฤษ
- Headings สั้น ชัด และจัดตาม grid
- Phone logging ใช้ input/ตัวเลขขนาดใหญ่; desktop planning เพิ่ม density โดยไม่ลด touch/click precision
- Copy ใช้คำมาตรฐานจาก [Product Terminology](product-requirements.md#4-product-terminology)

### Motion

- ใช้ motion เพื่อสื่อ set completion, timer state, save/sync acknowledgement และ page hierarchy
- ปิดหรือย่อ motion เมื่อผู้ใช้ตั้ง `prefers-reduced-motion`
- ห้ามใช้ animation เป็นเงื่อนไขเดียวในการเข้าใจ state

## 8. Shared application states

| State | การแสดงผล | Primary recovery/action |
| --- | --- | --- |
| Loading | skeleton ที่รักษา layout | รอ; ไม่แสดง CTA ปลอม |
| Empty | อธิบายสาเหตุและ next step | Create/Start ตาม domain |
| Offline | persistent compact indicator | ทำ Active Workout ต่อหรือกลับมา online |
| Pending sync | จำนวน/สถานะงานค้างโดยไม่ขัด flow | automatic retry; manual retry ใน Settings |
| Error | ข้อความเฉพาะบริบทและข้อมูลที่ยังปลอดภัย | Retry/return |
| Conflict | local/server summary และผลกระทบ | กลับ owner device หรือ explicit abandon |
| Success | acknowledgement สั้น ไม่บล็อกงานต่อ | next logical action |
| Read-only lock | ปิด mutation controls พร้อมเหตุผล | Open owner-device guidance |

## 9. Accessibility requirements

- Contrast ผ่าน WCAG 2.2 AA สำหรับ text, controls, borders ที่สื่อ state และ focus
- Touch target อย่างน้อย 44×44 px และมีระยะห่างพอสำหรับใช้งานระหว่างฝึก
- ทุก interactive element ใช้ keyboard ได้และมี visible focus
- Reorder controls ต้องมี keyboard alternative ไม่พึ่ง drag-and-drop อย่างเดียว
- Form fields มี visible label, units, error association และไม่ใช้ placeholder แทน label
- Timer มี text state และไม่พึ่งเสียง/การสั่นอย่างเดียว
- Charts มี accessible summary/table หรือ text equivalents
- Focus ถูกจัดการเมื่อเปิด modal/sheet, เปลี่ยน Exercise หรือเกิด validation error
- รองรับ zoom และ dynamic text โดยไม่ซ่อน primary action
