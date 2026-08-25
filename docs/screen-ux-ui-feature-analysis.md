# Comprehensive Screen UX/UI, Layout & Feature Analysis

**Document Type:** Full Application UX/UI Audit, Layout Specification & Feature Roadmap
**Target Application:** Personal Workout Tracking Web App (FORM)
**Traceability:** [Product Requirements](product-requirements.md) · [Information Architecture](information-architecture.md) · [Design System](design-system.md) · [User Flows](user-flows.md) · [Development Roadmap](development-roadmap.md)

---

## 1. Executive Summary & Architectural Principles

เอกสารนี้วิเคราะห์โครงสร้างหน้าจอ (**Layout**), ประสบการณ์และการออกแบบส่วนติดต่อผู้ใช้ (**UX/UI**), และฟังก์ชันการทำงานที่ควรพัฒนาเพิ่มเติม (**Feature Recommendations**) อย่างละเอียดรายหน้าจอ (P-01 ถึง P-15) โดยยึดหลักเกณฑ์สำคัญตามสถาปัตยกรรมของระบบ:

1. **Today is the Operational Home:** หน้าแรกต้องตอบว่า *"ต้องทำอะไรต่อ"* หรือ *"มี Session ค้างอยู่หรือไม่"* ภายใน 3 วินาที
2. **Plan and Perform Separation:** การวางแผนเน้นจอใหญ่ (Desktop/Tablet) ส่วนการบันทึกระหว่างฝึก (Active Workout) เน้นความเร็ว ทนทานต่อออฟไลน์ และลดการตัดสินใจบนมือถือ (Phone)
3. **One Red Decision Rule:** สงวนการใช้สีแดง Accent (`variant="accent"`) สำหรับ Action สำคัญสูงสุดในบริบท Live Workout เท่านั้น (เช่น Complete Set หรือ Resume Session) การกระทำทั่วไป (Start / Save) ต้องใช้สีขาว (`variant="primary"`)
4. **Offline Resilience & Data Integrity:** ทุกการบันทึกลง IndexedDB ก่อน แล้วจึง Background Sync ไปยัง Supabase โดยไม่ทำให้ข้อมูลสูญหาย
5. **Traceability:** ข้อมูล Progress และ History ทุกจุดต้องเชื่อมโยงกลับไปยัง Completed Session ต้นฉบับได้

---

## 2. Global Navigation & Layout Shell

```text
Authentication
└── P-01 Login (/login)

Application Shell (Responsive Layout & Sync Management)
├── P-02 Today (/today) [Operational Home]
│   ├── P-07 Active Workout (/workout/active, /workout/:id) [Focus Mode]
│   └── P-08 Completion Summary (/workout/:id/summary)
├── P-03 Exercise Library (/exercises)
│   └── P-04 Exercise Detail / Editor (/exercises/new, /exercises/:id, /exercises/:id/edit)
├── P-05 Plans & Routines (/plans)
│   ├── P-06 Workout Template Editor (/templates/new, /templates/:id/edit)
│   └── P-15 Weekly Routine History (/routine-history, /routine-history/:id)
├── P-09 Workout History (/history)
│   └── P-10 History Detail / Edit (/history/:id, /history/:id/edit)
├── P-11 Progress Overview (/progress)
│   └── P-12 Exercise Progress Detail (/progress/exercises/:id)
├── P-13 Settings & Sync Status (/settings)
└── P-14 Notification Center (/notifications)
```

### 2.1 Responsive Shell Behavior
* **Phone (< 768px):** Fixed Bottom Navigation Bar 4 รายการหลัก (`Today`, `Plans`, `History`, `Progress`) พร้อม Top Utility Bar ที่มี Notification Bell (แสดง Unread Badge), Network/Sync Indicator และ ลิงก์ Settings; คำนึงถึง `safe-area-inset-bottom`
* **Tablet (768px – 1279px):** Collapsible Left Navigation Drawer หรือ Compact Header Bar
* **Desktop (≥ 1280px):** Persistent Left Navigation Rail (กว้าง 240px – 260px) พร้อม Main Canvas บน 12-column grid

