-- Expand the reviewed starter catalog from 50 to 100 exercises without changing taxonomy.
-- Stable UUIDs and collision checks keep incremental deployments deterministic.

do $$
begin
  if exists (
    select 1
    from (values
      ('00000000-0000-0000-0000-000000000051'::uuid, 'decline barbell bench press'),
      ('00000000-0000-0000-0000-000000000052'::uuid, 'dumbbell chest fly'),
      ('00000000-0000-0000-0000-000000000053'::uuid, 'incline chest press machine'),
      ('00000000-0000-0000-0000-000000000054'::uuid, 'chin-up'),
      ('00000000-0000-0000-0000-000000000055'::uuid, 'inverted row'),
      ('00000000-0000-0000-0000-000000000056'::uuid, 'machine seated row'),
      ('00000000-0000-0000-0000-000000000057'::uuid, 'straight-arm cable pulldown'),
      ('00000000-0000-0000-0000-000000000058'::uuid, 'dumbbell pullover'),
      ('00000000-0000-0000-0000-000000000059'::uuid, 'dumbbell shoulder press'),
      ('00000000-0000-0000-0000-000000000060'::uuid, 'machine shoulder press'),
      ('00000000-0000-0000-0000-000000000061'::uuid, 'single-arm kettlebell press'),
      ('00000000-0000-0000-0000-000000000062'::uuid, 'dumbbell lateral raise'),
      ('00000000-0000-0000-0000-000000000063'::uuid, 'cable lateral raise'),
      ('00000000-0000-0000-0000-000000000064'::uuid, 'machine lateral raise'),
      ('00000000-0000-0000-0000-000000000065'::uuid, 'dumbbell front raise'),
      ('00000000-0000-0000-0000-000000000066'::uuid, 'reverse pec deck fly'),
      ('00000000-0000-0000-0000-000000000067'::uuid, 'bent-over dumbbell reverse fly'),
      ('00000000-0000-0000-0000-000000000068'::uuid, 'cable external rotation'),
      ('00000000-0000-0000-0000-000000000069'::uuid, 'ez-bar curl'),
      ('00000000-0000-0000-0000-000000000070'::uuid, 'preacher curl machine'),
      ('00000000-0000-0000-0000-000000000071'::uuid, 'concentration curl'),
      ('00000000-0000-0000-0000-000000000072'::uuid, 'barbell skull crusher'),
      ('00000000-0000-0000-0000-000000000073'::uuid, 'dumbbell triceps kickback'),
      ('00000000-0000-0000-0000-000000000074'::uuid, 'single-arm cable triceps pushdown'),
      ('00000000-0000-0000-0000-000000000075'::uuid, 'kettlebell goblet squat'),
      ('00000000-0000-0000-0000-000000000076'::uuid, 'hack squat machine'),
      ('00000000-0000-0000-0000-000000000077'::uuid, 'smith machine squat'),
      ('00000000-0000-0000-0000-000000000078'::uuid, 'dumbbell step-up'),
      ('00000000-0000-0000-0000-000000000079'::uuid, 'bodyweight reverse lunge'),
      ('00000000-0000-0000-0000-000000000080'::uuid, 'dumbbell romanian deadlift'),
      ('00000000-0000-0000-0000-000000000081'::uuid, 'single-leg dumbbell romanian deadlift'),
      ('00000000-0000-0000-0000-000000000082'::uuid, 'seated leg curl'),
      ('00000000-0000-0000-0000-000000000083'::uuid, 'standing single-leg curl'),
      ('00000000-0000-0000-0000-000000000084'::uuid, 'barbell good morning'),
      ('00000000-0000-0000-0000-000000000085'::uuid, 'nordic hamstring curl'),
      ('00000000-0000-0000-0000-000000000086'::uuid, 'kettlebell romanian deadlift'),
      ('00000000-0000-0000-0000-000000000087'::uuid, 'barbell hip thrust'),
      ('00000000-0000-0000-0000-000000000088'::uuid, 'dumbbell hip thrust'),
      ('00000000-0000-0000-0000-000000000089'::uuid, 'bodyweight glute bridge'),
      ('00000000-0000-0000-0000-000000000090'::uuid, 'single-leg glute bridge'),
      ('00000000-0000-0000-0000-000000000091'::uuid, 'cable pull-through'),
      ('00000000-0000-0000-0000-000000000092'::uuid, 'cable glute kickback'),
      ('00000000-0000-0000-0000-000000000093'::uuid, 'hip abduction machine'),
      ('00000000-0000-0000-0000-000000000094'::uuid, 'cable hip abduction'),
      ('00000000-0000-0000-0000-000000000095'::uuid, 'kettlebell swing'),
      ('00000000-0000-0000-0000-000000000096'::uuid, 'seated calf raise'),
      ('00000000-0000-0000-0000-000000000097'::uuid, 'leg press calf raise'),
      ('00000000-0000-0000-0000-000000000098'::uuid, 'single-leg standing calf raise'),
      ('00000000-0000-0000-0000-000000000099'::uuid, 'dumbbell standing calf raise'),
      ('00000000-0000-0000-0000-000000000100'::uuid, 'tibialis raise')
    ) as catalog(expected_id, normalized_name)
    join public.exercises existing
      on existing.normalized_name = catalog.normalized_name
     and existing.id <> catalog.expected_id
     and existing.owner_user_id is null
  ) then
    raise exception 'expanded starter exercise normalized_name conflicts with an existing UUID';
  end if;
