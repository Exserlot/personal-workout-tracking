# Debate: Today UX/UI Analysis Review

เอกสารนี้เป็นผลการถกเถียงและตรวจทานเอกสาร [Today UX/UI Analysis](../today-ux-ui-analysis.md) โดยเทียบกับโค้ดจริง, Product Requirements, User Flows, Information Architecture และ Design System

**วันที่ตรวจทาน:** 2026-08-16
**ขอบเขต:** วิเคราะห์เอกสารเท่านั้น ยังไม่มีการแก้ UI หรือ source code
**ข้อสรุปโดยรวม:** ใช้เป็น discussion baseline ได้ดี แต่ยังไม่ควรนำ Actionable Roadmap ไปพัฒนาตามทันที

## 1. สิ่งที่เอกสารวิเคราะห์ได้ดี

- ตรวจพบความซ้ำซ้อนของ Routine และ Day Label ใน Header, Hero และ Sidebar ได้ตรงกับโครงสร้างหน้า Today ปัจจุบัน
- ตรวจพบว่า Hero title ใช้ขนาดเล็กกว่าแนวทาง `type-display-xl` ของ Design System
- ตรวจพบว่า `Start Workout` ใช้ `variant="accent"` ทั้งที่ Color Contract กำหนด Primary สำหรับ Start/Save
- ให้ความสำคัญกับ Active Session, pending sync และ multi-device ownership ซึ่งเป็นความเสี่ยงหลักของผลิตภัณฑ์
- แยกข้อเสนอเป็นรายมิติและมีผลกระทบต่อผู้ใช้ ทำให้ทีมใช้เป็นจุดเริ่มต้นในการจัดลำดับงานได้

## 2. ประเด็นที่ต้องแก้ความเข้าใจหรือถ้อยคำ

### 2.1 ลำดับ State ใน Executive Summary ไม่ตรงกับ implementation

เอกสารระบุลำดับ `Active Session > Terminal Pending > Planned Workout > No Routine > Fatal Error` แต่ resolver ปัจจุบันตรวจตามลำดับ:

1. `terminal-pending`
2. `active-session`
3. `initial-loading`
4. `planned-workout`
5. `fatal-error`
6. `no-routine`

ดูได้ที่ [todayRules.ts](../../../src/features/workout/domain/todayRules.ts:19) ควรแก้ข้อความสรุปให้ตรงกับ behavior จริง และระบุว่าเป็น priority ของ resolver ไม่ใช่เพียงลำดับเชิงผลิตภัณฑ์

### 2.2 ข้อเสนอเรื่อง Target Weight ถูกทิศ แต่ระบุจุดผิดแคบเกินไป

`ExerciseRows` แสดง `prescriptions[0]` จริง แต่ Template Editor ปัจจุบันก็ใช้ prescription แรกเป็นฐาน แล้วขยาย target เดียวไปทุกเซ็ตผ่าน [planningRules.ts](../../../src/features/planning/domain/planningRules.ts:26)

ดังนั้นปัญหาควรอธิบายว่าเป็น **ความเสี่ยงด้านความถูกต้องของข้อมูลแบบ per-set** ไม่ใช่แค่ bug ของ `ExerciseRows` เท่านั้น ฐานข้อมูลรองรับ warm-up, working และ drop ที่มี target ต่างกัน แต่ UI สำหรับสร้าง Template ยังไม่เปิดให้กำหนดความแตกต่างนั้นอย่างครบถ้วน

### 2.3 ข้อความว่า Search Empty State ไม่มี Clear Button ไม่ถูกทั้งหมด

Ad-hoc dialog มี `onClear` และ `clearButtonLabel` อยู่แล้วที่ [AdHocWorkoutDialog.tsx](../../../src/features/workout/components/AdHocWorkoutDialog.tsx:57)

ประเด็นที่แม่นยำกว่าคือปุ่ม Clear ไม่ได้ถูกวางหรือย้ำซ้ำในบริเวณผลลัพธ์ที่ไม่พบข้อมูล ซึ่งอาจเป็น usability enhancement แต่ไม่ใช่ missing functionality

### 2.4 สมมติฐานพฤติกรรมผู้ใช้ยังไม่มีหลักฐาน

ข้อความว่าผู้ใช้ส่วนใหญ่เลือก Template มากกว่า Blank Workout ยังไม่มี usability test, analytics หรือ interview รองรับ ควรติดป้ายเป็น hypothesis และตรวจสอบก่อนเปลี่ยน visual prominence ของ dialog