### 2.2 Global UX Enhancements
* **Global Non-blocking Sync Toast:** แจ้งเตือนสถานะการซิงก์เบื้องหลังด้วย Minimal Pill มุมบนขวา แทนการขัดจังหวะการทำงาน
* **Global Hotkeys (Desktop):** รองรับ `Cmd/Ctrl + K` (Quick Search ท่าฝึก/ประวัติ) และ `Spacebar` (เริ่ม/หยุดจับเวลาพัก)

---

## 3. In-Depth Screen Analysis (P-01 ถึง P-15)

---

### P-01: Login (`/login`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
ยืนยันตัวตนสำหรับ Owner Account แบบ Single-tenant ผ่าน Supabase Authentication และเข้าสู่ Protected Application

#### 2. Layout & Responsive
* **Desktop:** Split View 12 คอลัมน์ — ซ้าย (5 cols) Hero Brand Canvas สไตล์ Swiss Typography (`bg-recessed`), ขวา (7 cols) Form Container สะอาดตา
* **Mobile/Tablet:** Stacked View กะทัดรัด เรียงโลโก้ สโลแกน และตามด้วยกล่องฟอร์มทันทีเพื่อไม่ให้เลื่อนหน้าจอ

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Form Validation:** มีเพียงการเช็คค่าว่าง ขาด Inline Validation เมื่อกรอกรูปแบบอีเมลไม่ถูกต้อง
* **Password Visibility:** ขาดปุ่มเปิด/ปิดดูรหัสผ่าน (Show/Hide Password) ซึ่งสร้าง Friction บนมือถือ
* **High Contrast Focus:** Input Fields ต้องมี Focus Ring หนา 2px ชัดเจนตามมาตรฐาน WCAG 2.2 AA

#### 4. Features ที่ควรมีเพิ่ม
* **Password Toggle:** ไอคอนรูปดวงตาสลับดูรหัสผ่านพร้อม `aria-label`
* **Offline Detection Guard:** แสดงแบนเนอร์แจ้งเตือนทันทีหากไม่มีสัญญาณอินเทอร์เน็ต *"ต้องการการเชื่อมต่ออินเทอร์เน็ตสำหรับการเข้าสู่ระบบครั้งแรก"*
* **Biometrics / Passkey (Post-MVP):** เข้าสู่ระบบผ่าน Touch ID / Face ID บนอุปกรณ์ที่เชื่อถือได้

---

### P-02: Today (`/today`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
ศูนย์กลางปฏิบัติการประจำวัน (Next Action Hub) แสดง Active Session ที่ค้างอยู่ หรือแนะนำ Routine Day ที่เหมาะสมกับ Coverage ของสัปดาห์

#### 2. Layout & Responsive
* **Mobile:** Single Column เน้น Hero CTA เด่นชัด (Resume หรือ Start), ชิปสรุป Frequency/Coverage, ตาราง Preview ท่าฝึก 3–5 ท่าแรก, และปุ่มเลือกลองฝึกแบบ Ad-hoc
* **Desktop:** 12-Column Grid — 8 cols สำหรับ Hero Card + ตาราง Preview ท่าฝึกและ Target Prescriptions, 4 cols สำหรับ Routine Sequence Sidebar และปฏิทิน Coverage

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Color Contract:** เปลี่ยนปุ่ม `Start Workout` จากสีแดงเป็น `variant="primary"` (สีขาว) เพื่อสงวนสีแดงไว้สำหรับ Live Session
* **Typography & Hierarchy:** ปรับขนาดฟอนต์ของชื่อ Template สู่ระดับ `type-display-xl` (56/60px) บน Desktop และลดความซ้ำซ้อนของ Eyebrow
* **Skeleton Geometry:** แก้ไข `TodayLoading` ให้มีรูปทรงตรงกับตารางและ Hero Box จริงเพื่อป้องกัน Cumulative Layout Shift (CLS)

#### 4. Features ที่ควรมีเพิ่ม
* **Live Duration & Progress Meter ใน Active Session:** แสดงเวลานับสด เช่น `กำลังฝึกอยู่ · 38 นาที` พร้อม Segmented Progress Bar `[██████░░░░] 6/12 เซ็ต (50%)`
* **Exercise Quick How-to Modal:** กดที่ชื่อท่าในตารางเพื่อดูคำแนะนำการฝึกสั้นๆ และกล้ามเนื้อที่ใช้ได้ทันทีก่อนเริ่ม
* **Swap Routine Day for Today:** ปุ่มลัดสลับคิวตารางฝึกของวัน (เช่น สลับ Push มาเล่นก่อน Pull)
* **Mark as Rest Day:** ปุ่มบันทึกวันพักพร้อมระบุโน้ตสั้นๆ