end;
$$;

with catalog(id, name, normalized_name, equipment_code, primary_code, notes, secondary_codes) as (
  values
    ('00000000-0000-0000-0000-000000000051'::uuid, 'Decline Barbell Bench Press', 'decline barbell bench press', 'barbell', 'chest', 'ปรับม้านั่งลาดลงและล็อกขาให้มั่นคง เก็บสะบัก ลดบาร์ช่วงอกล่างอย่างควบคุมแล้วดันกลับ', array['triceps','shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000052'::uuid, 'Dumbbell Chest Fly', 'dumbbell chest fly', 'dumbbell', 'chest', 'นอนบนม้านั่ง เก็บสะบักและกางแขนโดยงอศอกเล็กน้อย ก่อนบีบอกพาดัมบ์เบลกลับขึ้น', array['shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000053'::uuid, 'Incline Chest Press Machine', 'incline chest press machine', 'machine', 'chest', 'ปรับเบาะให้ด้ามอยู่ระดับอกบน เก็บไหล่และดันด้ามไปข้างหน้า ก่อนคืนกลับอย่างช้า ๆ', array['triceps','shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000054'::uuid, 'Chin-Up', 'chin-up', 'bodyweight', 'back', 'จับบาร์หงายมือ เกร็งลำตัวและดึงอกเข้าหาบาร์ ก่อนลดตัวจนแขนเหยียดอย่างควบคุม', array['biceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000055'::uuid, 'Inverted Row', 'inverted row', 'bodyweight', 'back', 'จัดลำตัวเป็นเส้นตรงใต้บาร์ ดึงอกเข้าหาบาร์พร้อมบีบสะบัก แล้วลดตัวโดยไม่ปล่อยสะโพกตก', array['biceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000056'::uuid, 'Machine Seated Row', 'machine seated row', 'machine', 'back', 'ปรับเบาะและแผ่นรองอกให้พอดี ดึงด้ามเข้าหาลำตัวพร้อมบีบสะบัก โดยไม่ยกไหล่', array['biceps']::text[]),
    ('00000000-0000-0000-0000-000000000057'::uuid, 'Straight-Arm Cable Pulldown', 'straight-arm cable pulldown', 'cable', 'back', 'ยืนพับสะโพกเล็กน้อย รักษาแขนเกือบตรงและกดบาร์ลงหาต้นขา โดยไม่เหวี่ยงลำตัว', array['core']::text[]),
    ('00000000-0000-0000-0000-000000000058'::uuid, 'Dumbbell Pullover', 'dumbbell pullover', 'dumbbell', 'back', 'นอนบนม้านั่ง จับดัมบ์เบลเหนืออกและลดผ่านศีรษะในช่วงที่คุมได้ ก่อนดึงกลับโดยเก็บซี่โครง', array['chest','triceps']::text[]),
    ('00000000-0000-0000-0000-000000000059'::uuid, 'Dumbbell Shoulder Press', 'dumbbell shoulder press', 'dumbbell', 'shoulders', 'ตั้งดัมบ์เบลระดับไหล่ เกร็งลำตัวและดันขึ้นเหนือศีรษะ ก่อนลดกลับโดยไม่แอ่นหลัง', array['triceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000060'::uuid, 'Machine Shoulder Press', 'machine shoulder press', 'machine', 'shoulders', 'ปรับเบาะให้ด้ามอยู่ระดับไหล่ ดันขึ้นอย่างมั่นคงและคืนกลับช้า ๆ โดยไม่ยกไหล่เข้าหาหู', array['triceps']::text[]),
    ('00000000-0000-0000-0000-000000000061'::uuid, 'Single-Arm Kettlebell Press', 'single-arm kettlebell press', 'kettlebell', 'shoulders', 'ถือเคตเทิลเบลที่หัวไหล่ เกร็งลำตัวและดันขึ้นด้วยแขนเดียว โดยรักษาลำตัวไม่เอียง', array['triceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000062'::uuid, 'Dumbbell Lateral Raise', 'dumbbell lateral raise', 'dumbbell', 'shoulders', 'ยกดัมบ์เบลออกด้านข้างด้วยศอกงอเล็กน้อยถึงระดับที่คุมได้ แล้วลดลงโดยไม่เหวี่ยง', array[]::text[]),
    ('00000000-0000-0000-0000-000000000063'::uuid, 'Cable Lateral Raise', 'cable lateral raise', 'cable', 'shoulders', 'ยืนข้างจุดยึดต่ำ ยกแขนออกด้านข้างโดยคงไหล่ต่ำ และคืนสายกลับอย่างควบคุม', array[]::text[]),
    ('00000000-0000-0000-0000-000000000064'::uuid, 'Machine Lateral Raise', 'machine lateral raise', 'machine', 'shoulders', 'ปรับเบาะให้แกนเครื่องตรงกับหัวไหล่ ยกแผ่นรองออกด้านข้างและลดกลับช้า ๆ', array[]::text[]),
    ('00000000-0000-0000-0000-000000000065'::uuid, 'Dumbbell Front Raise', 'dumbbell front raise', 'dumbbell', 'shoulders', 'ยกดัมบ์เบลไปด้านหน้าถึงระดับไหล่โดยลำตัวนิ่ง แล้วลดลงช้า ๆ โดยไม่ใช้แรงเหวี่ยง', array['chest']::text[]),
    ('00000000-0000-0000-0000-000000000066'::uuid, 'Reverse Pec Deck Fly', 'reverse pec deck fly', 'machine', 'shoulders', 'หันหน้าเข้าหาเครื่อง วางแขนกับด้ามและกางออกพร้อมบีบสะบัก โดยไม่ยกไหล่', array['back']::text[]),
    ('00000000-0000-0000-0000-000000000067'::uuid, 'Bent-Over Dumbbell Reverse Fly', 'bent-over dumbbell reverse fly', 'dumbbell', 'shoulders', 'พับสะโพกให้หลังเป็นกลาง กางแขนออกด้านข้างพร้อมบีบสะบัก แล้วลดดัมบ์เบลช้า ๆ', array['back']::text[]),
    ('00000000-0000-0000-0000-000000000068'::uuid, 'Cable External Rotation', 'cable external rotation', 'cable', 'shoulders', 'ตั้งสายระดับข้อศอก ตรึงต้นแขนชิดลำตัวและหมุนปลายแขนออก โดยใช้แรงต้านที่ควบคุมได้', array['back']::text[]),
    ('00000000-0000-0000-0000-000000000069'::uuid, 'EZ-Bar Curl', 'ez-bar curl', 'barbell', 'biceps', 'จับบาร์ตามมุมที่สบาย ตรึงข้อศอกข้างลำตัวและงอบาร์ขึ้น ก่อนลดลงโดยไม่โยกหลัง', array[]::text[]),
    ('00000000-0000-0000-0000-000000000070'::uuid, 'Preacher Curl Machine', 'preacher curl machine', 'machine', 'biceps', 'วางต้นแขนแนบแผ่นรอง งอข้อศอกยกด้ามขึ้นและคุมการลดลง โดยไม่ยกไหล่ออกจากตำแหน่ง', array[]::text[]),
    ('00000000-0000-0000-0000-000000000071'::uuid, 'Concentration Curl', 'concentration curl', 'dumbbell', 'biceps', 'นั่งพยุงต้นแขนกับต้นขา งอดัมบ์เบลขึ้นโดยข้อศอกนิ่ง และลดลงจนสุดช่วงที่ควบคุมได้', array[]::text[]),
    ('00000000-0000-0000-0000-000000000072'::uuid, 'Barbell Skull Crusher', 'barbell skull crusher', 'barbell', 'triceps', 'นอนถือบาร์เหนืออก ตรึงต้นแขนและงอศอกลดบาร์ใกล้หน้าผาก ก่อนเหยียดกลับอย่างควบคุม', array['shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000073'::uuid, 'Dumbbell Triceps Kickback', 'dumbbell triceps kickback', 'dumbbell', 'triceps', 'พับสะโพกและตรึงต้นแขนขนานลำตัว เหยียดศอกไปด้านหลังแล้วคืนกลับโดยไม่แกว่งแขน', array[]::text[]),
    ('00000000-0000-0000-0000-000000000074'::uuid, 'Single-Arm Cable Triceps Pushdown', 'single-arm cable triceps pushdown', 'cable', 'triceps', 'ยืนมั่นคง ตรึงข้อศอกข้างลำตัวและกดด้ามลงด้วยแขนเดียว ก่อนคืนสายกลับช้า ๆ', array[]::text[]),
    ('00000000-0000-0000-0000-000000000075'::uuid, 'Kettlebell Goblet Squat', 'kettlebell goblet squat', 'kettlebell', 'quadriceps', 'ถือเคตเทิลเบลชิดอก เกร็งลำตัวและย่อตามแนวเข่า โดยรักษาเท้าแนบพื้นก่อนยืนกลับ', array['glutes','core']::text[]),
    ('00000000-0000-0000-0000-000000000076'::uuid, 'Hack Squat Machine', 'hack squat machine', 'machine', 'quadriceps', 'วางหลังและไหล่แนบเครื่อง จัดเท้าให้มั่นคง ย่อตัวในช่วงที่คุมได้แล้วดันกลับโดยไม่ล็อกเข่าแรง', array['glutes','hamstrings']::text[]),
    ('00000000-0000-0000-0000-000000000077'::uuid, 'Smith Machine Squat', 'smith machine squat', 'machine', 'quadriceps', 'วางบาร์บนหลังส่วนบน จัดเท้าให้สมดุลกับแนวบาร์ ย่อตัวอย่างควบคุมแล้วดันพื้นยืนขึ้น', array['glutes','hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000078'::uuid, 'Dumbbell Step-Up', 'dumbbell step-up', 'dumbbell', 'quadriceps', 'วางเท้าทั้งฝ่าเท้าบนกล่อง ดันผ่านเท้าด้านบนเพื่อยืนขึ้นและก้าวลงอย่างควบคุม', array['glutes','hamstrings']::text[]),
    ('00000000-0000-0000-0000-000000000079'::uuid, 'Bodyweight Reverse Lunge', 'bodyweight reverse lunge', 'bodyweight', 'quadriceps', 'ก้าวขาไปด้านหลังและย่อตัวตรงลง ให้เข่าหน้าเคลื่อนตามปลายเท้า ก่อนดันกลับสู่ท่ายืน', array['glutes','hamstrings']::text[]),
    ('00000000-0000-0000-0000-000000000080'::uuid, 'Dumbbell Romanian Deadlift', 'dumbbell romanian deadlift', 'dumbbell', 'hamstrings', 'ถือดัมบ์เบลชิดขา ดันสะโพกไปด้านหลังโดยรักษาหลังเป็นกลาง แล้วบีบก้นกลับขึ้น', array['glutes','back']::text[]),
    ('00000000-0000-0000-0000-000000000081'::uuid, 'Single-Leg Dumbbell Romanian Deadlift', 'single-leg dumbbell romanian deadlift', 'dumbbell', 'hamstrings', 'ยืนขาเดียว พับสะโพกพร้อมเหยียดขาอีกข้างไปหลัง รักษาสะโพกเสมอกันแล้วกลับขึ้นอย่างมั่นคง', array['glutes','core']::text[]),
    ('00000000-0000-0000-0000-000000000082'::uuid, 'Seated Leg Curl', 'seated leg curl', 'machine', 'hamstrings', 'ปรับแกนเครื่องให้ตรงข้อเข่า ล็อกต้นขาและงอขาลง ก่อนคืนกลับอย่างช้า ๆ', array['calves']::text[]),
    ('00000000-0000-0000-0000-000000000083'::uuid, 'Standing Single-Leg Curl', 'standing single-leg curl', 'machine', 'hamstrings', 'จัดเข่าให้ตรงแกนเครื่อง งอขาข้างเดียวเข้าหาก้นโดยสะโพกนิ่ง แล้วลดกลับอย่างควบคุม', array['calves']::text[]),
    ('00000000-0000-0000-0000-000000000084'::uuid, 'Barbell Good Morning', 'barbell good morning', 'barbell', 'hamstrings', 'วางบาร์บนหลังส่วนบน งอเข่าเล็กน้อยและพับสะโพกโดยรักษาหลังเป็นกลาง ก่อนดันสะโพกกลับ', array['glutes','back','core']::text[]),
    ('00000000-0000-0000-0000-000000000085'::uuid, 'Nordic Hamstring Curl', 'nordic hamstring curl', 'bodyweight', 'hamstrings', 'ยึดข้อเท้าให้มั่นคง รักษาลำตัวตรงและลดตัวไปด้านหน้าช้า ๆ ใช้มือช่วยรับเมื่อเกินช่วงที่ควบคุมได้', array['calves','glutes']::text[]),
    ('00000000-0000-0000-0000-000000000086'::uuid, 'Kettlebell Romanian Deadlift', 'kettlebell romanian deadlift', 'kettlebell', 'hamstrings', 'ถือเคตเทิลเบลใกล้ลำตัว ดันสะโพกไปด้านหลังและรักษาหลังเป็นกลาง ก่อนยืนกลับด้วยแรงจากสะโพก', array['glutes','back']::text[]),
    ('00000000-0000-0000-0000-000000000087'::uuid, 'Barbell Hip Thrust', 'barbell hip thrust', 'barbell', 'glutes', 'พาดหลังส่วนบนบนม้านั่ง วางบาร์เหนือสะโพกและดันสะโพกขึ้นโดยเก็บซี่โครง ก่อนลดลงช้า ๆ', array['hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000088'::uuid, 'Dumbbell Hip Thrust', 'dumbbell hip thrust', 'dumbbell', 'glutes', 'พาดหลังส่วนบนบนม้านั่ง วางดัมบ์เบลเหนือสะโพกและดันขึ้นจนลำตัวได้แนว โดยไม่แอ่นหลัง', array['hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000089'::uuid, 'Bodyweight Glute Bridge', 'bodyweight glute bridge', 'bodyweight', 'glutes', 'นอนหงายชันเข่า เกร็งหน้าท้องและดันสะโพกขึ้นด้วยส้นเท้า ก่อนลดลงโดยคุมหลังเป็นกลาง', array['hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000090'::uuid, 'Single-Leg Glute Bridge', 'single-leg glute bridge', 'bodyweight', 'glutes', 'นอนชันเข่าข้างหนึ่ง ยกขาอีกข้างและดันสะโพกขึ้นโดยรักษาเชิงกรานเสมอกัน', array['hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000091'::uuid, 'Cable Pull-Through', 'cable pull-through', 'cable', 'glutes', 'หันหลังให้สายและจับเชือกระหว่างขา พับสะโพกไปด้านหลัง แล้วดันสะโพกไปข้างหน้าโดยลำตัวมั่นคง', array['hamstrings','back']::text[]),
    ('00000000-0000-0000-0000-000000000092'::uuid, 'Cable Glute Kickback', 'cable glute kickback', 'cable', 'glutes', 'ติดสายที่ข้อเท้า พยุงตัวให้มั่นคงและเหยียดขาไปด้านหลังโดยสะโพกไม่หมุน ก่อนคืนกลับช้า ๆ', array['hamstrings']::text[]),
    ('00000000-0000-0000-0000-000000000093'::uuid, 'Hip Abduction Machine', 'hip abduction machine', 'machine', 'glutes', 'นั่งให้หลังและสะโพกมั่นคง กางเข่าออกด้านข้างในช่วงที่คุมได้ แล้วคืนกลับโดยไม่กระแทกแผ่นน้ำหนัก', array[]::text[]),
    ('00000000-0000-0000-0000-000000000094'::uuid, 'Cable Hip Abduction', 'cable hip abduction', 'cable', 'glutes', 'ติดสายที่ข้อเท้าและยืนข้างจุดยึด กางขาออกด้านข้างโดยลำตัวไม่เอียง แล้วคืนกลับช้า ๆ', array['core']::text[]),
    ('00000000-0000-0000-0000-000000000095'::uuid, 'Kettlebell Swing', 'kettlebell swing', 'kettlebell', 'glutes', 'พับสะโพกพาเคตเทิลเบลผ่านระหว่างขา แล้วเหยียดสะโพกส่งน้ำหนักขึ้นโดยไม่ยกด้วยแขน', array['hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000096'::uuid, 'Seated Calf Raise', 'seated calf raise', 'machine', 'calves', 'วางปลายเท้าบนแท่นและแผ่นรองเหนือต้นขา ดันส้นขึ้นจนสุดแล้วลดลงช้า ๆ', array[]::text[]),
    ('00000000-0000-0000-0000-000000000097'::uuid, 'Leg Press Calf Raise', 'leg press calf raise', 'machine', 'calves', 'วางปลายเท้าบริเวณขอบแผ่น Leg Press เหยียดเข่าคงที่และดันข้อเท้าขึ้นลงในช่วงที่ควบคุมได้', array['quadriceps']::text[]),
    ('00000000-0000-0000-0000-000000000098'::uuid, 'Single-Leg Standing Calf Raise', 'single-leg standing calf raise', 'bodyweight', 'calves', 'ยืนขาเดียวพร้อมจับที่พยุง ดันปลายเท้ายกส้นขึ้นและลดลงช้า ๆ โดยรักษาข้อเท้าให้อยู่ในแนว', array['core']::text[]),
    ('00000000-0000-0000-0000-000000000099'::uuid, 'Dumbbell Standing Calf Raise', 'dumbbell standing calf raise', 'dumbbell', 'calves', 'ถือดัมบ์เบลและยืนมั่นคง ดันปลายเท้ายกส้นขึ้นจนสุด ก่อนลดลงอย่างควบคุม', array['core']::text[]),
    ('00000000-0000-0000-0000-000000000100'::uuid, 'Tibialis Raise', 'tibialis raise', 'bodyweight', 'calves', 'ยืนพิงกำแพงโดยวางส้นเท้ากับพื้น ยกปลายเท้าขึ้นเข้าหาหน้าแข้งแล้วลดกลับช้า ๆ', array[]::text[])
), upserted as (
  insert into public.exercises (id, owner_user_id, name, normalized_name, equipment_code, primary_muscle_id, notes, archived_at)
  select c.id, null, c.name, c.normalized_name, c.equipment_code, m.id, c.notes, null
  from catalog c
  join public.muscles m on m.code = c.primary_code
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
delete from public.exercise_secondary_muscles secondary
where secondary.exercise_id in (select id from upserted);

with catalog(id, secondary_codes) as (
  values
    ('00000000-0000-0000-0000-000000000051'::uuid, array['triceps','shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000052'::uuid, array['shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000053'::uuid, array['triceps','shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000054'::uuid, array['biceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000055'::uuid, array['biceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000056'::uuid, array['biceps']::text[]),
    ('00000000-0000-0000-0000-000000000057'::uuid, array['core']::text[]),
    ('00000000-0000-0000-0000-000000000058'::uuid, array['chest','triceps']::text[]),
    ('00000000-0000-0000-0000-000000000059'::uuid, array['triceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000060'::uuid, array['triceps']::text[]),
    ('00000000-0000-0000-0000-000000000061'::uuid, array['triceps','core']::text[]),
    ('00000000-0000-0000-0000-000000000062'::uuid, array[]::text[]),
    ('00000000-0000-0000-0000-000000000063'::uuid, array[]::text[]),
    ('00000000-0000-0000-0000-000000000064'::uuid, array[]::text[]),
    ('00000000-0000-0000-0000-000000000065'::uuid, array['chest']::text[]),
    ('00000000-0000-0000-0000-000000000066'::uuid, array['back']::text[]),
    ('00000000-0000-0000-0000-000000000067'::uuid, array['back']::text[]),
    ('00000000-0000-0000-0000-000000000068'::uuid, array['back']::text[]),
    ('00000000-0000-0000-0000-000000000069'::uuid, array[]::text[]),
    ('00000000-0000-0000-0000-000000000070'::uuid, array[]::text[]),
    ('00000000-0000-0000-0000-000000000071'::uuid, array[]::text[]),
    ('00000000-0000-0000-0000-000000000072'::uuid, array['shoulders']::text[]),
    ('00000000-0000-0000-0000-000000000073'::uuid, array[]::text[]),
    ('00000000-0000-0000-0000-000000000074'::uuid, array[]::text[]),
    ('00000000-0000-0000-0000-000000000075'::uuid, array['glutes','core']::text[]),
    ('00000000-0000-0000-0000-000000000076'::uuid, array['glutes','hamstrings']::text[]),
    ('00000000-0000-0000-0000-000000000077'::uuid, array['glutes','hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000078'::uuid, array['glutes','hamstrings']::text[]),
    ('00000000-0000-0000-0000-000000000079'::uuid, array['glutes','hamstrings']::text[]),
    ('00000000-0000-0000-0000-000000000080'::uuid, array['glutes','back']::text[]),
    ('00000000-0000-0000-0000-000000000081'::uuid, array['glutes','core']::text[]),
    ('00000000-0000-0000-0000-000000000082'::uuid, array['calves']::text[]),
    ('00000000-0000-0000-0000-000000000083'::uuid, array['calves']::text[]),
    ('00000000-0000-0000-0000-000000000084'::uuid, array['glutes','back','core']::text[]),
    ('00000000-0000-0000-0000-000000000085'::uuid, array['calves','glutes']::text[]),
    ('00000000-0000-0000-0000-000000000086'::uuid, array['glutes','back']::text[]),
    ('00000000-0000-0000-0000-000000000087'::uuid, array['hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000088'::uuid, array['hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000089'::uuid, array['hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000090'::uuid, array['hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000091'::uuid, array['hamstrings','back']::text[]),
    ('00000000-0000-0000-0000-000000000092'::uuid, array['hamstrings']::text[]),
    ('00000000-0000-0000-0000-000000000093'::uuid, array[]::text[]),
    ('00000000-0000-0000-0000-000000000094'::uuid, array['core']::text[]),
    ('00000000-0000-0000-0000-000000000095'::uuid, array['hamstrings','core']::text[]),
    ('00000000-0000-0000-0000-000000000096'::uuid, array[]::text[]),
    ('00000000-0000-0000-0000-000000000097'::uuid, array['quadriceps']::text[]),
    ('00000000-0000-0000-0000-000000000098'::uuid, array['core']::text[]),
    ('00000000-0000-0000-0000-000000000099'::uuid, array['core']::text[]),
    ('00000000-0000-0000-0000-000000000100'::uuid, array[]::text[])
)
insert into public.exercise_secondary_muscles (exercise_id, muscle_id, sequence_no)
select c.id, m.id, u.sequence_no
from catalog c
cross join lateral unnest(c.secondary_codes) with ordinality as u(code, sequence_no)
join public.muscles m on m.code = u.code;
