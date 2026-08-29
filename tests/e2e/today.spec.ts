import { expect, test, type Page } from "@playwright/test";

const deviceId = "11111111-1111-4111-8111-111111111111";
const otherDeviceId = "99999999-9999-4999-8999-999999999999";
const sessionId = "22222222-2222-4222-8222-222222222222";

function templateRow(id = "template-push", name = "Push Day", exerciseCount = 5) {
  return {
    id,
    name,
    notes: "",
    revision: 1,
    archived_at: null,
    template_exercises: Array.from({ length: exerciseCount }, (_, index) => ({
      id: `${id}-exercise-${index + 1}`,
      exercise_id: `exercise-${index + 1}`,
      sequence_no: index + 1,
      notes: "",
      exercise: { name: `Exercise ${index + 1}`, archived_at: null },
      template_set_prescriptions: [{
        id: `${id}-set-${index + 1}`,
        sequence_no: 1,
        set_kind_code: "WORKING",
        is_to_failure: false,
        target_reps_min: 8,
        target_reps_max: 10,
        target_weight_value: 40,
        target_weight_unit: "KG",
        target_weight_kg: 40,
        target_effort_metric: "RPE",
        target_effort_value: 8,
        target_rest_seconds: 90,
      }],
    })),
  };
}

function routineRow(template = templateRow()) {
  return {
    id: "routine-1",
    name: "Push Pull",
    weekly_frequency_target: 3,
    next_workout_index: 0,
    is_active: true,
    revision: 1,
    archived_at: null,
    routine_days: [{
      id: "day-1",
      template_id: template.id,
      sequence_no: 1,
      label: "Push A",
      notes: "",
      template: { name: template.name, archived_at: null },
    }],
  };
}

function sessionRow(ownerDeviceId = deviceId) {
  return {
    id: sessionId,
    owner_device_id: ownerDeviceId,
    source_type: "PLANNED",
    source_routine_id: "routine-1",
    source_routine_day_id: "day-1",
    source_template_id: "template-push",
    source_routine_revision: 1,
    source_template_revision: 1,
    routine_name_snapshot: "Push Pull",
    day_label_snapshot: "Push A",
    template_name_snapshot: "Push Day",
    status: "ACTIVE",
    started_at: "2026-08-10T10:00:00.000Z",
    completed_at: null,
    notes: "",
    version: 1,
    edited_at: null,
    workout_session_exercises: [{
      id: "session-exercise-1",
      source_template_exercise_id: "template-exercise-1",
      source_exercise_id: "exercise-1",
      sequence_no: 1,
      exercise_name_snapshot: "Bench Press",
      equipment_code_snapshot: "barbell",
      notes: "",
      workout_session_exercise_muscles: [],
      workout_session_sets: [{
        id: "session-set-1",
        source_template_set_id: "template-set-1",
        sequence_no: 1,
        set_kind_code: "WORKING",
        is_to_failure: false,
        target_reps_min: 8,
        target_reps_max: 10,
        target_weight_value: 40,
        target_weight_unit: "KG",
        target_weight_kg: 40,
        target_effort_metric: "RPE",
        target_effort_value: 8,
        target_rest_seconds: 90,
        actual_weight_value: 40,
        actual_weight_unit: "KG",
        actual_weight_kg: 40,
        actual_reps: 10,
        actual_effort_metric: "RPE",
        actual_effort_value: 8,
        actual_rest_seconds: 90,
        status: "COMPLETED",
        completed_at: "2026-08-10T10:05:00.000Z",
        notes: "",
      }],
    }],
  };
}

function cachedDomainSession() {
  return {
    id: sessionId,
    ownerDeviceId: deviceId,
    sourceType: "PLANNED",
    sourceRoutineId: "routine-1",
    sourceRoutineDayId: "day-1",
    sourceRoutineWeekPlanId: "week-1",
    sourceRoutineWeekPlanDayId: "week-day-1",
    sourceTemplateId: "template-push",
    sourceRoutineRevision: 1,
    sourceTemplateRevision: 1,
    routineNameSnapshot: "Push Pull",
    dayLabelSnapshot: "Push A",
    templateNameSnapshot: "Cached Push Day",
    status: "ACTIVE",
    startedAt: "2026-08-10T10:00:00.000Z",
    completedAt: null,
    notes: "",
    version: 1,
    editedAt: null,
    exercises: [],
  };
}

async function authenticate(page: Page) {
  await page.addInitScript(({ id }) => {
    window.localStorage.setItem("fitness-auth-token", JSON.stringify({
      access_token: "e2e-access-token",
      refresh_token: "e2e-refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "e2e-owner", email: "owner@example.test" },
    }));
    window.localStorage.setItem("fitness-workout-device-id", id);
  }, { id: deviceId });
}