---

### P-03: Exercise Library (`/exercises`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
ค้นหา กรอง และจัดการ Starter Exercises (100+ ท่า) และ Custom Exercises

#### 2. Layout & Responsive
* **Desktop:** Left Sidebar (3 cols) สำหรับ Filter Panel แบบละเอียด (Search, Muscle, Equipment, Type, Status) + Right Content (9 cols) แสดงตารางรายการท่าฝึก
* **Mobile:** Search Bar ด้านบน + Scrollable Muscle Filter Chips แนวนอน + ปุ่มเปิด Drawer Filter Sheet สำหรับตัวกรองขั้นสูง

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Group Headers:** ควรจัดกลุ่มท่าฝึกตามอักษรนำหรือกลุ่มกล้ามเนื้อหลักเพื่อให้อ่านง่าย
* **Clear Badge Distinction:** แสดงป้ายกำกับชัดเจนระหว่าง `STARTER` และ `CUSTOM`
* **Touch Target:** แถวรายการท่าฝึกต้องสูงอย่างน้อย 56px เพื่อความแม่นยำในการสัมผัส

#### 4. Features ที่ควรมีเพิ่ม
* **Muscle Group Visual Selector:** แท็บเลือกกลุ่มกล้ามเนื้อหลักแบบไอคอน (Chest, Back, Shoulders, Arms, Legs, Core)
* **Search Results Counter & Reset:** แสดงตัวเลขสรุปผลการค้นหา เช่น *"พบ 14 ท่าฝึก"* พร้อมปุ่มล้างคำค้นหา
* **Quick Action Menu:** ปุ่มสามจุด `(...)` หรือปุ่มลัดเพื่อเพิ่มท่าเข้า Template หรือเริ่ม Quick Session
* **Video/Tutorial Search Shortcut:** ลิงก์ตรงสำหรับค้นหาคลิปสาธิตวิธีเล่นบน YouTube หรือเว็บภายนอก

---

### P-04: Exercise Detail / Editor (`/exercises/:id`, `/exercises/new`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
ตรวจสอบข้อมูลท่าฝึก, สร้าง/แก้ไข Custom Exercise และจัดเก็บเข้าคลัง (Archive)

#### 2. Layout & Responsive
* **Form Canvas:** Single Column Form กว้าง 640px บน Desktop จัดกึ่งกลาง; บน Mobile ขยายเต็มจอเพื่อความสะดวกในการกรอก

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Starter Exercise Notice:** สำหรับ Starter ที่แก้ไขไม่ได้ ให้แสดง Banner แจ้งว่าเป็นท่ามาตรฐาน พร้อมปุ่ม *"Duplicate as Custom"*
* **Secondary Muscles Selection:** เปลี่ยนจาก Checkbox ยาวๆ เป็น Tag Cloud Chips ที่แตะเลือก/ยกเลิกได้ง่าย

#### 4. Features ที่ควรมีเพิ่ม
* **Duplicate as Custom:** โคลนท่า Starter มาเป็น Custom เพื่อปรับแต่งชื่อหรืออุปกรณ์เองในคลิกเดียว
* **Live Duplicate Name Warning:** เตือนทันทีขณะพิมพ์หากชื่อท่าซ้ำกับที่มีอยู่แล้วในระบบ
* **Used-in Templates Reference:** แสดงรายชื่อ Template ทั้งหมดที่นำท่านี้ไปใช้ พร้อมลิงก์เปิดดู
* **Exercise All-Time PR Widget:** แสดงสถิติ All-time Best (1RM สูงสุด, น้ำหนักสูงสุด) ในหน้า Detail ทันที

---

### P-05: Plans & Routines (`/plans`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
บริหารจัดการ Workout Templates, วางผัง Flexible Weekly Routine และควบคุม Effective-Week Activation

