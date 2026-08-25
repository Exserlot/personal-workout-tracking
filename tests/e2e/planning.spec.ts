import { expect, test } from "@playwright/test";

type MockSet = { id: string } & Record<string, unknown>;
type MockTemplate = {
  id: string;
  name: string;
  notes: string;
  revision: number;
  archived_at: string | null;
  template_exercises: Array<{
    id: string;
    exercise_id: string;
    sequence_no: number;
    notes: string;
    exercise: { name: string; archived_at: string | null };
    template_set_prescriptions: MockSet[];
  }>;
};
type MockRoutine = {
  id: string;
  name: string;
  weekly_frequency_target: number;
  next_workout_index: number;
  is_active: boolean;
  revision: number;
  archived_at: string | null;
  routine_days: Array<Record<string, unknown>>;
};

test.describe("Workout Plans and Routine", () => {
  test("creates a Template, creates an A → B → C Routine and previews the next day", async ({ page }) => {
    const templates: MockTemplate[] = [];
    const routines: MockRoutine[] = [];
    let nextId = 1;
    let activeRoutineId: string | null = null;

    const currentWeek = () => {
      const routine = routines.find((item) => item.id === activeRoutineId);
      return routine ? {
        id: "week-current", routine_id: routine.id, routine_name: routine.name, routine_revision: routine.revision,
        week_start: "2026-08-17", week_end: "2026-08-23", timezone: "Asia/Bangkok",
        frequency_actual: 0, frequency_target: routine.weekly_frequency_target,
        coverage_actual: 0, coverage_target: routine.routine_days.length,
        status: "OPEN", locked_at: null, finalized_at: null,
        days: routine.routine_days.map((day, index) => ({ id: `week-day-${index + 1}`, routine_day_id: String(day.id), template_id: String(day.template_id), display_order: index + 1, day_label: String(day.label), template_name: (day.template as MockTemplate).name, completed_count: 0 })),
      } : null;
    };

    await page.addInitScript(() => {
      window.localStorage.setItem("fitness-auth-token", JSON.stringify({
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "e2e-owner", email: "owner@example.test" },
      }));
    });

    await page.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const resource = url.pathname.split("/").pop();
      if (resource === "exercises") {
        await route.fulfill({ json: [{ id: "exercise-bench", name: "Barbell Bench Press", normalized_name: "barbell bench press", equipment_code: "barbell", notes: "เก็บสะบัก ลดบาร์อย่างควบคุม และดันกลับโดยไม่ยกไหล่", owner_user_id: null, archived_at: null, version: 1, primary_muscle: { code: "chest" }, exercise_secondary_muscles: [] }] });
        return;
      }
      if (resource === "workout_templates") {
        const idFilter = url.searchParams.get("id")?.replace("eq.", "");
        await route.fulfill({ json: idFilter ? templates.filter((template) => template.id === idFilter) : templates });
        return;
      }
      if (resource === "routines") {
        await route.fulfill({ json: routines });
        return;
      }
      if (resource === "devices") {
        await route.fulfill({ json: [{ id: "11111111-1111-4111-8111-111111111111", label: "E2E", last_seen_at: "2026-08-09T10:00:00.000Z" }] });
        return;
      }
      if (resource === "workout_sessions" || resource === "workout_session_exercises") {
        await route.fulfill({ json: [] });
        return;
      }
      await route.fulfill({ json: [] });
    });

    await page.route("**/rest/v1/rpc/**", async (route) => {
      const request = route.request();
      const rpc = new URL(request.url()).pathname.split("/").pop();
      const body = request.postDataJSON() as Record<string, unknown>;
      if (rpc === "workout_register_device") {
        await route.fulfill({ json: "11111111-1111-4111-8111-111111111111" });
        return;
      }
      if (rpc === "routine_get_current_week") {
        await route.fulfill({ json: { timezone: "Asia/Bangkok", current_week_start: "2026-08-17", next_week_start: "2026-08-24", current_plan: currentWeek(), scheduled_activation: null } });
        return;
      }
      if (rpc === "routine_list_notifications") { await route.fulfill({ json: [] }); return; }
      if (rpc === "planning_create_template") {
        const id = `template-${nextId++}`;
        const exercises = body.p_exercises as Array<{ exercise_id: string; sequence_no: number; notes: string; sets: Array<Record<string, unknown>> }>;
        const template = {
          id,
          name: String(body.p_name),
          notes: String(body.p_notes ?? ""),
          revision: 1,
          archived_at: null,
          template_exercises: exercises.map((exercise, index) => ({
            id: `${id}-exercise-${index}`,
            exercise_id: exercise.exercise_id,
            sequence_no: exercise.sequence_no,
            notes: exercise.notes,
            exercise: { name: "Barbell Bench Press", archived_at: null },
            template_set_prescriptions: exercise.sets.map((set, setIndex) => ({ id: `${id}-set-${setIndex}`, ...set })),
          })),
        };
        templates.push(template);
        await route.fulfill({ json: id });
        return;
      }
      if (rpc === "planning_create_routine") {
        const id = `routine-${nextId++}`;
        const days = body.p_days as Array<{ template_id: string; sequence_no: number; label: string; notes: string }>;
        routines.push({ id, name: String(body.p_name), weekly_frequency_target: Number(body.p_weekly_frequency_target), next_workout_index: 0, is_active: false, revision: 1, archived_at: null, routine_days: days.map((day) => ({ id: `${id}-${day.sequence_no}`, ...day, template: templates.find((template) => template.id === day.template_id) })) });
        await route.fulfill({ json: id });
        return;
      }
      if (rpc === "planning_update_routine") {
        const routineId = String(body.p_id);
        const routine = routines.find((item) => item.id === routineId);
        const days = body.p_days as Array<{ template_id: string; sequence_no: number; label: string; notes: string }>;
        if (routine) {
          routine.name = String(body.p_name);
          routine.weekly_frequency_target = Number(body.p_weekly_frequency_target);
          routine.routine_days = days.map((day) => ({ id: `${routineId}-${day.sequence_no}`, ...day, template: templates.find((template) => template.id === day.template_id) }));
          routine.revision += 1;
        }
        await route.fulfill({ json: routineId });
        return;
      }
      if (rpc === "planning_activate_routine") {
        const routineId = String(body.p_id);
        activeRoutineId = routineId;
        await route.fulfill({ json: String(body.p_effective_week_start) });
        return;
      }
      if (rpc === "planning_deactivate_routine") {
        activeRoutineId = null;
        await route.fulfill({ json: String(body.p_effective_week_start) });
        return;
      }
      await route.fulfill({ json: body.p_id ?? null });
    });

    await page.goto("/plans/templates/new");
    await page.getByLabel("ชื่อ Template").fill("Push A");
    await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
    const pickerTrigger = page.getByRole("button", { name: "เลือก Exercise จาก Library", exact: true });
    await pickerTrigger.click();
    const picker = page.getByRole("dialog", { name: "Exercise Library" });
    const pickerClose = page.getByRole("button", { name: "ปิด Library", exact: true });
    await expect(picker).toBeVisible();
    await expect(picker).not.toContainText("ค้นหา ดูวิธีเล่น และเพิ่ม Exercise ลงใน Template");
    await expect(picker).toHaveCSS("padding-left", "0px");
    await expect(picker).toHaveCSS("padding-right", "0px");
    await expect.poll(async () => picker.evaluate((dialog) => (
      Array.from(dialog.querySelectorAll("*"))
        .filter((element) => ["auto", "scroll"].includes(window.getComputedStyle(element).overflowY))
        .length
    ))).toBe(1);
    await expect(pickerClose).toHaveCSS("width", "48px");
    await expect(pickerClose).toHaveCSS("height", "48px");
    await expect(pickerClose.locator("svg")).toHaveCSS("width", "24px");
    await expect(pickerClose.locator("svg")).toHaveCSS("height", "24px");
    await pickerClose.click();
    await expect(picker).toBeHidden();
    await expect(pickerTrigger).toBeFocused();

    await pickerTrigger.click();
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await expect(pickerTrigger).toBeFocused();

    await pickerTrigger.click();
    const viewport = page.viewportSize();
    await page.mouse.click((viewport?.width ?? 390) - 4, 100);
    await expect(picker).toBeHidden();

    await pickerTrigger.click();
    await picker.getByText("ดูวิธีเล่น", { exact: true }).click();
    await expect(picker.getByText("เก็บสะบัก ลดบาร์อย่างควบคุม และดันกลับโดยไม่ยกไหล่")).toBeVisible();
    await expect(picker.getByRole("link", { name: "ค้นหาวิดีโอสาธิต" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/results?search_query=Barbell%20Bench%20Press%20exercise%20proper%20form%20tutorial",
    );
    await picker.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    await picker.getByRole("button", { name: "ปิด Library", exact: true }).click();
    await page.getByLabel("Reps ต่ำสุด").fill("08");
    await expect(page.getByLabel("Reps ต่ำสุด")).toHaveValue("8");
    await page.getByLabel("พัก").fill("0180");
    await expect(page.getByLabel("พัก")).toHaveValue("180");
    await page.getByLabel("น้ำหนักเป้าหมาย").fill("00.5");
    await expect(page.getByLabel("น้ำหนักเป้าหมาย")).toHaveValue("0.5");
    await page.getByLabel("ค่า Effort").fill("00008");
    await expect(page.getByLabel("ค่า Effort")).toHaveValue("8");
    await page.locator("form").evaluate((form) => (form as HTMLFormElement).requestSubmit());
    await expect(page).toHaveURL(/\/plans\/templates\/template-1$/);

    await page.goto("/plans");
    await expect(page.getByText("ยังไม่มี Active Routine", { exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "สร้าง Routine", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "สร้าง Routine", exact: true }).click();
    await expect(page.getByText("P-05 · ROUTINE EDITOR", { exact: true })).toBeVisible();
    await expect(page.getByText("ACTIVE ROUTINE", { exact: true })).toBeHidden();
    await page.getByLabel("ชื่อ Routine").fill("A → B → C");
    await page.getByRole("button", { name: "เพิ่มวัน", exact: true }).click();
    const templateSelect = page.getByLabel("Template", { exact: true });
    await expect(templateSelect.locator('option[value=""]')).toHaveCount(0);
    await expect(templateSelect.locator('option[value="__create-template__"]')).toHaveText("+ เพิ่ม Template ใหม่");
    await templateSelect.selectOption("__create-template__");
    await expect(page).toHaveURL(/\/plans\/templates\/new$/);

    await page.goto("/plans");
    await page.getByRole("button", { name: "สร้าง Routine", exact: true }).click();
    await page.getByLabel("ชื่อ Routine").fill("A → B → C");
    await page.getByRole("button", { name: "เพิ่มวัน", exact: true }).click();
    await page.getByRole("button", { name: "บันทึก Routine", exact: true }).click();
    await expect(page.getByText("A → B → C")).toBeVisible();
    await expect(page.getByText("Other Routines", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Activate", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ยืนยัน", exact: true }).click();
    await expect(page.getByText(/เปิดใช้งาน Routine ตั้งแต่สัปดาห์/)).toBeVisible();

    await page.goto("/plans");
    const editActiveRoutine = page.getByRole("button", { name: /Active Routine/ });
    await expect(editActiveRoutine).toBeVisible();
    await expect(editActiveRoutine).toBeEnabled();
    await editActiveRoutine.click();
    await expect(page.getByRole("heading", { name: /Routine/ }).first()).toBeVisible();
    await expect(page.getByText("ACTIVE ROUTINE", { exact: true })).toBeHidden();
    const addDay = page.getByRole("button", { name: "เพิ่มวัน", exact: true });
    await expect(addDay).toBeEnabled();
    await addDay.click();
    await expect(page.getByLabel("ชื่อวัน")).toHaveCount(2);
    await page.getByRole("button", { name: "บันทึก Routine", exact: true }).click();

    await page.getByRole("button", { name: "Inactive", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ยืนยัน", exact: true }).click();
    await expect(page.getByText(/ปิดใช้งาน Routine ตั้งแต่สัปดาห์/)).toBeVisible();
    await expect(page.getByText("Other Routines", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Activate", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Activate", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ยืนยัน", exact: true }).click();
    await expect(page.getByText(/เปิดใช้งาน Routine ตั้งแต่สัปดาห์/)).toBeVisible();

    await page.goto("/today");
    await expect(page.getByText("Push A").first()).toBeVisible();
    await expect(page.getByText("NEXT WORKOUT", { exact: true })).toBeVisible();
  });
});