async function mockToday(
  page: Page,
  options: {
    activeSession?: ReturnType<typeof sessionRow> | null;
    routine?: ReturnType<typeof routineRow> | null;
    templates?: ReturnType<typeof templateRow>[];
    completedCounts?: number[];
    frequencyActual?: number;
  } = {},
) {
  const activeSession = options.activeSession ?? null;
  const templates = options.templates ?? [templateRow(), templateRow("template-pull", "Pull Day", 2)];
  const routine = options.routine === undefined ? routineRow(templates[0]) : options.routine;
  const currentWeek = routine ? {
    id: "week-1",
    routine_id: routine.id,
    routine_name: routine.name,
    routine_revision: routine.revision,
    week_start: "2026-08-17",
    week_end: "2026-08-23",
    timezone: "Asia/Bangkok",
    frequency_actual: options.frequencyActual ?? 0,
    frequency_target: routine.weekly_frequency_target,
    coverage_actual: 0,
    coverage_target: routine.routine_days.length,
    status: "OPEN",
    locked_at: null,
    finalized_at: null,
    days: routine.routine_days.map((day, index) => ({ id: `week-day-${index + 1}`, routine_day_id: day.id, template_id: day.template_id, display_order: index + 1, day_label: day.label, template_name: day.template.name, completed_count: options.completedCounts?.[index] ?? 0, active_count: 0 })),
  } : null;

  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.pathname.split("/").pop();
    if (resource === "devices") {
      await route.fulfill({ json: [{ id: deviceId, label: "E2E", last_seen_at: "2026-08-10T10:00:00.000Z" }] });
      return;
    }
    if (resource === "workout_sessions") {
      const byId = url.searchParams.get("id")?.replace("eq.", "");
      const row = activeSession ?? sessionRow();
      if (byId) {
        await route.fulfill({ json: byId === row.id ? [row] : [] });
      } else {
        await route.fulfill({ json: activeSession ? [activeSession] : [] });
      }
      return;
    }
    if (resource === "workout_session_exercises") {
      await route.fulfill({ json: [{
        source_exercise_id: "exercise-1",
        workout_sessions: { started_at: "2026-08-03T10:00:00.000Z", status: "COMPLETED", deleted_at: null },
        workout_session_sets: [{
          actual_weight_value: 37.5,
          actual_weight_unit: "KG",
          actual_weight_kg: 37.5,
          actual_reps: 10,
          actual_effort_metric: "RPE",
          actual_effort_value: 8,
          completed_at: "2026-08-03T10:05:00.000Z",
          set_kind_code: "WORKING",
          status: "COMPLETED",
        }],
      }] });
      return;
    }
    if (resource === "routines") {
      await route.fulfill({ json: routine ? [routine] : [] });
      return;
    }
    if (resource === "workout_templates") {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      await route.fulfill({ json: id ? templates.filter((template) => template.id === id) : templates });
      return;
    }
    await route.fulfill({ json: [] });
  });

  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop();
    if (rpc === "workout_register_device") {
      await route.fulfill({ json: deviceId });
      return;
    }
    if (rpc === "preferences_get_or_create_timezone") {
      await route.fulfill({ json: "Asia/Bangkok" });
      return;
    }
    if (rpc === "routine_get_current_week") {
      await route.fulfill({ json: { timezone: "Asia/Bangkok", current_week_start: "2026-08-17", next_week_start: "2026-08-24", current_plan: currentWeek, scheduled_activation: null } });
      return;
    }
    if (rpc === "routine_list_notifications") { await route.fulfill({ json: [] }); return; }
    if (rpc === "workout_start_planned" || rpc === "workout_start_adhoc") {
      await route.fulfill({ json: sessionId });
      return;
    }
    await route.fulfill({ json: null });
  });
}