#### 2. Layout & Responsive
* **Desktop:** 2 ส่วนหลัก — บน: **Active Weekly Routine Plan** (แสดงสถานะ Routine Days, Frequency Target, Locked Plan Banner); ล่าง: **Workout Templates Grid**
* **Mobile:** สลับแท็บระหว่าง `Active Routine` และ `Templates` หรือใช้ Collapsible Cards

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Locked Plan Visual Cue:** เมื่อมี Session ในสัปดาห์เกิดขึ้นแล้ว ต้องแสดง Badge ชัดเจน: `LOCKED THIS WEEK` / `EFFECTIVE NEXT MONDAY`
* **Card Density:** สรุปจำนวนท่าฝึกและจำนวนเซ็ตรวมบนการ์ด Template อย่างกระชับ

#### 4. Features ที่ควรมีเพิ่ม
* **Muscle Volume Breakdown Bar:** แถบแสดงสัดส่วนเซ็ตตามกลุ่มกล้ามเนื้อใต้การ์ด Template (เช่น อก 9 เซ็ต, หลังแขน 6 เซ็ต)
* **One-Click Template Duplication:** ปุ่มลัดคัดลอก Template เพื่อสร้างเวอร์ชันใหม่
* **Routine Day Reorder Controls:** ปุ่มเลื่อนขึ้น/ลง หรือ Drag Handle เพื่อจัดเรียงลำดับ Routine Day

---

### P-06: Workout Template Editor (`/templates/new`, `/templates/:id/edit`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
ประกอบแบบฝึก กำหนดลำดับท่าฝึก และระบุ Prescription Targets (Sets, Reps Range, Target Weight, RPE/RIR, Rest Seconds, Notes)

#### 2. Layout & Responsive
* **Desktop (Split View):** ซ้าย (7 cols) = Template Canvas, ขวา (5 cols) = Exercise Picker ค้นหาและกดเพิ่มท่าได้ต่อเนื่อง
* **Mobile:** List Canvas พร้อมปุ่ม Fixed Bottom *"＋ เพิ่มท่าฝึก"* ที่เปิด Full-screen Exercise Picker Sheet

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Prescription Input Grid:** จัดช่องกรอกเป้าหมายให้เป็นตารางแนวขนาน: `[Sets] | [Reps Min - Max] | [Weight] | [RPE] | [Rest]`
* **Rest Duration Presets:** ชิปเวลาพักสำเร็จรูป (`60s`, `90s`, `120s`, `180s`) แทนการพิมพ์ตัวเลขทั้งหมด

#### 4. Features ที่ควรมีเพิ่ม
* **In-Place Exercise Swap:** ปุ่มสลับเปลี่ยนท่าฝึกโดยคงจำนวนเซ็ตและเป้าหมายเดิมไว้
* **Superset / Circuit Linking:** สัญลักษณ์ผูก 2 ท่าเข้าด้วยกันเป็น Superset
* **Exercise Note Template:** ช่องบันทึกเทคนิคเฉพาะท่า เช่น *"โฟกัสจังหวะยืด 2 วินาที"*

---

### P-07: Active Workout (`/workout/active`, `/workout/:id`) ⭐️

#### 1. บทบาทและหน้าที่ (Role & Goals)
**หัวใจหลักของแอปพลิเคชัน** บันทึกการฝึกจริงในยิมแบบ Real-time รวดเร็ว ทนทานต่อการขาดอินเทอร์เน็ต และลดความผิดพลาด

#### 2. Layout & Responsive
* **Mobile (Full-screen Focus Mode):**
  * ซ่อน Global Navigation ทั้งหมด
  * **Top Bar:** ชื่อ Session, Live Elapsed Time, ปุ่ม Exit, สถานะ Sync/Offline Indicator
  * **Active Exercise Header:** ลำดับท่า (`2 / 5`), ชื่อท่า, Target Summary และ Previous Performance (`Previous: 80 kg × 8`)
  * **Set Logging Table:** แถวเซ็ตขนาดใหญ่ (`min-h-[52px]`) แสดง Set Type, Weight, Reps, RPE, และ Checkbox
  * **Rest Timer Floating Bar:** แสดงเวลานับถอยหลังพร้อมปุ่ม `+30s`, `-30s`, `Skip`
  * **Sticky Bottom Action:** ปุ่มหลักเต็มนิ้วโป้ง *"COMPLETE SET"* (สีแดง Accent) หรือ *"NEXT EXERCISE"* / *"FINISH WORKOUT"*

