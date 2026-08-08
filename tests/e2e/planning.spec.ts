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
        await route.fulfill({ json: [{ id: "exercise-bench", name: "Barbell Bench Press", normalized_name: "barbell bench press", equipment_code: "barbell", notes: "", owner_user_id: null, archived_at: null, version: 1, primary_muscle: { code: "chest" }, exercise_secondary_muscles: [] }] });
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
      await route.fulfill({ json: [] });
    });

    await page.route("**/rest/v1/rpc/**", async (route) => {
      const request = route.request();
      const rpc = new URL(request.url()).pathname.split("/").pop();
      const body = request.postDataJSON() as Record<string, unknown>;
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
      if (rpc === "planning_activate_routine") {
        const routineId = String(body.p_id);
        routines.forEach((routine) => { routine.is_active = routine.id === routineId; if (routine.is_active) routine.next_workout_index = 0; routine.revision += 1; });
        await route.fulfill({ json: routineId });
        return;
      }
      await route.fulfill({ json: body.p_id ?? null });
    });

    await page.goto("/plans/templates/new");
    await page.getByLabel("ชื่อ Template").fill("Push A");
    await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    await page.getByRole("button", { name: "บันทึก Template", exact: true }).click();
    await expect(page).toHaveURL(/\/plans\/templates\/template-1$/);

    await page.goto("/plans");
    await page.getByRole("button", { name: "สร้าง Routine", exact: true }).click();
    await page.getByLabel("ชื่อ Routine").fill("A → B → C");
    await page.getByRole("button", { name: "เพิ่มวัน", exact: true }).click();
    await page.getByRole("button", { name: "บันทึก Routine", exact: true }).click();
    await expect(page.getByText("A → B → C")).toBeVisible();
    await page.getByRole("button", { name: "Activate", exact: true }).click();

    await page.goto("/today");
    await expect(page.getByText("Push A").first()).toBeVisible();
    await expect(page.getByText("NEXT TEMPLATE", { exact: true })).toBeVisible();
  });
});