### 2.5 “ปลดล็อค Session” อาจทำให้เข้าใจผิด

การ abandon server session จากอุปกรณ์อื่นเป็น administrative และ destructive action ไม่ใช่การปลดล็อคทั่วไปตาม [UF-09](../../user-flows.md:306)

ข้อเสนอควรใช้ถ้อยคำว่า “ไปจัดการ Conflict/Session ownership ใน Settings” และต้องรักษา warning, confirmation และลำดับความสำคัญรองตาม Design System

## 3. การจัดประเภทข้อเสนอ

| ประเภท | ประเด็นจากเอกสาร | ความเห็น |
| --- | --- | --- |
| Defect หรือ contract violation | Start CTA ใช้ accent, ข้อมูล target อาจไม่ตรง per-set | มีหลักฐานจากโค้ดและ Design System ควรตรวจต่อในระดับ acceptance test |
| UX improvement | ลดข้อความซ้ำ, เพิ่ม sync feedback, ปรับ empty state, skeleton ให้รักษา geometry | มีเหตุผล แต่ควรมี screenshot และ responsive evidence ประกอบ |
| Product enhancement | Elapsed time, progress meter, Exercise Detail Drawer, muscle tags | ไม่ใช่ MVP defect ต้องประเมิน effort และ scope เพิ่ม |
| Hypothesis | ผู้ใช้ส่วนใหญ่เลือก Template ใน Ad-hoc dialog, sidebar ว่างเกินไป | ต้อง validate ด้วยผู้ใช้หรือ telemetry ก่อน |
| Scope expansion | เพิ่ม Weekly Consistency ใน Today Sidebar | ไม่ควรจัดเป็นงาน MVP เพราะ consistency/adherence analytics อยู่ใน Future Scope |

## 4. การจัดลำดับความสำคัญที่ควรทบทวน

### ควรพิจารณาเป็น P1

- แก้ color contract ของ `Start Workout`
- ทำให้ per-set target ไม่สูญหายหรือแสดงผิดเมื่อข้อมูลมี prescription ต่างกัน
- เพิ่ม recovery path ไปยัง Settings สำหรับ ownership conflict โดยไม่ข้าม destructive confirmation
- ให้ pending sync มี feedback ระหว่าง action และระบุสถานะ network ให้ชัด

### ควรพิจารณาเป็น P2

- ลด Routine/Day Label ที่ซ้ำในระดับ Header และ Hero
- ปรับ empty state ให้แยก zero-template กับมี Template แต่ยังไม่มี Active Routine หาก repository รองรับข้อมูลนี้
- ปรับ skeleton ให้ใกล้ geometry จริงและรักษาความสูงของ content
- เพิ่ม elapsed time หรือ progress visualization หากผลทดสอบยืนยันว่าช่วยการตัดสินใจ

### ควรเก็บเป็น P3 หรือ backlog

- How-to preview บน Today
- Muscle tags ใน Ad-hoc template list
- Transition ตอนขยายรายการบนมือถือ
- การเติมสถิติความต่อเนื่องใน Sidebar จนกว่าจะมี scope รองรับ

## 5. สิ่งที่ audit ยังขาด

- หลักฐานจาก screenshot หรือการตรวจจริงที่ 360, 768, 1280 และ 1600 px
- Accessibility review: heading order, keyboard/focus, dialog semantics, screen reader, touch target, reduced motion และ 200% zoom
- State matrix ที่ครอบคลุม loading, cached offline, pending sync, error, conflict, read-only และ recovery
- Requirement/flow ID, effort, confidence และ acceptance criteria ต่อข้อเสนอ
- Metric ที่จะใช้ตัดสินว่าปรับแล้วดีขึ้น เช่น time-to-primary-action, duplicate action rate, sync recovery success หรือ task completion rate

## 6. ข้อสรุป

เอกสารต้นฉบับมีคุณค่าในฐานะ audit ตั้งต้นและมีประเด็นสำคัญหลายข้อ แต่ควรแก้ factual issues, แยก bug ออกจาก enhancement และใส่หลักฐานก่อนใช้เป็นแผนพัฒนา

การตรวจทานครั้งนี้สร้างเป็นเอกสารแยกเท่านั้น ไม่มีการแก้ [today-ux-ui-analysis.md](../today-ux-ui-analysis.md), UI หรือ source code