```text
+------------------------------------------+
| ✕ PULL DAY A      00:42:15      [SYNCED] |
+------------------------------------------+
| EXERCISE 2 / 5                           |
| BARBELL ROW                              |
| Target: 70 kg · 8-10 reps · RPE 8        |
| Previous: 67.5 kg × 8                    |
+------------------------------------------+
| SET | PREV        | KG     | REPS | STATUS |
|  1  | 67.5kg × 8  | [ 70 ] | [ 10]|  [ ✓ ] |
|  2  | 67.5kg × 8  | [ 70 ] | [ 8 ]|  [ ✓ ] |
|  3  | 67.5kg × 7  | [ 70 ] | [ 8 ]| [บันทึก] |
+------------------------------------------+
| [ REST TIMER: 01:18 ]   [ +30s ]  [SKIP] |
+------------------------------------------+
| [           COMPLETE SET (3)           ] | <- Primary Red Accent
+------------------------------------------+
```

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Ergonomics:** ช่องกรอก Weight ใช้ `inputMode="decimal"` และ Reps ใช้ `inputMode="numeric"` เพื่อเปิดแป้นพิมพ์ตัวเลขทันที
* **Previous Value Ghost Copy:** แตะตัวเลขสีเทาจางของสถิติครั้งก่อนเพื่อคัดลอกค่าลงช่องกรอกปัจจุบันได้ใน 1 สัมผัส
* **One Red Decision:** ปุ่ม Complete Set สำหรับเซ็ตปัจจุบันเป็นสีแดงปุ่มเดียว เซ็ตที่เสร็จแล้วเป็นสีเขียว/กลาง

#### 4. Features ที่ควรมีเพิ่ม
* **Barbell Plate Calculator:** ตัวช่วยคำนวณการใส่แผ่นน้ำหนักบาร์เบลแต่ละข้าง
* **Audio & Vibration Rest Alerts:** เสียงเตือนสั้นๆ และระบบสั่นเมื่อ Rest Timer หมดเวลา
* **Warm-up Set Auto-Generator:** สร้างเซ็ตวอร์มอัตโนมัติคำนวณจากน้ำหนักจริงที่จะเล่น
* **Set Type Fast Toggle:** แตะที่ตัวเลขเซ็ตเพื่อสลับประเภท: `W` (Warm-up), `1..N` (Working), `D` (Drop Set), `F` (Failure)
* **On-the-fly Exercise Swap / Add:** สลับหรือเพิ่มท่าใหม่ระหว่างฝึกได้ทันทีหากเครื่องเล่นในยิมไม่ว่าง

---

### P-08: Completion Summary (`/workout/:id/summary`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
สรุปผลลัพธ์การฝึก ยืนยันสถิติ PR (Personal Records) ที่เกิดขึ้น และสร้างความรู้สึกสำเร็จ

#### 2. Layout & Responsive
* **Centred Summary Canvas:** สรุปตัวเลขสำคัญ (Duration, Volume Kg, Total Sets) พร้อมรายการการ์ด PR ที่ทำลายสถิติได้

#### 3. UX / UI Analysis & จุดขัดเกลา
* **PR Highlighting:** ใช้กรอบเส้นสีแดงและ Badge `NEW PR!` ชัดเจน พร้อมระบุประเภท เช่น `ESTIMATED 1RM PR: 105 KG (+5 KG)`
* **Navigation:** ปุ่มหลัก *"ดูประวัติการฝึก"* (`variant="primary"`) และปุ่มรอง *"กลับหน้า Today"*

#### 4. Features ที่ควรมีเพิ่ม
* **Shareable Workout Card:** ปุ่ม Export ภาพสรุปผลการฝึกสไตล์มินิมอล หรือคัดลอกสรุปข้อความสำหรับแชร์
* **Session RPE & Reflection:** ประเมินความเหนื่อยรวมของ Session (1–10) และช่องจดบันทึกความรู้สึกหลังซ้อม
* **Volume Comparison:** แสดงข้อความเปรียบเทียบ เช่น *"Volume รวมเพิ่มขึ้น +4.8% เมื่อเทียบกับครั้งก่อน"*

