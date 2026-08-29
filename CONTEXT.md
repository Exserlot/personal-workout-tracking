# Fitness Planning

คำศัพท์มาตรฐานสำหรับการวางแผนการฝึก การลงมือฝึก และการประเมินผลตาม Routine รายสัปดาห์

## Language

**Routine**:
ชุด Routine Days ที่ผู้ใช้ตั้งใจฝึกภายในแต่ละสัปดาห์ โดยผู้ใช้เลือกวันฝึกถัดไปได้เองและไม่มีลำดับบังคับข้ามสัปดาห์
_Avoid_: ordered Routine, fixed sequence

**Routine Day**:
รายการ Workout Template หนึ่งรายการภายใน Routine ซึ่งเป็นตัวเลือกสำหรับการฝึก ไม่ใช่วันตามปฏิทิน
_Avoid_: calendar day, scheduled day

**Weekly Frequency Target**:
จำนวน Routine Sessions ขั้นต่ำที่ผู้ใช้ตั้งใจทำในหนึ่งสัปดาห์ ค่าเริ่มต้นเท่ากับจำนวน Routine Days แต่ผู้ใช้ปรับได้ การฝึก Routine Day เดิมซ้ำสามารถนับเพิ่มจำนวนครั้งได้ แต่ Ad-hoc Sessions ไม่นับรวม
_Avoid_: Routine completion, required day count

**Routine Session**:
Workout Session ที่เริ่มจาก Routine Day ภายใน Routine Week Plan และนับต่อ Weekly Frequency Target กับ Routine Coverage
_Avoid_: Ad-hoc Session, unplanned workout

**Recommended Routine Days**:
กลุ่ม Routine Days ที่ยังไม่ถูกฝึกใน Routine Week ปัจจุบันและถูกแสดงเด่นพร้อมกันเพื่อช่วยให้ Routine Coverage ครบ โดย Routine Days ที่เคยฝึกแล้วในสัปดาห์ยังคงเลือกซ้ำได้
_Avoid_: required next workout, locked sequence

**Routine Coverage**:
ความครบถ้วนของ Routine Days ที่มี Completed Routine Session อย่างน้อยหนึ่งครั้งในสัปดาห์ โดย Routine Day ที่ฝึกซ้ำยังนับ Coverage เพียงหนึ่งและแยกจากจำนวน Routine Sessions ที่ทำได้
_Avoid_: weekly frequency, session count

**Routine Week**:
ช่วงเวลาตั้งแต่วันจันทร์ 00:00 ถึงวันอาทิตย์ 23:59 ตาม timezone ของผู้ใช้ ซึ่งเป็นขอบเขตสำหรับ Weekly Frequency Target, Routine Coverage และ Weekly Routine History โดย Workout Session เป็นของสัปดาห์ที่มีเวลาเริ่ม Session นั้น
_Avoid_: rolling seven days, carry-over period

**Routine Week Plan**:
ชุด Routine Days และ Weekly Frequency Target ที่ใช้ประเมิน Routine Week หนึ่ง เมื่อเริ่ม Routine Session แรกแล้วแผนของสัปดาห์นั้นจะคงเดิม ส่วนการเปลี่ยน Routine จะมีผลในสัปดาห์ถัดไป
_Avoid_: live Routine definition, mutable weekly plan

**Pending Routine Change**:
การเปลี่ยน Routine ที่รอมีผลใน Routine Week ถัดไป เพราะสัปดาห์ปัจจุบันเริ่มฝึกตาม Routine Week Plan แล้ว หากยังไม่เริ่ม Routine Session ในสัปดาห์ปัจจุบัน การเปลี่ยนแปลงมีผลทันทีและไม่ถือว่า pending
_Avoid_: mid-week Routine edit, retroactive plan change

**Routine Activation**:
การกำหนด Routine ให้เป็นแผนที่ใช้งาน โดยผู้ใช้เลือกก่อนยืนยันว่าจะให้มีผลใน Routine Week ปัจจุบันหรือสัปดาห์ถัดไป หากสัปดาห์ปัจจุบันมี Routine Session แล้วจะเริ่มได้เฉพาะสัปดาห์ถัดไป
_Avoid_: immediate activation without effective week

**Weekly Routine History**:
ประวัติผลของ Routine ในสัปดาห์ที่สิ้นสุดแล้ว ซึ่งเก็บจำนวน Routine Sessions เทียบเป้าหมาย และ Routine Days ที่ได้ฝึกหรือไม่ได้ฝึกตาม Routine Week Plan ของสัปดาห์นั้น รวมถึงสัปดาห์ที่ไม่มี Routine Session เลย หากมี Active Session ที่เริ่มในสัปดาห์นั้น ประวัติยังเป็นผลชั่วคราวจนกว่า Session จะ completed หรือ discarded และจะคำนวณใหม่เมื่อหลักฐาน Session ถูกแก้หรือลบย้อนหลัง
_Avoid_: carry-over queue, backlog

**Weekly Routine Notification**:
รายการแจ้งเตือนใน Notification Center กลางสำหรับ Routine Week แต่ละสัปดาห์ที่ปิดรอบแล้วและขาดเป้าหมายหรือ Routine Days ใด โดยการเปิดรายการทำให้เป็น read แต่ยังคงแสดงอยู่ และการ dismiss จึงซ่อนรายการ แต่ละรายการเชื่อมไปยังประวัติที่เกี่ยวข้องและทั้งสองการกระทำไม่เปลี่ยน Weekly Routine History การแก้หรือลบ Session ย้อนหลังคำนวณประวัติใหม่แต่ไม่สร้าง notification ใหม่ เพราะผู้ใช้ได้รับคำเตือนใน action นั้นแล้ว
_Avoid_: Today warning, history deletion, carried-over workout
