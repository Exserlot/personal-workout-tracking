# Today Screen UX/UI Analysis & Specifications

**Document Type:** Reconciled UX/UI Audit & Implementation Specification
**Auditor:** Antigravity AI Coding Assistant (Peer-reviewed & Reconciled with Codex Debate)
**Date:** 2026-08-16
**Target Page:** `P-02 Today` ([`TodayPage.tsx`](../../src/pages/TodayPage.tsx))
**Traceability:** [FR-TD-01–04](../product-requirements.md#4-functional-requirements), [FR-AW-01–03](../product-requirements.md#4-functional-requirements), [UF-04](../user-flows.md#5-uf-04--resolve-todays-workout), [UF-05](../user-flows.md#6-uf-05--start-หรือ-resume-workout), [UF-09](../user-flows.md#10-uf-09--resolve-sync-conflicts-และ-multi-device-sessions), [Design System](../design-system.md)

---

## 1. Executive Summary & State Resolution Order

หน้าจอ **Today (P-02)** ทำหน้าที่เป็นศูนย์กลางการตัดสินใจ (Next Action Hub) สำหรับการฝึกในแต่ละวัน โดยต้องนำเสนอ **Next Single Action** ที่สอดคล้องกับสถานะปัจจุบันของผู้ใช้ทันทีที่เปิดหน้าจอ

ลำดับความสำคัญในการตัดสินใจเลือก Content State (State Resolution Priority) ตามที่กำหนดไว้ใน [`todayRules.ts`](../../src/features/workout/domain/todayRules.ts#L19) มีลำดับดังนี้:
1. `terminal-pending`: มี Session ที่จบหรือยกเลิกขณะออฟไลน์และกำลังรอซิงก์ (บล็อกการเริ่ม Session ใหม่จนกว่าจะซิงก์เสร็จ)
2. `active-session`: มี Workout Session ที่กำลังดำเนินการอยู่ (ต้องเสนอ Resume เป็น Action หลัก)
3. `initial-loading`: อยู่ระหว่างตรวจสอบข้อมูลแคชและเซิร์ฟเวอร์
4. `planned-workout`: ไม่มี Active Session แต่มี Active Routine ที่พร้อมเริ่มตามลำดับ Sequence
5. `fatal-error`: เกิดข้อผิดพลาดร้ายแรงในการเชื่อมต่อและไม่มีแคชพร้อมใช้งาน
6. `no-routine`: ผู้ใช้ยังไม่ได้เปิดใช้งาน Active Routine

---

## 2. การวิเคราะห์รายมิติ (In-Depth Analysis & Specifications)

### 2.1 Visual Hierarchy & การลดความซ้ำซ้อนของข้อมูล (Information Redundancy)

#### ปัญหาที่พบ (Verified Defects & Polish)
1. **ข้อมูล Routine และ Day Label ซ้ำซ้อน 3 ตำแหน่งพร้อมกัน**:
   - `PageFrame` description แสดง `{preview.routineName} · {preview.dayLabel}`
   - Subtitle ใต้ชื่อ Template ใน Main Column แสดง `{preview.routineName} · {preview.dayLabel}`
   - Sidebar ด้านข้าง (`aside`) แสดงชื่อและวันที่ใน `ROUTINE CONTEXT` ซ้ำอีกครั้ง
2. **Double Eyebrow Stack**:
   - มีทั้ง `P-02 · TODAY` (จาก Page Header) และ `NEXT WORKOUT` / `ACTIVE SESSION` ใน Main Column ทำให้สายตาไม่โฟกัส
3. **Hero Title ต่ำกว่าระดับ Type Scale ตาม Swiss Design System**:
   - ตาม [Design System (§4.2)](../design-system.md#42-type-scale) ระบุว่า Desktop Today Hero ควรใช้ `type-display-xl` (`56/60px`) แต่ปัจจุบันใช้เพียง `text-h1`

#### ข้อกำหนดการปรับปรุง (Specification)
- **Single Focal Hero:** กำหนดให้ชื่อ Template เป็น Hero Statement ตัวใหญ่ชัดเจน และมี Subline เพียงจุดเดียว:
  ```text
  [NEXT WORKOUT]
  Push Day (Chest & Triceps)
  Push Pull Legs · Day 1 of 3
  ```
- ตัดข้อความซ้ำซ้อนใน `PageFrame` description ให้คงเฉพาะคำอธิบายบริบทของระบบ และให้ Body เล่ารายละเอียดของแผนวันนี้
- ปรับขนาดฟอนต์ของชื่อ Template บน Desktop ให้ได้สัดส่วน `type-display-xl` ตาม Design Token

---

### 2.2 Planned Workout View & Color Contract

#### ปัญหาที่พบ (Contract Violation & Data Presentation)
1. **Color Contract Violation บนปุ่ม Start Workout**:
   - ปัจจุบันปุ่ม `Start Workout` ใช้ `variant="accent"` (สีแดง) ขัดแย้งกับ [Design System (§3.3)](../design-system.md#33-semantic-tokens) ที่ระบุว่า:
     - `color-action-primary-bg` (สีขาว/เทาอ่อน) = Default high-priority CTA เช่น Start / Save
     - `color-action-accent-bg` (สีแดง) = สงวนไว้สำหรับ Complete Set หรือ Resume ขณะเล่นจริงเท่านั้น (*"One red decision at a time"*)
2. **ความเสี่ยงด้านความถูกต้องของ Target Weight แบบ Per-Set**:
   - ใน `ExerciseRows` ปัจจุบันดึงเฉพาะ `prescriptions[0]` มาแสดงค่าเป้าหมาย
   - แม้ระบบสร้าง Template ปัจจุบันจะขยายเป้าหมายเดียวไปยังทุกเซ็ตผ่าน [`planningRules.ts`](../../src/features/planning/domain/planningRules.ts) แต่ในระดับ Domain/Database รองรับความแตกต่างของเซ็ต (Warm-up, Working, Drop) การแสดงผลจึงต้องรองรับกรณีที่ชุดเป้าหมายในเซ็ตแรกไม่ใช่ตัวแทนของทุกเซ็ต

#### ข้อกำหนดการปรับปรุง (Specification)
- เปลี่ยนปุ่ม `Start Workout` เป็น `variant="primary"` (ปุ่มสีขาว Text ดำ) และปุ่ม `เลือก Ad-hoc Workout` เป็น `variant="secondary"`
- ปรับ Logic การแสดง Target Weight ให้สรุป Range หรือระบุว่าเป็น Working Target เพื่อความถูกต้องของข้อมูล

---

### 2.3 Active Session & Multi-Device Ownership Management

#### ปัญหาที่พบ (UX & Ownership Handling)
1. **ขาด Live Duration และ Visual Progress**:
   - แสดงเฉพาะ Timestamp นิ่งๆ (`"เริ่มเมื่อ 16 ส.ค. 2569 22:05"`) ขาดระยะเวลาที่ผ่านไป (Elapsed Time)
   - สถิติเซ็ตแสดงเป็นตัวเลขโดดๆ ขาด Visual Progress Meter (เช่น Segmented Bar หรือ Percentage)
2. **Multi-Device Lock UX (UF-09)**:
   - เมื่อ Session เป็นของอุปกรณ์อื่น ผู้ใช้จะเห็นปุ่ม *"ดูแบบอ่านอย่างเดียว"* แต่หากผู้ใช้ไม่สามารถเข้าถึงอุปกรณ์เครื่องเดิมได้ หน้าจอจะไม่มี Navigation Link ไปยังหน้า Settings เพื่อจัดการ Abandon/Resolve Conflict

#### ข้อกำหนดการปรับปรุง (Specification)
- เพิ่ม Elapsed Duration Badge (เช่น `กำลังฝึกอยู่ · 35 นาที`)
- เพิ่ม Segmented Progress Bar ใต้ตัวเลขสรุปเซ็ต (เช่น `[████░░░░░░] 4/12 เซ็ต (33%)`)
- สำหรับ Read-only Session จากอุปกรณ์อื่น ให้เพิ่มลิงก์นำทางไปยัง Settings: `"จัดการ Session / Device Conflict ใน Settings"` ตามข้อกำหนดของ [UF-09](../user-flows.md#10-uf-09--resolve-sync-conflicts-และ-multi-device-sessions) โดยรักษา Warning และ Destructive Confirmation ไว้อย่างเคร่งครัด

---

### 2.4 Terminal Pending State (สถานะรอการซิงก์)

#### ปัญหาที่พบ (Async Feedback)
1. **ปุ่ม "ตรวจสอบการซิงก์" ขาด Loading State**:
   - ขณะที่ฟังก์ชัน `load()` กำลังทำงานแบบ Asynchronous ปุ่มไม่มี Spinner หรือ Disabled State ทำให้ผู้ใช้อาจกดซ้ำ
2. **ขาด Visual Network Status**:
   - ขาด Indicator ระบุสถานะการเชื่อมต่อเครือข่ายของเครื่องในปัจจุบัน

#### ข้อกำหนดการปรับปรุง (Specification)
- เพิ่มตัวแปร `isSyncChecking` เพื่อแสดง Loading / Disabled State บนปุ่มตรวจสอบการซิงก์
- เพิ่ม Network Status Pill (เช่น จุดสีส้ม `ออฟไลน์ - จะยืนยันกับเซิร์ฟเวอร์ทันทีเมื่อเชื่อมต่อ`)

---

### 2.5 No Routine / Empty State

#### ปัญหาที่พบ (Context Differentiation)
1. **Empty State ไม่แยกบริบท**:
   - ผู้ใช้ใหม่ที่ไม่มีทั้ง Template และ Routine จะเห็นข้อความเดียวกับผู้ใช้ที่มี Template แล้วแต่ยังไม่ได้กด Activate

#### ข้อกำหนดการปรับปรุง (Specification)
- ตรวจสอบสถานะ Templates จาก Repository:
  - **Zero Template State:** แสดงคำแนะนำ Onboarding สั้นๆ (1. สร้าง Template -> 2. จัด Routine -> 3. เริ่มฝึก)
  - **Unactivated Routine State:** แสดงข้อความแนะนำให้กดเปิดใช้งาน Routine ที่สร้างไว้แล้ว

---

### 2.6 Ad-Hoc Workout Dialog

#### ปัญหาที่พบ (Dialog Usability)
1. **Search Empty State Feedback**:
   - แม้ Input จะมีปุ่ม Clear ของตัวเอง แต่ในบริเวณ Empty State เมื่อค้นหาไม่พบ ควรมีทางลัดให้รีเซ็ตคำค้นหาได้โดยตรง
2. **Template List Prominence (Hypothesis)**:
   - จัดวาง Blank Workout และ Template List ให้ชัดเจนและเข้าถึงง่ายทั้งสองรูปแบบ

#### ข้อกำหนดการปรับปรุง (Specification)
- เพิ่มปุ่ม Clear Search ในส่วนแสดงผลลัพธ์ว่างเปล่าเมื่อค้นหาไม่พบ Template
- รักษาขนาด Touch Target ให้ไม่ต่ำกว่า 44px (ปัจจุบันทำได้ดีที่ 72px)

---

### 2.7 Skeleton Loading & Scope Control

#### ปัญหาที่พบ & ขอบเขตการพัฒนา (CLS & Scope Boundary)
1. **Layout Shift (CLS) ใน `TodayLoading`**:
   - โครงร่าง Skeleton ไม่ตรงกับ Wireframe จริง ทำให้เกิดการกระตุกเมื่อโหลดข้อมูลเสร็จ
2. **Scope Control (ขอบเขต MVP)**:
   - **ข้อควรระวัง:** การนำ Weekly Consistency / Adherence Analytics มาใส่ใน Sidebar ทางขวา **ไม่ได้รับอนุญาตใน MVP** เนื่องจากถูกจัดอยู่ใน [Product Requirements (Section 10: Future Scope)](../product-requirements.md#10-future-scope) จึงต้องตัดข้อเสนอนี้ออกเพื่อรักษาขอบเขต MVP

#### ข้อกำหนดการปรับปรุง (Specification)
- ออกแบบ `TodayLoading` ใหม่ให้มี Geometry ตรงกับหน้า Today จริง (Hero Box, 3 Stat Blocks, Table Rows) เพื่อขจัด Cumulative Layout Shift
- ฝั่ง Desktop Sidebar ให้เน้นแสดง Routine Sequence และ Navigation ไปยัง Plans ตามขอบเขต MVP

---

## 3. ตารางจัดลำดับความสำคัญ (Implementation Roadmap)

| Priority | รายการปรับปรุง | ประเภท | ผลลัพธ์ต่อระบบและผู้ใช้ |
| :--- | :--- | :--- | :--- |
| **P1 (Critical / Defect)** | 1. แก้ไขปุ่ม `Start Workout` ให้ใช้ `variant="primary"` | Design Contract | สอดคล้องกับ Color Token และหลัก One Red Decision |
| **P1 (Critical / Defect)** | 2. เพิ่ม Loading Feedback ให้ปุ่ม *"ตรวจสอบการซิงก์"* ใน Terminal State | Async Safety | ป้องกันการกดย้ำซ้ำซ้อนและแจ้งสถานะชัดเจน |
| **P1 (Critical / Defect)** | 3. ปรับโครงสร้าง Skeleton Loading (`TodayLoading`) ให้ตรง Geometry จริง | Web Vitals (CLS) | ลด Layout Shift สร้างความรู้สึกเสถียรและพรีเมียม |
| **P1 (Critical / UX)** | 4. ลดความซ้ำซ้อนของ Routine/Day Label และจัด Hero Type Scale | Visual Polish | หน้าจอสะอาด คมชัด ข้อมูลไม่อัดแน่นซ้ำซ้อน |
| **P1 (Critical / UX)** | 5. เพิ่มลิงก์ทางลัดไปจัดการ Conflict ใน Settings เมื่อติด Multi-Device Lock | User Flow (UF-09) | ผู้ใช้ไม่ติด Dead End สามารถจัดการ Session ได้ถูกต้อง |
| **P2 (Medium / UX)** | 6. เพิ่ม Live Elapsed Duration และ Segmented Progress Bar ใน Active Session | Feature Polish | มองเห็นความคืบหน้าของ Workout ที่ค้างอยู่ได้ทันที |
| **P2 (Medium / UX)** | 7. ปรับ Empty State ให้แยกบริบทระหว่างผู้ใช้ใหม่ กับผู้ใช้ที่มี Template แล้ว | Onboarding UX | แนะนำขั้นตอนถัดไปให้ผู้ใช้อย่างตรงจุด |
| **P2 (Medium / UX)** | 8. เพิ่มปุ่ม Reset Search ใน Ad-hoc Empty Result Area | Usability | ค้นหาและสลับการฝึกนอกตารางได้อย่างรวดเร็ว |
| **Backlog / Post-MVP** | 9. Exercise Detail / How-to Preview บนหน้า Today | Enhancement | อำนวยความสะดวกเพิ่มเติมก่อนเริ่มซ้อม |
| **REJECTED (Out of Scope)** | 10. Weekly Consistency / Adherence Analytics ใน Sidebar | Future Scope | ตัดออกจาก MVP ตาม Product Requirements Section 10 |
