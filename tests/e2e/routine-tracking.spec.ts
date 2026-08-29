import { expect, test } from "@playwright/test";

const week = {
  id: "week-1", routine_id: "routine-1", routine_name: "Push Pull Legs", routine_revision: 1,
  week_start: "2026-08-10", week_end: "2026-08-16", timezone: "Asia/Bangkok",
  frequency_actual: 3, frequency_target: 3, coverage_actual: 2, coverage_target: 3,
  status: "FINALIZED", locked_at: "2026-08-10T01:00:00Z", finalized_at: "2026-08-17T00:00:00Z",
  days: [
    { id: "push", routine_day_id: "routine-push", template_id: "template-push", display_order: 1, day_label: "Push", template_name: "Push", completed_count: 2, active_count: 0 },
    { id: "pull", routine_day_id: "routine-pull", template_id: "template-pull", display_order: 2, day_label: "Pull", template_name: "Pull", completed_count: 0, active_count: 0 },
    { id: "legs", routine_day_id: "routine-legs", template_id: "template-legs", display_order: 3, day_label: "Legs", template_name: "Legs", completed_count: 1, active_count: 0 },
  ],
};

async function authenticate(page: import("@playwright/test").Page) {
  await page.addInitScript(() => window.localStorage.setItem("fitness-auth-token", JSON.stringify({ access_token: "e2e", refresh_token: "e2e", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "owner", email: "owner@example.test" } })));
}

test("read keeps a weekly warning, dismiss hides only the notification, and history remains", async ({ page }) => {
  let readAt: string | null = null;
  let dismissed = false;
  await authenticate(page);
  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop();
    if (rpc === "routine_list_notifications") {
      await route.fulfill({ json: dismissed ? [] : [{ id: "notification-1", week_plan_id: "week-1", title: "Routine สัปดาห์ที่แล้วไม่ครบ", content: "คุณยังไม่ได้เล่น Pull", frequency_actual: 3, frequency_target: 3, coverage_actual: 2, coverage_target: 3, missing_day_labels: ["Pull"], read_at: readAt, dismissed_at: null, created_at: "2026-08-17T00:00:00Z", week_start: "2026-08-10", week_end: "2026-08-16" }] });
      return;
    }
    if (rpc === "routine_mark_notification_read") { readAt = "2026-08-18T00:00:00Z"; await route.fulfill({ json: null }); return; }
    if (rpc === "routine_dismiss_notification") { dismissed = true; await route.fulfill({ json: null }); return; }
    if (rpc === "routine_list_history") { await route.fulfill({ json: [week] }); return; }
    if (rpc === "routine_get_week") { await route.fulfill({ json: week }); return; }
    await route.fulfill({ json: null });
  });

  await page.goto("/notifications");
  await expect(page.getByText("คุณยังไม่ได้เล่น Pull", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Routine สัปดาห์ที่แล้วไม่ครบ/ }).click();
  await expect(page).toHaveURL(/\/routine-history\/week-1$/);
  await expect(page.getByText("ไม่ได้เล่น", { exact: true })).toBeVisible();

  await page.goto("/notifications");
  await expect(page.getByText("READ", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "ปิดรายการ", exact: true }).click();
  await expect(page.getByText("ไม่มีคำเตือนค้างอยู่", { exact: true })).toBeVisible();
  await page.goto("/routine-history");
  await expect(page.getByRole("heading", { name: "Push Pull Legs" })).toBeVisible();
});

test("does not navigate when a notification cannot be marked read", async ({ page }) => {
  await authenticate(page);
  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop();
    if (rpc === "preferences_get_or_create_timezone") { await route.fulfill({ json: "Asia/Bangkok" }); return; }
    if (rpc === "preferences_get_or_create_timezone") { await route.fulfill({ json: "Asia/Bangkok" }); return; }
    if (rpc === "routine_list_notifications") {
      await route.fulfill({ json: [{ id: "notification-1", week_plan_id: "week-1", title: "Routine สัปดาห์ที่แล้วไม่ครบ", content: "คุณยังไม่ได้เล่น Pull", frequency_actual: 3, frequency_target: 3, coverage_actual: 2, coverage_target: 3, missing_day_labels: ["Pull"], read_at: null, dismissed_at: null, created_at: "2026-08-17T00:00:00Z", week_start: "2026-08-10", week_end: "2026-08-16" }] });
      return;
    }
    if (rpc === "routine_mark_notification_read") {
      await route.fulfill({ status: 500, json: { message: "temporary_failure" } });
      return;
    }
    await route.fulfill({ json: null });
  });

  await page.goto("/notifications");
  await page.getByRole("button", { name: /Routine สัปดาห์ที่แล้วไม่ครบ/ }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole("alert")).toContainText("อ่าน Notification ไม่สำเร็จ");
});

test("shows a separate notification for each missed week", async ({ page }) => {
  await authenticate(page);
  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop();
    if (rpc === "preferences_get_or_create_timezone") { await route.fulfill({ json: "Asia/Bangkok" }); return; }
    if (rpc === "routine_list_notifications") {
      await route.fulfill({ json: [
        { id: "notification-2", week_plan_id: "week-2", title: "Routine สัปดาห์ที่แล้วไม่ครบ", content: "คุณยังไม่ได้เล่น Legs", frequency_actual: 1, frequency_target: 3, coverage_actual: 1, coverage_target: 3, missing_day_labels: ["Pull", "Legs"], read_at: null, dismissed_at: null, created_at: "2026-08-24T00:00:00Z", week_start: "2026-08-17", week_end: "2026-08-23" },
        { id: "notification-1", week_plan_id: "week-1", title: "Routine สัปดาห์ที่แล้วไม่ครบ", content: "คุณยังไม่ได้เล่น Pull", frequency_actual: 2, frequency_target: 3, coverage_actual: 2, coverage_target: 3, missing_day_labels: ["Pull"], read_at: null, dismissed_at: null, created_at: "2026-08-17T00:00:00Z", week_start: "2026-08-10", week_end: "2026-08-16" },
      ] });
      return;
    }
    await route.fulfill({ json: null });
  });

  await page.goto("/notifications");
  await expect(page.getByText("คุณยังไม่ได้เล่น Legs", { exact: true })).toBeVisible();
  await expect(page.getByText("คุณยังไม่ได้เล่น Pull", { exact: true })).toBeVisible();
  await expect(page.getByText("Frequency 1/3 · Coverage 1/3", { exact: true })).toBeVisible();
  await expect(page.getByText("Frequency 2/3 · Coverage 2/3", { exact: true })).toBeVisible();
});

test("shows the active Routine Day for a provisional closed week", async ({ page }) => {
  await authenticate(page);
  const provisionalWeek = {
    ...week,
    status: "PROVISIONAL",
    finalized_at: null,
    days: week.days.map((day) => day.id === "pull" ? { ...day, active_count: 1 } : day),
  };
  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop();
    if (rpc === "preferences_get_or_create_timezone") { await route.fulfill({ json: "Asia/Bangkok" }); return; }
    if (rpc === "routine_get_week") {
      await route.fulfill({ json: provisionalWeek });
      return;
    }
    await route.fulfill({ json: null });
  });

  await page.goto("/routine-history/week-1");
  await expect(page.getByText("กำลังดำเนินการ", { exact: true })).toBeVisible();
  await expect(page.getByText(/ผลลัพธ์จึงยังเป็น Provisional/)).toBeVisible();
});