---

### P-09: Workout History (`/history`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
สืบค้น ตรวจสอบ และเปิดดูประวัติ Completed Sessions ทั้งหมด

#### 2. Layout & Responsive
* **Desktop:** แถบตัวกรองด้านบน + 12-Column Grid แสดงรายการการ์ดประวัติ (หรือ Split View รายการซ้าย + Preview ขวา)
* **Mobile:** Infinite Scrolling Cards เรียงตามวันล่าสุด พร้อมตัวกรอง Date Range

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Card Information Density:** การ์ดต้องแสดงวันที่, ชื่อ Template หรือป้าย `AD-HOC`, Duration, Total Volume, เซ็ตรวม และ Tags รายชื่อท่าฝึก

#### 4. Features ที่ควรมีเพิ่ม
* **Monthly Activity Heatmap:** ปฏิทินรายเดือนแสดงจุดสีเขียวในวันที่ฝึก เพื่อให้เห็นความสม่ำเสมอได้อย่างรวดเร็ว
* **Filter by Template / Exercise:** กรองดูเฉพาะ Session ที่เล่น Template นั้นๆ หรือมีท่าฝึกที่ต้องการ
* **Repeat this Workout:** ปุ่มลัดนำ Session ในอดีตมาเริ่มเป็น Workout วันนี้ทันที

---

### P-10: History Detail / Edit (`/history/:id`, `/history/:id/edit`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
ตรวจสอบรายละเอียดการฝึกรายเซ็ต, แก้ไขค่าย้อนหลัง (Retrospective Edit) และการ Soft-Delete Session

#### 2. Layout & Responsive
* **Detail / Edit Layout:** ตารางแสดงท่าและเซ็ตที่บันทึกไว้ มีปุ่มสลับเข้าสู่โหมดแก้ไขข้อมูล

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Retrospective Warning:** เตือนอย่างชัดเจนว่าการแก้ค่าย้อนหลังจะทำให้ PR, 1RM และ Weekly History ถูกคำนวณใหม่
* **Edited Tag:** แสดงป้ายกำกับ `EDITED` พร้อมวันที่แก้ไขล่าสุด

#### 4. Features ที่ควรมีเพิ่ม
* **Side-by-Side Session Comparison:** เปรียบเทียบผลงาน Session นี้กับ Session ก่อนหน้าแบบเซ็ตต่อเซ็ต
* **Export Session as CSV/JSON:** ดาวน์โหลดข้อมูลดิบของ Session นั้น
* **Safe Soft-Delete Confirmation:** กล่องยืนยันการลบแบบพิมพ์ยืนยันเพื่อความปลอดภัย

---

### P-11: Progress Overview (`/progress`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
ศูนย์กลางการวิเคราะห์ Progressive Overload, ติดตามสถิติ PR ล่าสุด และภาพรวมปริมาณการฝึก (Volume)

#### 2. Layout & Responsive
* **Top Metric Grid:** 4 StatBlocks สรุปสถิติ 30 วันล่าสุด:
  1. `PRs (30 DAYS)`
  2. `SESSIONS COMPLETED`
  3. `TOTAL VOLUME`
  4. `EXERCISES TRACKED`
* **Main Area:** กราฟเส้นแนวโน้มท่าฝึกเด่น (Featured Exercise Trend) + ตารางสืบค้นสถิติท่าฝึกทั้งหมด

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Accessible SVG Charts:** กราฟเส้นต้องรองรับการแตะดู Tooltip แสดงวันที่, น้ำหนัก, Reps, Estimated 1RM และจุด PR สีแดง
* **Unit Toggle:** ปุ่มสลับหน่วย `KG` / `LB`

#### 4. Features ที่ควรมีเพิ่ม
* **Muscle Volume Distribution Chart:** กราฟแท่งแสดงปริมาณเซ็ตสะสมแยกตามกลุ่มกล้ามเนื้อในรอบ 30 วัน
* **PR Hall of Fame:** วิดเจ็ตรวมสถิติ All-time สูงสุดของท่าหลัก (Squat, Bench Press, Deadlift, OHP)
* **Analytics Time Range Filter:** ปุ่มเลือกช่วงเวลาแสดงผล: `1M`, `3M`, `6M`, `1Y`, `ALL`

