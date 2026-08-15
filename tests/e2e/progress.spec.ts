import { expect, test, type Page } from "@playwright/test";

const exerciseId = "progress-exercise-1";
const sessionId = "progress-session-1";

async function setup(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("fitness-auth-token", JSON.stringify({ access_token: "e2e-access-token", refresh_token: "e2e-refresh-token", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "e2e-owner", email: "owner@example.test" } }));
  });
  const record = { kind: "ESTIMATED_1RM", exercise_id: exerciseId, exercise_name: "Barbell Bench Press", session_id: sessionId, set_id: "set-1", achieved_at: "2026-08-14T10:00:00.000Z", weight_kg: 80, reps: 5, estimated_1rm_kg: 93.3333, previous_value: 90 };
  const trend = [{ session_id: sessionId, completed_at: "2026-08-14T10:00:00.000Z", volume_kg: 1600, best_weight_kg: 80, best_reps: 8, best_estimated_1rm_kg: 93.3333 }];
  await page.route("**/rest/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/rpc/progress_get_overview")) return route.fulfill({ json: { source_revision: 3, stats: { tracked_exercise_count: 1, recent_session_count: 1, recent_volume_kg: 1600, recent_pr_count: 1 }, recent_records: [record], featured_exercise: { exercise_id: exerciseId, exercise_name: "Barbell Bench Press", last_trained_at: "2026-08-14T10:00:00.000Z", trend } } });
    if (path.endsWith("/rpc/progress_list_exercises")) return route.fulfill({ json: { source_revision: 3, items: [{ exercise_id: exerciseId, exercise_name: "Barbell Bench Press", last_trained_at: "2026-08-14T10:00:00.000Z", session_count: 1, working_set_count: 3, all_time_best_weight_kg: 80, all_time_best_estimated_1rm_kg: 93.3333, latest_session_volume_kg: 1600 }], next_cursor: null } });
    if (path.endsWith("/rpc/progress_get_exercise_detail")) return route.fulfill({ json: { source_revision: 3, exercise_id: exerciseId, exercise_name: "Barbell Bench Press", metrics: { session_count: 1, working_set_count: 3, best_weight_kg: 80, best_reps: 8, best_reps_weight_kg: 80, best_estimated_1rm_kg: 93.3333, total_volume_kg: 1600 }, trend, all_time_records: [record], reps_at_weight: [{ weight_kg: 80, reps: 8, session_id: sessionId, set_id: "set-1", achieved_at: "2026-08-14T10:00:00.000Z" }], has_positive_weight: true, truncated: false } });
    if (path.endsWith("/rpc/progress_list_session_records")) return route.fulfill({ json: { source_revision: 3, records: [record] } });
    return route.fulfill({ json: [] });
  });
}

test.describe("Basic Progress", () => {
  test("shows live overview, search and accessible featured chart", async ({ page }) => {
    await setup(page);
    await page.goto("/progress");
    await expect(page.getByRole("heading", { name: "ความก้าวหน้า" })).toBeVisible();
    await expect(page.getByText("Barbell Bench Press", { exact: true }).first()).toBeVisible();
    await page.getByLabel("ค้นหาท่า").fill("Bench");
    await expect(page.getByText("Best 80 KG")).toBeVisible();
    await page.getByText("ดูข้อมูลกราฟแบบตาราง").click();
    await expect(page.getByRole("table").first()).toBeVisible();
    const widths = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  });

  test("changes range and persists Progress-only LB preference", async ({ page }) => {
    await setup(page);
    await page.goto(`/progress/${exerciseId}`);
    await expect(page.getByRole("heading", { name: "Barbell Bench Press" })).toBeVisible();
    await page.getByRole("button", { name: "30 วัน" }).click();
    await page.getByRole("button", { name: "LB" }).click();
    await expect(page.getByText(/176\.4 LB/).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "LB" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: "History" })).toBeVisible();
  });
});
