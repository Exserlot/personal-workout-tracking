-- Starter catalog: one canonical row per exercise, with stable IDs for repeatable deployments.
-- The partial unique index on exercises(normalized_name) makes conflicting starter names fail atomically.

do $$
begin
  if exists (
    select 1
    from (values
      ('00000000-0000-0000-0000-000000000001'::uuid, 'barbell bench press'), ('00000000-0000-0000-0000-000000000002'::uuid, 'barbell back squat'), ('00000000-0000-0000-0000-000000000003'::uuid, 'barbell romanian deadlift'),
      ('00000000-0000-0000-0000-000000000004'::uuid, 'lat pulldown'), ('00000000-0000-0000-0000-000000000005'::uuid, 'barbell overhead press'), ('00000000-0000-0000-0000-000000000006'::uuid, 'pull-up'),
      ('00000000-0000-0000-0000-000000000007'::uuid, 'incline barbell bench press'), ('00000000-0000-0000-0000-000000000008'::uuid, 'dumbbell bench press'), ('00000000-0000-0000-0000-000000000009'::uuid, 'incline dumbbell press'),
      ('00000000-0000-0000-0000-000000000010'::uuid, 'chest press machine'), ('00000000-0000-0000-0000-000000000011'::uuid, 'pec deck fly'), ('00000000-0000-0000-0000-000000000012'::uuid, 'cable crossover'), ('00000000-0000-0000-0000-000000000013'::uuid, 'cable chest fly'),
      ('00000000-0000-0000-0000-000000000014'::uuid, 'push-up'), ('00000000-0000-0000-0000-000000000015'::uuid, 'chest-lean dips'), ('00000000-0000-0000-0000-000000000016'::uuid, 'barbell bent-over row'), ('00000000-0000-0000-0000-000000000017'::uuid, 'seated cable row'),
      ('00000000-0000-0000-0000-000000000018'::uuid, 'one-arm dumbbell row'), ('00000000-0000-0000-0000-000000000019'::uuid, 'chest-supported dumbbell row'), ('00000000-0000-0000-0000-000000000020'::uuid, 't-bar row'), ('00000000-0000-0000-0000-000000000021'::uuid, 'barbell deadlift'),
      ('00000000-0000-0000-0000-000000000022'::uuid, 'face pull'), ('00000000-0000-0000-0000-000000000023'::uuid, 'barbell front squat'), ('00000000-0000-0000-0000-000000000024'::uuid, 'leg press'), ('00000000-0000-0000-0000-000000000025'::uuid, 'bulgarian split squat'),
      ('00000000-0000-0000-0000-000000000026'::uuid, 'dumbbell walking lunge'), ('00000000-0000-0000-0000-000000000027'::uuid, 'leg extension'), ('00000000-0000-0000-0000-000000000028'::uuid, 'lying leg curl'), ('00000000-0000-0000-0000-000000000029'::uuid, 'standing calf raise'),
      ('00000000-0000-0000-0000-000000000030'::uuid, 'barbell biceps curl'), ('00000000-0000-0000-0000-000000000031'::uuid, 'dumbbell biceps curl'), ('00000000-0000-0000-0000-000000000032'::uuid, 'hammer curl'), ('00000000-0000-0000-0000-000000000033'::uuid, 'incline dumbbell curl'),
      ('00000000-0000-0000-0000-000000000034'::uuid, 'cable biceps curl'), ('00000000-0000-0000-0000-000000000035'::uuid, 'cable triceps pushdown'), ('00000000-0000-0000-0000-000000000036'::uuid, 'overhead cable triceps extension'), ('00000000-0000-0000-0000-000000000037'::uuid, 'dumbbell overhead triceps extension'),
      ('00000000-0000-0000-0000-000000000038'::uuid, 'close-grip bench press'), ('00000000-0000-0000-0000-000000000039'::uuid, 'bench dips'), ('00000000-0000-0000-0000-000000000040'::uuid, 'plank'), ('00000000-0000-0000-0000-000000000041'::uuid, 'side plank'),
      ('00000000-0000-0000-0000-000000000042'::uuid, 'dead bug'), ('00000000-0000-0000-0000-000000000043'::uuid, 'bird dog'), ('00000000-0000-0000-0000-000000000044'::uuid, 'hanging knee raise'), ('00000000-0000-0000-0000-000000000045'::uuid, 'reverse crunch'),
      ('00000000-0000-0000-0000-000000000046'::uuid, 'cable crunch'), ('00000000-0000-0000-0000-000000000047'::uuid, 'pallof press'), ('00000000-0000-0000-0000-000000000048'::uuid, 'dumbbell russian twist'), ('00000000-0000-0000-0000-000000000049'::uuid, 'ab wheel rollout')
    ) as catalog(expected_id, normalized_name)
    join public.exercises existing
      on existing.normalized_name = catalog.normalized_name
     and existing.id <> catalog.expected_id
     and existing.owner_user_id is null
  ) then
    -- The upsert below is intentionally keyed by the stable UUID. A name collision with
    -- another UUID must stop the migration rather than overwrite an unrelated row.
    raise exception 'starter exercise normalized_name conflicts with an existing UUID';
  end if;