---

### P-12: Exercise Progress Detail (`/progress/exercises/:id`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
วิเคราะห์พัฒนาการรายท่าฝึกอย่างเจาะลึก: กราฟแนวโน้ม Overload, ค่าประมาณ 1RM (Epley Formula) และประวัติ PR

#### 2. Layout & Responsive
* **Header:** ข้อมูลท่าและสถิติ Current Best
* **Multi-Metric Graph Tabs:** แท็บสลับดูกราฟ 4 รูปแบบ (`Estimated 1RM`, `Max Weight`, `Working Volume`, `Max Reps at Weight`)
* **Source Records Table:** ตารางประวัติ Log ทั้งหมดพร้อมลิงก์กลับไปยัง Session ต้นทาง

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Traceability:** ข้อมูลทุกจุดบนกราฟสามารถคลิกเพื่อเปิดดู Completed Session ต้นฉบับได้
* **Clean Baseline:** กราฟเส้น 1px สไตล์ Swiss สะอาดตา

#### 4. Features ที่ควรมีเพิ่ม
* **Rep Max Projection Table:** ตารางคำนวณประมาณการความแข็งแรง 1RM, 2RM, 3RM, 5RM, 8RM, 10RM อัตโนมัติ
* **Progression Rate Indicator:** แสดงอัตราการพัฒนาเฉลี่ย เช่น `+1.5 kg / เดือน`
* **Form Check Video Link:** ลิงก์แนบวิดีโอคลิปการยกเพื่อเช็คฟอร์มในแต่ละสถิติ

---

### P-13: Settings & Sync Status (`/settings`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
จัดการ Preferences ระบบ (หน่วยน้ำหนัก, เวลาพักเริ่มต้น, Timezone) และศูนย์ตรวจสุขภาพการซิงก์ข้อมูล (Sync Diagnostics & Conflict Resolution)

#### 2. Layout & Responsive
* **Stacked Sections:** จัดหมวดหมู่ชัดเจน:
  1. Display & Training Preferences (หน่วย KG/LB, Timezone)
  2. Rest Timer Preferences (เวลาพักตั้งต้น, เสียงเตือน)
  3. Sync & Device Ownership (สถานะ Sync, Device ID, ปุ่ม Sync Now)
  4. Data Recovery & Storage (IndexedDB Cache, คลังข้อมูลสำรอง)
  5. Account & Sign Out

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Status Badges:** แสดงสถานะการเชื่อมต่อด้วยสีมาตรฐาน (เขียว = Synced, ส้ม = Pending/Offline, แดง = Conflict/Error)
* **Destructive Confirmation:** การ Abandon Conflict หรือ Sign Out ขณะมีข้อมูลค้างต้องมี Dialog ยืนยันสองชั้น

#### 4. Features ที่ควรมีเพิ่ม
* **Rest Timer Sound & Vibration Tester:** ปุ่มกดทดสอบเสียงเตือนและระบบสั่นของเบราว์เซอร์
* **Complete Data Backup (Export JSON/CSV):** ปุ่ม Export ข้อมูลทั้งหมดสำรองไว้ในเครื่อง
* **PWA Storage Health Indicator:** แสดงขนาดพื้นที่ IndexedDB ที่ใช้งานไป

---

### P-14: Notification Center (`/notifications`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
ศูนย์รวมการแจ้งเตือนผลลัพธ์ Routine ประจำสัปดาห์ (Weekly Routine Adherence & Coverage Alerts)

#### 2. Layout & Responsive
* **List View:** รายการการ์ดแจ้งเตือนรายสัปดาห์ มีป้ายกำกับ `NEW` / `READ` พร้อมระบุช่วงสัปดาห์ และปุ่ม *"ปิดรายการ (Dismiss)"*

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Read vs Dismiss:** การเปิดอ่านเปลี่ยนสถานะเป็น READ แต่รายการจะยังคงอยู่จนกว่าจะกด Dismiss เพื่อความโปร่งใส
* **Deep Link:** แตะที่การ์ดเพื่อเปิดดูผัง Routine สัปดาห์นั้นในหน้า P-15 ได้ทันที

