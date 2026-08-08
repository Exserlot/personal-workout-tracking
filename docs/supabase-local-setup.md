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
3. ต้องเห็น Starter Exercises 6 รายการ
4. สร้าง Custom Exercise แล้ว refresh หน้า; รายการต้องยังอยู่
5. เปิดรายละเอียด แก้ข้อมูล และบันทึก
6. Archive รายการ แล้วตรวจด้วยตัวกรอง Archived
7. ไปที่ Settings และออกจากระบบ; protected routes ต้องกลับไป Login

รัน automated checks ด้วย `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` และ `pnpm test:e2e` เมื่อ dev server พร้อม

## Migration policy

เพิ่ม migration ใหม่แบบ timestamped ใต้ `supabase/migrations/`; ห้ามแก้ migration ที่ถูกใช้งานแล้ว Seed catalog ใน `supabase/seed.sql` ต้องรันซ้ำได้ Mutation RPC อนุญาตเฉพาะ `authenticated`; RLS ตรวจว่า `owner_user_id = auth.uid()`
