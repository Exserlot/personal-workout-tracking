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
  await page.route("**/rest/v1/rpc/history_soft_delete_session", async (route) => await route.fulfill({ json: { result_version: 2 } }));
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

  test("guards AppShell navigation and restores the draft after cancelling", async ({ page }) => {
    await setupAuth(page);
    await mockHistory(page);
    await page.goto(`/history/${sessionId}`);
    await page.getByRole("button", { name: "แก้ไข History" }).click();
    const notes = page.locator("textarea").first();
    await notes.fill("Draft that must not be lost");
    await page.getByRole("link", { name: "วันนี้" }).click({ force: true });
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/history/${sessionId}$`));
    await expect(notes).toHaveValue("Draft that must not be lost");
    await page.getByRole("link", { name: "วันนี้" }).click({ force: true });
    await page.getByRole("button", { name: "ออกจากหน้า" }).click();
    await expect(page).toHaveURL(/\/today$/);
  });

  test("guards browser back and Cancel while keeping the draft", async ({ page }) => {
    await setupAuth(page);
    await mockHistory(page);
    await page.goto("/history");
    await page.locator('a[href^="/history/"]').first().click();
    await page.getByRole("button", { name: "แก้ไข History" }).click();
    const notes = page.locator("textarea").first();
    await notes.fill("Back button draft");
    await page.goBack();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/history/${sessionId}$`));
    await page.getByRole("button", { name: "ยกเลิก" }).click();
    await expect(notes).toHaveValue("Back button draft");
  });

  test("retries a failed delete with the same operation id", async ({ page }) => {
    await setupAuth(page);
    await mockHistory(page);
    await page.unroute("**/rest/v1/rpc/history_soft_delete_session");
    const operationIds: string[] = [];
    let attempt = 0;
    await page.route("**/rest/v1/rpc/history_soft_delete_session", async (route) => {
      const body = route.request().postDataJSON() as { p_operation_id: string };
      operationIds.push(body.p_operation_id);
      attempt += 1;
      if (attempt === 1) {
        await route.fulfill({ status: 503, json: { message: "temporary_failure" } });
        return;
      }
      await route.fulfill({ json: { result_version: 2 } });
    });
    await page.goto(`/history/${sessionId}`);

    await page.getByRole("button", { name: "ลบ Session" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ลบ Session" }).click();
    await expect(page.getByRole("alert")).toContainText("ฐานข้อมูลขัดข้องชั่วคราว");
    await page.getByRole("button", { name: "ลบ Session" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ลบ Session" }).click();

    await expect(page).toHaveURL(/\/history$/);
    expect(operationIds).toHaveLength(2);
    expect(operationIds[1]).toBe(operationIds[0]);
  });

  test("retries a failed update with the same operation id", async ({ page }) => {
    await setupAuth(page);
    await mockHistory(page);
    await page.unroute("**/rest/v1/rpc/history_update_session");
    const operationIds: string[] = [];
    let attempt = 0;
    await page.route("**/rest/v1/rpc/history_update_session", async (route) => {
      const body = route.request().postDataJSON() as { p_operation_id: string };
      operationIds.push(body.p_operation_id);
      attempt += 1;
      if (attempt === 1) {
        await route.fulfill({ status: 503, json: { message: "temporary_failure" } });
        return;
      }
      await route.fulfill({ json: { result_version: 2 } });
    });
    await page.goto(`/history/${sessionId}`);
    await page.getByRole("button", { name: "แก้ไข History" }).click();
    await page.locator("textarea").first().fill("Retry this exact draft");

    await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
    await expect(page.getByRole("alert")).toContainText("ฐานข้อมูลขัดข้องชั่วคราว");
    await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();

    expect(operationIds).toHaveLength(2);
    expect(operationIds[1]).toBe(operationIds[0]);
  });

  test("keeps a conflicted draft until the user confirms a server reload", async ({ page }) => {
    await setupAuth(page);
    await mockHistory(page);
    await page.unroute("**/rest/v1/rpc/history_update_session");
    await page.route("**/rest/v1/rpc/history_update_session", async (route) => {
      await route.fulfill({ status: 409, json: { code: "40001", message: "revision_conflict" } });
    });
    await page.goto(`/history/${sessionId}`);
    await page.getByRole("button", { name: "แก้ไข History" }).click();
    const notes = page.locator("textarea").first();
    await notes.fill("Conflicted local draft");
    await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();

    await expect(notes).toHaveValue("Conflicted local draft");
    await page.getByRole("button", { name: "โหลดข้อมูลจาก Server" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(notes).toHaveValue("Conflicted local draft");
    await page.getByRole("alertdialog").getByRole("button", { name: "โหลดจาก Server" }).click();

    await expect(page.getByRole("status")).toContainText("โหลดข้อมูลล่าสุดจาก Server แล้ว");
    await expect(notes).toHaveValue("Session note");
    await expect(page.getByRole("button", { name: "แก้ไข History" })).toBeVisible();
  });

  test("expands the invalid exercise and focuses the first invalid field", async ({ page }) => {
    await setupAuth(page);
    await mockHistory(page);
    await page.goto(`/history/${sessionId}`);
    await page.getByRole("button", { name: "แก้ไข History" }).click();
    const weight = page.getByRole("spinbutton", { name: "Set 1 weight", exact: true });
    await weight.fill("");
    await page.getByRole("button", { name: "Barbell Bench Press", exact: true }).click();
    await expect(weight).toBeHidden();
    await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();

    await expect(weight).toBeVisible();
    await expect(weight).toBeFocused();
    await expect(weight).toHaveAttribute("aria-invalid", "true");
  });

  test("ignores an older detail response after navigating to another session", async ({ page }) => {
    await setupAuth(page);
    await page.route("**/rest/v1/workout_sessions**", async (route) => {
      const requestedId = new URL(route.request().url()).searchParams.get("id");
      if (requestedId === "eq.history-session-a") {
        await new Promise((resolve) => setTimeout(resolve, 250));
        await route.fulfill({ json: [sessionRow({ id: "history-session-a", template_name_snapshot: "Session A" })] });
        return;
      }
      await route.fulfill({ json: [sessionRow({ id: "history-session-b", template_name_snapshot: "Session B" })] });
    });
    await page.route("**/rest/v1/exercises**", async (route) => await route.fulfill({ json: [] }));
    await page.goto("/history/history-session-a");
    await page.waitForTimeout(20);
    await page.evaluate(() => {
      window.history.pushState({}, "", "/history/history-session-b");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await expect(page.getByRole("heading", { name: "Session B" })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByRole("heading", { name: "Session B" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Session A" })).toHaveCount(0);
  });

  test("keeps cached detail read-only until a canonical reload succeeds", async ({ page }) => {
    await setupAuth(page);
    await mockHistory(page);
    await page.goto(`/history/${sessionId}`);
    await expect(page.getByRole("button", { name: "แก้ไข History" })).toBeEnabled();
    await page.unroute("**/rest/v1/workout_sessions**");
    await page.route("**/rest/v1/workout_sessions**", async (route) => {
      await route.fulfill({ status: 503, json: { message: "offline" } });
    });
    await page.reload();

    await expect(page.getByText(/cache แบบอ่านอย่างเดียว/)).toBeVisible();
    await expect(page.getByRole("button", { name: "แก้ไข History" })).toBeDisabled();
    await page.unroute("**/rest/v1/workout_sessions**");
    await page.route("**/rest/v1/workout_sessions**", async (route) => await route.fulfill({ json: [sessionRow()] }));
    await page.getByRole("button", { name: "Retry server" }).click();

    await expect(page.getByRole("button", { name: "แก้ไข History" })).toBeEnabled();
  });
});