test.describe("Today experience", () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test("puts planned actions before facts on mobile and keeps the dialog accessible", async ({ page }) => {
    await mockToday(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/today");

    const planned = page.getByTestId("today-planned-workout");
    await expect(planned.getByText("NEXT WORKOUT", { exact: true })).toBeVisible();
    await expect(planned.getByText("ครั้งก่อน 37.5 KG × 10 · RPE 8", { exact: true }).first()).toBeVisible();
    const start = planned.getByRole("button", { name: "Start Workout", exact: true });
    const facts = planned.getByText("ท่าฝึก", { exact: true }).first();
    await expect(start).toBeVisible();
    expect((await start.boundingBox())!.y).toBeLessThan((await facts.boundingBox())!.y);
    const mobilePreview = planned.getByTestId("mobile-exercise-preview");
    await expect(mobilePreview.getByText("Exercise 5", { exact: true })).toHaveCount(0);
    await planned.getByRole("button", { name: "ดูทั้งหมด 5 ท่า", exact: true }).click();
    await expect(mobilePreview.getByText("Exercise 5", { exact: true })).toBeVisible();

    const trigger = planned.getByRole("button", { name: "เลือก Ad-hoc Workout", exact: true });
    await trigger.click();
    const dialog = page.getByTestId("ad-hoc-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("ค้นหา Template").fill("Pull");
    await expect(dialog.getByRole("button", { name: "เริ่ม Pull Day" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "เริ่ม Push Day" })).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("prioritizes an owner Active Session and hides competing start actions", async ({ page }) => {
    await mockToday(page, { activeSession: sessionRow() });
    await page.goto("/today");

    const active = page.getByTestId("today-active-session");
    await expect(active.getByRole("link", { name: "Resume Workout", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Workout", exact: true })).toHaveCount(0);
    await expect(page.getByText(/Ad-hoc Workout/, { exact: true })).toHaveCount(0);
    await expect(active).toContainText("1");
  });

  test("recommends every uncovered Day after Legs and keeps Legs repeatable", async ({ page }) => {
    const templates = [templateRow("template-push", "Push Day", 2), templateRow("template-pull", "Pull Day", 2), templateRow("template-legs", "Legs Day", 2)];
    const routine = routineRow(templates[0]);
    routine.name = "Push Pull Legs";
    routine.routine_days = templates.map((template, index) => ({ id: `day-${index + 1}`, template_id: template.id, sequence_no: index + 1, label: ["Push", "Pull", "Legs"][index], notes: "", template: { name: template.name, archived_at: null } }));
    await mockToday(page, { templates, routine, completedCounts: [0, 0, 1], frequencyActual: 1 });
    await page.goto("/today");

    const planned = page.getByTestId("today-planned-workout");
    await expect(planned.getByRole("button", { name: /Push ยังไม่ครอบคลุม/ })).toBeVisible();
    await expect(planned.getByRole("button", { name: /Pull ยังไม่ครอบคลุม/ })).toBeVisible();
    await expect(planned.getByRole("button", { name: /Legs เล่นแล้ว 1 ครั้ง/ })).toBeVisible();
    await expect(planned.getByText("เล่นแล้ว 1 ครั้ง", { exact: true })).toBeVisible();
    await expect(planned.getByText("1/3", { exact: true })).toBeVisible();
    await expect(planned.getByText("0/3", { exact: true })).toBeVisible();
  });

  test("offers to continue an Active Session from another device", async ({ page }) => {
    await mockToday(page, { activeSession: sessionRow(otherDeviceId) });
    await page.goto("/today");

    const active = page.getByTestId("today-active-session");
    await expect(active.getByRole("link", { name: "เปิดเพื่อทำต่อบนเครื่องนี้", exact: true })).toBeVisible();
    await expect(active).toContainText("เครื่องเดิมจะเปลี่ยนเป็นอ่านอย่างเดียว");
  });

  test("keeps one Plans action and one Ad-hoc action when no Routine exists", async ({ page }) => {
    await mockToday(page, { routine: null });
    await page.goto("/today");

    const empty = page.getByTestId("today-no-routine");
    await expect(empty.getByRole("link", { name: "จัดการ Routine", exact: true })).toHaveCount(1);
    await expect(empty.getByRole("button", { name: "เริ่ม Ad-hoc Workout", exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Start Workout", exact: true })).toHaveCount(0);
  });

  test("keeps a cached Active Session available when the server is offline", async ({ page }) => {
    await page.goto("/@vite/client");
    await page.evaluate(async (session) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("personal-workout-tracker", 4);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("active-session-cache")) {
            request.result.createObjectStore("active-session-cache", { keyPath: "sessionId" });
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("active-session-cache", "readwrite");
          transaction.objectStore("active-session-cache").put({
            sessionId: session.id,
            session,
            draftValues: {},
            currentExerciseId: null,
            timer: { status: "idle", durationSeconds: 0, endsAt: null, pausedRemainingSeconds: 0 },
            cachedAt: Date.now(),
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    }, cachedDomainSession());
    await page.route("**/rest/v1/**", (route) => route.abort("internetdisconnected"));

    await page.goto("/today");
    const active = page.getByTestId("today-active-session");
    await expect(active.getByRole("link", { name: "เปิด Workout", exact: true })).toBeVisible();
    await expect(active).toContainText("Cached Push Day");
    await expect(active).toContainText("ยังเชื่อมต่อ Supabase ไม่ได้");
    await expect(page.getByText(/Ad-hoc Workout/, { exact: true })).toHaveCount(0);
  });
});