end;
$$;

with catalog(id, name, normalized_name, equipment_code, primary_code, notes, secondary_codes) as (
  values
    ('00000000-0000-0000-0000-000000000001'::uuid, 'Barbell Bench Press', 'barbell bench press', 'barbell', 'chest', 'วางเท้าให้มั่นคง เกร็งสะบักและลดบาร์อย่างควบคุมก่อนดันกลับโดยไม่ยกไหล่', array['triceps','shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'Barbell Back Squat', 'barbell back squat', 'barbell', 'quadriceps', 'วางบาร์บนหลังส่วนบน เกร็งลำตัวและย่อตัวตามแนวเข่าโดยรักษาส้นเท้าติดพื้น', array['glutes','hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000003'::uuid, 'Barbell Romanian Deadlift', 'barbell romanian deadlift', 'barbell', 'hamstrings', 'ดันสะโพกไปด้านหลัง รักษาหลังเป็นกลางและควบคุมช่วง eccentric ก่อนบีบก้นกลับขึ้น', array['glutes','back']::text[]),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'Lat Pulldown', 'lat pulldown', 'machine', 'back', 'กดไหล่ลง ดึงบาร์เข้าหาอกโดยไม่เหวี่ยงตัว และปล่อยกลับช้า ๆ', array['biceps']::text[]),
    ('00000000-0000-0000-0000-000000000005'::uuid, 'Barbell Overhead Press', 'barbell overhead press', 'barbell', 'shoulders', 'เกร็งก้นและหน้าท้อง ดันบาร์เป็นแนวตรงเหนือศีรษะโดยไม่แอ่นหลัง', array['triceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000006'::uuid, 'Pull-Up', 'pull-up', 'bodyweight', 'back', 'เริ่มจากแขนเหยียด เกร็งลำตัวและดึงอกเข้าหาบาร์โดยลดตัวลงอย่างควบคุม', array['biceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000007'::uuid, 'Incline Barbell Bench Press', 'incline barbell bench press', 'barbell', 'chest', 'ตั้งม้านั่งเอียงพอดี เกร็งสะบักและลดบาร์ลงช่วงอกบนก่อนดันขึ้น', array['shoulders','triceps']::text[]),
    ('00000000-0000-0000-0000-000000000008'::uuid, 'Dumbbell Bench Press', 'dumbbell bench press', 'dumbbell', 'chest', 'วางดัมบ์เบลให้มั่นคง ลดลงพร้อมกันโดยคุมข้อมือและดันกลับโดยไม่กระแทก', array['triceps','shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000009'::uuid, 'Incline Dumbbell Press', 'incline dumbbell press', 'dumbbell', 'chest', 'ปรับม้านั่งเอียง เก็บสะบักและลดดัมบ์เบลอย่างสม่ำเสมอก่อนดันขึ้น', array['shoulders','triceps']::text[]),
    ('00000000-0000-0000-0000-000000000010'::uuid, 'Chest Press Machine', 'chest press machine', 'machine', 'chest', 'ปรับเบาะให้มืออยู่ระดับอก กดด้ามไปข้างหน้าโดยไม่ยกไหล่และคืนกลับช้า ๆ', array['triceps','shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000011'::uuid, 'Pec Deck Fly', 'pec deck fly', 'machine', 'chest', 'ตั้งเบาะให้ข้อศอกอยู่ระดับอก กอดเข้าหากันด้วยอกและหลีกเลี่ยงการกระแทกแขน', array['shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000012'::uuid, 'Cable Crossover', 'cable crossover', 'cable', 'chest', 'ยืนก้าวหนึ่งข้าง เกร็งลำตัวและนำมือมาบรรจบด้านหน้าอกโดยคุมสายกลับ', array['shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000013'::uuid, 'Cable Chest Fly', 'cable chest fly', 'cable', 'chest', 'ตั้งสายระดับอก รักษาข้อศอกงอเล็กน้อยและบีบอกโดยไม่เหวี่ยงตัว', array['shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000014'::uuid, 'Push-Up', 'push-up', 'bodyweight', 'chest', 'วางมือใต้หรือกว้างกว่าไหล่เล็กน้อย เกร็งลำตัวเป็นเส้นตรงและลดอกใกล้พื้น', array['triceps','shoulders','core']::text[]),
    ('00000000-0000-0000-0000-000000000015'::uuid, 'Chest-Lean Dips', 'chest-lean dips', 'bodyweight', 'chest', 'เอนไหล่ไปด้านหน้าเล็กน้อย ลดตัวด้วยการคุมช่วงไหล่และดันกลับโดยไม่แกว่ง', array['triceps','shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000016'::uuid, 'Barbell Bent-Over Row', 'barbell bent-over row', 'barbell', 'back', 'พับสะโพกให้หลังเป็นกลาง ดึงบาร์เข้าลำตัวและหยุดบีบสะบักก่อนลดลง', array['biceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000017'::uuid, 'Seated Cable Row', 'seated cable row', 'cable', 'back', 'นั่งหลังตรง ดึงมือเข้าหาลำตัวโดยไม่โยกและปล่อยสายกลับจนแขนเหยียด', array['biceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000018'::uuid, 'One-Arm Dumbbell Row', 'one-arm dumbbell row', 'dumbbell', 'back', 'พยุงตัวให้มั่นคง ดึงดัมบ์เบลตามแนวลำตัวและคุมการลดลงโดยไม่บิดสะโพก', array['biceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000019'::uuid, 'Chest-Supported Dumbbell Row', 'chest-supported dumbbell row', 'dumbbell', 'back', 'วางอกบนม้านั่ง เก็บคอเป็นกลางและดึงศอกไปด้านหลังโดยไม่ยกไหล่', array['biceps']::text[]),
    ('00000000-0000-0000-0000-000000000020'::uuid, 'T-Bar Row', 't-bar row', 'barbell', 'back', 'พับสะโพกให้ลำตัวนิ่ง ดึงด้ามเข้าหาท้องและลดลงอย่างควบคุม', array['biceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000021'::uuid, 'Barbell Deadlift', 'barbell deadlift', 'barbell', 'hamstrings', 'วางเท้าและบาร์ให้เหมาะ เกร็งลำตัว ดันพื้นและยืนขึ้นโดยรักษาบาร์ชิดลำตัว', array['glutes','back','core']::text[]),
    ('00000000-0000-0000-0000-000000000022'::uuid, 'Face Pull', 'face pull', 'cable', 'back', 'ตั้งสายระดับใบหน้า ดึงเชือกเข้าหาหน้าและหมุนมือออกโดยคุมสะบัก', array['shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000023'::uuid, 'Barbell Front Squat', 'barbell front squat', 'barbell', 'quadriceps', 'วางบาร์ด้านหน้าอก ยกลำตัวตั้งตรงและย่อโดยให้เข่าเคลื่อนตามแนวปลายเท้า', array['glutes','hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000024'::uuid, 'Leg Press', 'leg press', 'machine', 'quadriceps', 'ปรับเบาะให้หลังแนบสนิท ลดแผ่นด้วยการคุมเข่าและดันกลับโดยไม่ล็อกเข่าแรง', array['glutes']::text[]),
    ('00000000-0000-0000-0000-000000000025'::uuid, 'Bulgarian Split Squat', 'bulgarian split squat', 'bodyweight', 'quadriceps', 'วางเท้าหลังบนม้านั่ง รักษาสมดุลและย่อตัวตรงลงก่อนดันด้วยเท้าหน้า', array['glutes','hamstrings']::text[]),
    ('00000000-0000-0000-0000-000000000026'::uuid, 'Dumbbell Walking Lunge', 'dumbbell walking lunge', 'dumbbell', 'quadriceps', 'ก้าวให้มั่นคง ย่อลงโดยเข่าตามปลายเท้าและดันกลับโดยลำตัวไม่เอนไปข้างหน้า', array['glutes','hamstrings']::text[]),
    ('00000000-0000-0000-0000-000000000027'::uuid, 'Leg Extension', 'leg extension', 'machine', 'quadriceps', 'ปรับแกนหมุนให้ตรงข้อเข่า เหยียดด้วยการบีบหน้าขาและลดกลับอย่างช้า ๆ', array[]::text[]),
    ('00000000-0000-0000-0000-000000000028'::uuid, 'Lying Leg Curl', 'lying leg curl', 'machine', 'hamstrings', 'วางสะโพกแนบเบาะ งอเข่าเข้าหาก้นโดยไม่ยกสะโพกและคุมตอนคืนกลับ', array['calves']::text[]),
    ('00000000-0000-0000-0000-000000000029'::uuid, 'Standing Calf Raise', 'standing calf raise', 'machine', 'calves', 'ยืนให้มั่นคง ดันปลายเท้าขึ้นจนสุดและลดส้นลงช้า ๆ ในช่วงที่ควบคุมได้', array[]::text[]),
    ('00000000-0000-0000-0000-000000000030'::uuid, 'Barbell Biceps Curl', 'barbell biceps curl', 'barbell', 'biceps', 'ตรึงข้อศอกข้างลำตัว งอบาร์โดยไม่โยกหลังและลดลงช้าเพื่อรักษาแรงตึง', array[]::text[]),
    ('00000000-0000-0000-0000-000000000031'::uuid, 'Dumbbell Biceps Curl', 'dumbbell biceps curl', 'dumbbell', 'biceps', 'รักษาข้อมือเป็นกลางและข้อศอกนิ่ง สลับหรือยกพร้อมกันโดยไม่ใช้แรงเหวี่ยง', array[]::text[]),
    ('00000000-0000-0000-0000-000000000032'::uuid, 'Hammer Curl', 'hammer curl', 'dumbbell', 'biceps', 'จับดัมบ์เบลแบบค้อน ตรึงข้อศอกและคุมการลดลงตลอดช่วงการเคลื่อนไหว', array[]::text[]),
    ('00000000-0000-0000-0000-000000000033'::uuid, 'Incline Dumbbell Curl', 'incline dumbbell curl', 'dumbbell', 'biceps', 'นั่งพิงม้านั่งเอียง ปล่อยแขนตามธรรมชาติและงอโดยไม่ขยับต้นแขน', array[]::text[]),
    ('00000000-0000-0000-0000-000000000034'::uuid, 'Cable Biceps Curl', 'cable biceps curl', 'cable', 'biceps', 'ยืนห่างจากจุดยึดพอเหมาะ ตรึงข้อศอกและดึงมือขึ้นโดยคุมสายกลับ', array[]::text[]),
    ('00000000-0000-0000-0000-000000000035'::uuid, 'Cable Triceps Pushdown', 'cable triceps pushdown', 'cable', 'triceps', 'ตรึงข้อศอกไว้ข้างลำตัว กดเชือกลงจนแขนเกือบเหยียดสุดและคืนช้า ๆ', array[]::text[]),
    ('00000000-0000-0000-0000-000000000036'::uuid, 'Overhead Cable Triceps Extension', 'overhead cable triceps extension', 'cable', 'triceps', 'หันหลังให้จุดยึด เก็บซี่โครงและเหยียดศอกเหนือศีรษะโดยไม่แอ่นหลัง', array[]::text[]),
    ('00000000-0000-0000-0000-000000000037'::uuid, 'Dumbbell Overhead Triceps Extension', 'dumbbell overhead triceps extension', 'dumbbell', 'triceps', 'ถือดัมบ์เบลเหนือศีรษะ ตรึงต้นแขนและงอศอกลงก่อนเหยียดกลับ', array[]::text[]),
    ('00000000-0000-0000-0000-000000000038'::uuid, 'Close-Grip Bench Press', 'close-grip bench press', 'barbell', 'triceps', 'จับบาร์แคบกว่าปกติเล็กน้อย เก็บศอกและดันบาร์โดยสะบักยังมั่นคง', array['chest','shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000039'::uuid, 'Bench Dips', 'bench dips', 'bodyweight', 'triceps', 'วางมือบนขอบม้านั่ง ลดตัวด้วยการงอศอกและดันกลับโดยคุมหัวไหล่', array['shoulders','chest']::text[]),
    ('00000000-0000-0000-0000-000000000040'::uuid, 'Plank', 'plank', 'bodyweight', 'core', 'จัดศอกใต้ไหล่ เกร็งหน้าท้องและก้นให้ลำตัวเป็นเส้นตรงโดยไม่ปล่อยหลังแอ่น', array[]::text[]),
    ('00000000-0000-0000-0000-000000000041'::uuid, 'Side Plank', 'side plank', 'bodyweight', 'core', 'วางศอกใต้ไหล่ ยกสะโพกให้ลำตัวตรงและหายใจสม่ำเสมอโดยไม่หมุนตัว', array[]::text[]),
    ('00000000-0000-0000-0000-000000000042'::uuid, 'Dead Bug', 'dead bug', 'bodyweight', 'core', 'กดหลังส่วนล่างกับพื้น เคลื่อนแขนและขาตรงข้ามช้า ๆ โดยไม่เสียตำแหน่งลำตัว', array[]::text[]),
    ('00000000-0000-0000-0000-000000000043'::uuid, 'Bird Dog', 'bird dog', 'bodyweight', 'core', 'ตั้งสี่จุด เกร็งท้องและเหยียดแขนกับขาตรงข้ามโดยรักษาสะโพกไม่หมุน', array['back']::text[]),
    ('00000000-0000-0000-0000-000000000044'::uuid, 'Hanging Knee Raise', 'hanging knee raise', 'bodyweight', 'core', 'แขวนตัวให้ไหล่นิ่ง ยกเข่าด้วยการม้วนเชิงกรานและลดลงโดยไม่แกว่ง', array['shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000045'::uuid, 'Reverse Crunch', 'reverse crunch', 'bodyweight', 'core', 'นอนหงาย เกร็งหน้าท้องม้วนเชิงกรานขึ้นเล็กน้อยแล้ววางกลับอย่างควบคุม', array[]::text[]),
    ('00000000-0000-0000-0000-000000000046'::uuid, 'Cable Crunch', 'cable crunch', 'cable', 'core', 'คุกเข่าหน้าสายเคเบิล ม้วนซี่โครงเข้าหาเชิงกรานโดยไม่ดึงด้วยแขน', array[]::text[]),
    ('00000000-0000-0000-0000-000000000047'::uuid, 'Pallof Press', 'pallof press', 'cable', 'core', 'ยืนตั้งฉากกับสาย เกร็งแกนกลางและดันมือออกโดยต้านแรงหมุนของสาย', array[]::text[]),
    ('00000000-0000-0000-0000-000000000048'::uuid, 'Dumbbell Russian Twist', 'dumbbell russian twist', 'dumbbell', 'core', 'นั่งเอนหลังพอดี เกร็งท้องและหมุนลำตัวโดยไม่เร่งหรือเหวี่ยงดัมบ์เบล', array[]::text[]),
    ('00000000-0000-0000-0000-000000000049'::uuid, 'Ab Wheel Rollout', 'ab wheel rollout', 'bodyweight', 'core', 'เริ่มจากระยะสั้น เกร็งหน้าท้องและกลิ้งออกโดยไม่ปล่อยหลังแอ่นก่อนดึงกลับ', array['shoulders','back']::text[])
), upserted as (
  insert into public.exercises (id, owner_user_id, name, normalized_name, equipment_code, primary_muscle_id, notes, archived_at)
  select c.id, null, c.name, c.normalized_name, c.equipment_code, m.id, c.notes, null
  from catalog c join public.muscles m on m.code = c.primary_code
  on conflict (id) do update set
    owner_user_id = null,
    name = excluded.name,
    normalized_name = excluded.normalized_name,
    equipment_code = excluded.equipment_code,
    primary_muscle_id = excluded.primary_muscle_id,
    notes = excluded.notes,
    archived_at = null,
    version = public.exercises.version + case when
      public.exercises.owner_user_id is distinct from excluded.owner_user_id or
      public.exercises.name is distinct from excluded.name or
      public.exercises.normalized_name is distinct from excluded.normalized_name or
      public.exercises.equipment_code is distinct from excluded.equipment_code or
      public.exercises.primary_muscle_id is distinct from excluded.primary_muscle_id or
      public.exercises.notes is distinct from excluded.notes or
      public.exercises.archived_at is not null
      then 1 else 0 end,
    updated_at = case when
      public.exercises.owner_user_id is distinct from excluded.owner_user_id or
      public.exercises.name is distinct from excluded.name or
      public.exercises.normalized_name is distinct from excluded.normalized_name or
      public.exercises.equipment_code is distinct from excluded.equipment_code or
      public.exercises.primary_muscle_id is distinct from excluded.primary_muscle_id or
      public.exercises.notes is distinct from excluded.notes or
      public.exercises.archived_at is not null
      then now() else public.exercises.updated_at end
  returning id
)
delete from public.exercise_secondary_muscles s
where s.exercise_id in (select id from catalog);

with catalog(id, secondary_codes) as (
  values
    ('00000000-0000-0000-0000-000000000001'::uuid, array['triceps','shoulders']::text[]), ('00000000-0000-0000-0000-000000000002'::uuid, array['glutes','hamstrings','core']::text[]), ('00000000-0000-0000-0000-000000000003'::uuid, array['glutes','back']::text[]), ('00000000-0000-0000-0000-000000000004'::uuid, array['biceps']::text[]), ('00000000-0000-0000-0000-000000000005'::uuid, array['triceps','core']::text[]), ('00000000-0000-0000-0000-000000000006'::uuid, array['biceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000007'::uuid, array['shoulders','triceps']::text[]), ('00000000-0000-0000-0000-000000000008'::uuid, array['triceps','shoulders']::text[]), ('00000000-0000-0000-0000-000000000009'::uuid, array['shoulders','triceps']::text[]), ('00000000-0000-0000-0000-000000000010'::uuid, array['triceps','shoulders']::text[]), ('00000000-0000-0000-0000-000000000011'::uuid, array['shoulders']::text[]), ('00000000-0000-0000-0000-000000000012'::uuid, array['shoulders']::text[]), ('00000000-0000-0000-0000-000000000013'::uuid, array['shoulders']::text[]), ('00000000-0000-0000-0000-000000000014'::uuid, array['triceps','shoulders','core']::text[]), ('00000000-0000-0000-0000-000000000015'::uuid, array['triceps','shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000016'::uuid, array['biceps','core']::text[]), ('00000000-0000-0000-0000-000000000017'::uuid, array['biceps','core']::text[]), ('00000000-0000-0000-0000-000000000018'::uuid, array['biceps','core']::text[]), ('00000000-0000-0000-0000-000000000019'::uuid, array['biceps']::text[]), ('00000000-0000-0000-0000-000000000020'::uuid, array['biceps','core']::text[]), ('00000000-0000-0000-0000-000000000021'::uuid, array['glutes','back','core']::text[]), ('00000000-0000-0000-0000-000000000022'::uuid, array['shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000023'::uuid, array['glutes','hamstrings','core']::text[]), ('00000000-0000-0000-0000-000000000024'::uuid, array['glutes']::text[]), ('00000000-0000-0000-0000-000000000025'::uuid, array['glutes','hamstrings']::text[]), ('00000000-0000-0000-0000-000000000026'::uuid, array['glutes','hamstrings']::text[]), ('00000000-0000-0000-0000-000000000027'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000028'::uuid, array['calves']::text[]), ('00000000-0000-0000-0000-000000000029'::uuid, array[]::text[]),
    ('00000000-0000-0000-0000-000000000030'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000031'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000032'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000033'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000034'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000035'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000036'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000037'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000038'::uuid, array['chest','shoulders']::text[]), ('00000000-0000-0000-0000-000000000039'::uuid, array['shoulders','chest']::text[]),
    ('00000000-0000-0000-0000-000000000040'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000041'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000042'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000043'::uuid, array['back']::text[]), ('00000000-0000-0000-0000-000000000044'::uuid, array['shoulders']::text[]), ('00000000-0000-0000-0000-000000000045'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000046'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000047'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000048'::uuid, array[]::text[]), ('00000000-0000-0000-0000-000000000049'::uuid, array['shoulders','back']::text[])
)
insert into public.exercise_secondary_muscles (exercise_id, muscle_id, sequence_no)
select c.id, m.id, u.sequence_no
from catalog c cross join lateral unnest(c.secondary_codes) with ordinality as u(code, sequence_no)
join public.muscles m on m.code = u.code;
