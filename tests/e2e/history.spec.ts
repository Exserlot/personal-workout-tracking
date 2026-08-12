import { expect, test, type Page } from "@playwright/test";

const sessionId = "history-session-1";

async function setupAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("fitness-auth-token", JSON.stringify({ access_token: "e2e-access-token", refresh_token: "e2e-refresh-token", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "e2e-owner", email: "owner@example.test" } }));
  });
}

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: sessionId, owner_device_id: "device-1", source_type: "AD_HOC", source_routine_id: null, source_routine_day_id: null, source_template_id: null, source_routine_revision: null, source_template_revision: null, routine_name_snapshot: null, day_label_snapshot: null, template_name_snapshot: "History Push", status: "COMPLETED", started_at: "2026-08-10T10:00:00.000Z", completed_at: "2026-08-10T11:00:00.000Z", notes: "Session note", version: 1, edited_at: null, deleted_at: null,
    workout_session_exercises: [{ id: "history-exercise-1", source_template_exercise_id: null, source_exercise_id: "starter-bench", sequence_no: 1, exercise_name_snapshot: "Barbell Bench Press", equipment_code_snapshot: "barbell", notes: "", workout_session_exercise_muscles: [], workout_session_sets: [{ id: "history-set-1", source_template_set_id: null, sequence_no: 1, set_kind_code: "WORKING", is_to_failure: false, target_reps_min: 8, target_reps_max: 10, target_weight_value: 70, target_weight_unit: "KG", target_weight_kg: 70, target_effort_metric: "RPE", target_effort_value: 8, target_rest_seconds: 90, actual_weight_value: 70, actual_weight_unit: "KG", actual_weight_kg: 70, actual_reps: 8, actual_effort_metric: "RPE", actual_effort_value: 8, actual_rest_seconds: 90, status: "COMPLETED", completed_at: "2026-08-10T10:10:00.000Z", notes: "" }] }],
    ...overrides,
  };
}

async function mockHistory(page: Page) {
  let current = sessionRow();
  await page.route("**/rest/v1/rpc/history_list_sessions", async (route) => await route.fulfill({ json: [{ session_id: sessionId, label: "History Push", source_type: "AD_HOC", completed_at: "2026-08-10T11:00:00.000Z", duration_seconds: 3600, exercise_count: 1, completed_working_set_count: 1, volume_kg: 560, edited_at: null }] }));
  await page.route("**/rest/v1/workout_sessions**", async (route) => await route.fulfill({ json: [current] }));
  await page.route("**/rest/v1/exercises**", async (route) => await route.fulfill({ json: [{ id: "starter-bench", name: "Barbell Bench Press", normalized_name: "barbell bench press", equipment_code: "barbell", notes: "", owner_user_id: null, archived_at: null, version: 1, primary_muscle: { code: "chest" }, exercise_secondary_muscles: [] }] }));
  await page.route("**/rest/v1/rpc/history_update_session", async (route) => { current = sessionRow({ version: 2, notes: "Updated note" }); await route.fulfill({ json: { result_version: 2 } }); });
  await page.route("**/rest/v1/rpc/history_soft_delete_session", async (route) => await route.fulfill({ json: { result_version: 3 } }));
}

test.describe("Workout History", () => {
  test("loads sessions, opens snapshot and saves a retrospective edit", async ({ page }) => {
    await setupAuth(page);
    await mockHistory(page);
    await page.goto("/history");
    await expect(page.getByText("History Push", { exact: true }).first()).toBeVisible();
    await page.locator('a[href^="/history/"]').first().click();
    await expect(page.locator("span#exercise-history-exercise-1")).toBeVisible();
    await page.getByRole("button", { name: "แก้ไข History" }).click();
    await page.locator("textarea").first().fill("Updated note");
    await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
    await expect(page.getByRole("status")).toContainText("บันทึกการแก้ไขแล้ว");
  });

  test("keeps mutation controls disabled offline and prevents horizontal overflow", async ({ page, context }) => {
    await setupAuth(page);
    await mockHistory(page);
    await page.goto(`/history/${sessionId}`);
    await context.setOffline(true);
    await expect(page.getByText(/Offline/)).toBeVisible();
    await expect(page.getByRole("button", { name: "แก้ไข History" })).toBeDisabled();
    const widths = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  });
});