#### 4. Features ที่ควรมีเพิ่ม
* **Batch Mark as Read:** ปุ่ม *"ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"*
* **Weekly Achievement Notices:** การ์ดแสดงความยินดีเมื่อทำครบเป้าหมาย เช่น `สัปดาห์ที่ 34: บรรลุเป้าหมายครบ 4/4 วัน และ Coverage 100%!`

---

### P-15: Weekly Routine History (`/routine-history`, `/routine-history/:id`)

#### 1. บทบาทและหน้าที่ (Role & Goals)
เก็บบันทึกประวัติและผังความสำเร็จของ Routine ประจำสัปดาห์อย่างถาวร (Weekly Frequency & Coverage Matrix)

#### 2. Layout & Responsive
* **Overview Grid / List:** การ์ดสรุปแต่ละสัปดาห์ (วันจันทร์ - อาทิตย์) แสดงชื่อ Routine Snapshot และตัวเลข `Frequency`, `Coverage`
* **Week Detail Pane:** แสดงผัง Routine Days ทั้งหมด ระบุชัดเจนว่าวันไหนที่เล่นสำเร็จ (`COMPLETED`), วันไหนเล่นซ้ำ (`REPEATED`), หรือวันไหนที่ขาดไป (`MISSED`) พร้อมลิงก์ไป Session จริง

#### 3. UX / UI Analysis & จุดขัดเกลา
* **Provisional State Tag:** สำหรับสัปดาห์ปัจจุบันที่มี Workout ดำเนินอยู่ ให้ติดแท็กสีส้ม `PROVISIONAL` จนกว่าจะสิ้นสุดวันอาทิตย์เที่ยงคืน

#### 4. Features ที่ควรมีเพิ่ม
* **Visual Routine Day Matrix:** แถบชิปแสดงสถานะของแต่ละวัน เช่น `[Day 1: Push ✓] [Day 2: Pull ✓] [Day 3: Legs ✕ (Missed)]`
* **Year-to-Date Adherence Rate:** สรุปเปอร์เซ็นต์ความสม่ำเสมอตลอดทั้งปี เช่น `ความสม่ำเสมอเฉลี่ยปีนี้: 91%`
* **Weekly Notes:** ช่องบันทึกเหตุการณ์ของสัปดาห์นั้น เช่น *"สัปดาห์ Deload"* หรือ *"ติดเดินทาง"*

---

## 4. Implementation Priority Roadmap

| Priority | หมวดหมู่ | หน้าจอที่เกี่ยวข้อง | รายการปรับปรุง | ประโยชน์ต่อผู้ใช้และระบบ |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | **Core Fix & Safety** | P-02, P-07 | แก้ไขปุ่ม Action Color Contract (ปุ่มขาวเป็น Default, ปุ่มแดงสงวนไว้สำหรับ Live Session) | สอดคล้องกับ Swiss Design Tokens และ One Red Decision |
| **P1** | **Gym Usability** | P-07 | Rest Timer Audio/Vibration Feedback + Plate Calculator Helper | บันทึกการฝึกในยิมได้อย่างราบรื่นโดยไม่ต้องสลับแอป |
| **P1** | **Web Vitals** | P-02, P-03 | ปรับปรุง Skeleton Loading ให้มี Geometry ตรงกับโครงหน้าจริง | ขจัด Cumulative Layout Shift (CLS) |
| **P2** | **Data Insight** | P-09, P-11 | Monthly Workout Activity Heatmap + Muscle Volume Breakdown | มองเห็นความสม่ำเสมอและความสมดุลของกล้ามเนื้อ |
| **P2** | **Template Polish**| P-05, P-06 | ปุ่ม Duplicate Template, In-place Exercise Swap และ Rest Presets | สร้างและปรับแต่งแผนการฝึกได้รวดเร็วขึ้น |
| **P3** | **Data Ownership** | P-08, P-13 | Shareable Summary Graphic + Complete JSON/CSV Data Export/Backup | ความยืดหยุ่นในการแชร์และเป็นเจ้าของข้อมูล 100% |
