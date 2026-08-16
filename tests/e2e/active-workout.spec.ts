import { expect, test, type Page, type Route } from "@playwright/test";

const deviceId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const idempotentRpcPattern = "**/rest/v1/rpc/workout_apply_command_idempotent";

const abortSync = (route: Route) => route.abort("failed");

async function syncQueueCount(page: Page) {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open("personal-workout-tracker", 4);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("workout-sync-operations", "readonly");
      const count = transaction.objectStore("workout-sync-operations").count();
      count.onsuccess = () => resolve(count.result);
      count.onerror = () => reject(count.error);
      transaction.oncomplete = () => database.close();
    };
    request.onerror = () => reject(request.error);
  }));
}

async function waitForOfflineShell(page: Page) {
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return;
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;

    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    });
  });
}

function makeSession() {
  return {
    id: sessionId,
    owner_device_id: deviceId,
    source_type: "PLANNED",
    source_routine_id: "routine-1",
    source_routine_day_id: "day-1",
    source_template_id: "template-1",
    source_routine_revision: 1,
    source_template_revision: 1,
    routine_name_snapshot: "Push A/B/C",
    day_label_snapshot: "A",
    template_name_snapshot: "Push A",
    status: "ACTIVE",
    started_at: "2026-08-09T10:00:00.000Z",
    completed_at: null,
    notes: "",
    version: 1,
    edited_at: null,
    workout_session_exercises: [{
      id: "session-exercise-1",
      source_template_exercise_id: "template-exercise-1",
      source_exercise_id: "exercise-bench",
      sequence_no: 1,
      exercise_name_snapshot: "Barbell Bench Press",
      equipment_code_snapshot: "barbell",
      notes: "",
      workout_session_exercise_muscles: [{ role: "PRIMARY", sequence_no: 1, muscle_name_snapshot: "Chest" }],
      workout_session_sets: [{
        id: "session-set-1",
        source_template_set_id: "template-set-1",
        sequence_no: 1,
        set_kind_code: "WORKING",
        is_to_failure: false,
        target_reps_min: 8,
        target_reps_max: 10,
        target_weight_value: 70,
        target_weight_unit: "KG",
        target_weight_kg: 70,
        target_effort_metric: "RPE",
        target_effort_value: 8,
        target_rest_seconds: 90,
        actual_weight_value: null,
        actual_weight_unit: null,
        actual_weight_kg: null,
        actual_reps: null,
        actual_effort_metric: null,
        actual_effort_value: null,
        actual_rest_seconds: null,
        status: "PENDING",
        completed_at: null,
        notes: "",
      }],
    }],
  };
}

test.describe("Active Workout set logging", () => {
  test.beforeEach(async ({ page }) => {
    const session = makeSession();
    await page.addInitScript(() => {
      window.localStorage.setItem("fitness-auth-token", JSON.stringify({
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "e2e-owner", email: "owner@example.test" },
      }));
      window.localStorage.setItem("fitness-workout-device-id", "11111111-1111-4111-8111-111111111111");
    });

    await page.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const resource = url.pathname.split("/").pop();
      if (resource === "devices") {
        await route.fulfill({ json: [{ id: deviceId, label: "E2E", last_seen_at: "2026-08-09T10:00:00.000Z" }] });
        return;
      }
      if (resource === "workout_sessions") {
        const activeQuery = url.searchParams.get("status") === "eq.ACTIVE";
        const byId = url.searchParams.get("id")?.replace("eq.", "");
        await route.fulfill({ json: activeQuery && session.status !== "ACTIVE" ? [] : byId && byId !== session.id ? [] : [session] });
        return;
      }
      if (resource === "workout_session_exercises") {
        if (url.searchParams.has("source_exercise_id")) {
          await route.fulfill({ json: [{
            source_exercise_id: "exercise-bench",
            workout_sessions: { started_at: "2026-08-02T10:00:00.000Z", status: "COMPLETED", deleted_at: null },
            workout_session_sets: [{
              actual_weight_value: 67.5,
              actual_weight_unit: "KG",
              actual_weight_kg: 67.5,
              actual_reps: 9,
              actual_effort_metric: "RPE",
              actual_effort_value: 8,
              completed_at: "2026-08-02T10:10:00.000Z",
              set_kind_code: "WORKING",
              status: "COMPLETED",
            }],
          }] });
        } else {
          await route.fulfill({ json: [] });
        }
        return;
      }
      if (resource === "exercises") {
        await route.fulfill({ json: [{ id: "exercise-bench", name: "Barbell Bench Press", normalized_name: "barbell bench press", equipment_code: "barbell", notes: "", owner_user_id: null, archived_at: null, version: 1, primary_muscle: { code: "chest" }, exercise_secondary_muscles: [] }] });
        return;
      }
      await route.fulfill({ json: [] });
    });

    await page.route("**/rest/v1/rpc/**", async (route) => {
      const rpc = new URL(route.request().url()).pathname.split("/").pop();
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (rpc === "workout_register_device") {
        await route.fulfill({ json: deviceId });
        return;
      }
      if (rpc === "workout_apply_command" || rpc === "workout_apply_command_idempotent") {
        const command = body.p_command as Record<string, unknown>;
        if (command.action === "finish_session" || command.action === "discard_session") {
          session.status = command.action === "finish_session" ? "COMPLETED" : "DISCARDED";
          session.completed_at = command.action === "finish_session" ? "2026-08-09T10:02:00.000Z" : null;
          session.version += 1;
          await route.fulfill({ json: session.version });
          return;
        }
        const sets = session.workout_session_exercises[0].workout_session_sets;
        const set = sets.find((item) => item.id === String(command.set_id));
        if (command.action === "complete_set" || command.action === "edit_set") {
          Object.assign(set, {
            actual_weight_value: command.actual_weight_value,
            actual_weight_unit: command.actual_weight_unit,
            actual_weight_kg: command.actual_weight_kg,
            actual_reps: command.actual_reps,
            actual_effort_metric: command.actual_effort_metric,
            actual_effort_value: command.actual_effort_value,
            status: "COMPLETED",
            completed_at: "2026-08-09T10:01:00.000Z",
          });
        } else if (command.action === "add_set") {
          const template = sets.at(-1);
          if (template) sets.push({ ...template, id: String(command.set_id), sequence_no: Number(command.sequence_no), actual_weight_value: null, actual_weight_unit: null, actual_weight_kg: null, actual_reps: null, actual_effort_metric: null, actual_effort_value: null, status: "PENDING", completed_at: null });
        } else if (command.action === "skip_set" && set) {
          set.status = "SKIPPED";
          set.completed_at = null;
        } else if (command.action === "delete_set") {
          const index = sets.findIndex((item) => item.id === String(command.set_id));
          if (index >= 0) sets.splice(index, 1);
          sets.forEach((item, indexValue) => { item.sequence_no = indexValue + 1; });
        }
        session.version += 1;
        await route.fulfill({ json: session.version });
        return;
      }
      if (rpc === "workout_finish_session") {
        session.status = "COMPLETED";
        session.completed_at = "2026-08-09T10:02:00.000Z";
        session.version += 1;
        await route.fulfill({ json: session.id });
        return;
      }
      await route.fulfill({ json: session.id });
    });

    await page.goto("/workout/active");
    await expect(page.getByTestId("active-workout")).toBeVisible();
  });

  test("completes a decimal-weight set, starts rest, defaults a new set, and survives refresh", async ({ page }) => {
    await page.locator('input[id="session-set-1-weight"]').fill("72.5");
    await page.getByLabel("Reps เซ็ต 1").fill("8");
    await page.getByLabel("Effort value เซ็ต 1").fill("8.5");
    await page.getByTestId("primary-set-action").click();

    await expect(page.getByTestId("set-row-session-set-1")).toContainText("เสร็จแล้ว");
    await expect(page.getByTestId("rest-timer")).toHaveText(/^01:[0-3][0-9]$/);

    await page.getByTestId("add-set").click();
    await expect(page.locator('input[aria-label="น้ำหนัก เซ็ต 2"]')).toHaveValue("72.5");
    await expect(page.getByLabel("Reps เซ็ต 2")).toHaveValue("8");
    await expect(page.getByLabel("Effort value เซ็ต 2")).toHaveValue("8.5");

    await page.getByTestId("set-row-session-set-1").locator('button[aria-controls="session-set-1-editor"]').click();
    await page.locator('input[id="session-set-1-weight"]').fill("73.5");
    await page.getByTestId("save-set-session-set-1").click();
    await expect(page.locator('input[id="session-set-1-weight"]')).toHaveValue("73.5");

    await page.reload();
    await expect(page.getByTestId("set-row-session-set-1")).toContainText("73.5 KG × 8");
    await expect(page.getByTestId("set-row-session-set-1")).toContainText("เสร็จแล้ว");
  });

  test("announces rest timer lifecycle transitions without announcing every second", async ({ page }) => {
    await page.getByTestId("primary-set-action").click();
    const timerRegion = page.getByRole("region", { name: "REST TIMER" });
    const announcement = timerRegion.getByRole("status");
    await expect(announcement).toHaveText("เริ่มจับเวลาพักแล้ว");
    await timerRegion.getByRole("button", { name: "พัก", exact: true }).click();
    await expect(announcement).toHaveText("หยุดเวลาพักชั่วคราวแล้ว");
    await timerRegion.getByRole("button", { name: "เริ่มต่อ", exact: true }).click();
    await expect(announcement).toHaveText("จับเวลาพักต่อแล้ว");
    await timerRegion.getByRole("button", { name: "เริ่มใหม่", exact: true }).click();
    await expect(announcement).toHaveText("เริ่มจับเวลาพักใหม่แล้ว");
    await timerRegion.getByRole("button", { name: "ข้าม", exact: true }).click();
    await expect(announcement).toHaveText("ข้ามเวลาพักแล้ว");
  });

  test("does not complete a row with missing required values", async ({ page }) => {
    await page.locator('input[id="session-set-1-weight"]').fill("");
    await page.getByTestId("primary-set-action").click();
    await expect(page.getByTestId("set-row-session-set-1")).toContainText("รอบันทึก");
    await expect(page.locator('input[id="session-set-1-weight"]')).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("ตรวจสอบค่าของเซ็ตนี้ก่อนบันทึก")).toBeVisible();

    await page.locator('input[id="session-set-1-weight"]').fill("70");
    await expect(page.getByText("ตรวจสอบค่าของเซ็ตนี้ก่อนบันทึก")).toBeHidden();
    await expect(page.getByTestId("rest-timer")).toHaveText("พร้อม");
  });

  test("shows previous performance and collapses completed sets", async ({ page }) => {
    await expect(page.getByText("67.5 KG × 9", { exact: true })).toBeVisible();

    await page.getByTestId("primary-set-action").click();
    const row = page.getByTestId("set-row-session-set-1");
    await expect(row.getByLabel("น้ำหนัก เซ็ต 1")).toBeHidden();
    await expect(row).toContainText("70 KG × 8");
  });

  test("saves Complete Set locally while offline and syncs after reconnect", async ({ page, context }) => {
    await page.route(idempotentRpcPattern, abortSync);
    await context.setOffline(true);
    await page.locator('input[id="session-set-1-weight"]').fill("72.5");
    await page.getByLabel("Reps เซ็ต 1").fill("8");
    await page.getByLabel("Effort value เซ็ต 1").fill("8.5");
    await page.getByTestId("primary-set-action").click();
    await expect(page.getByTestId("set-row-session-set-1")).toContainText("72.5 KG");
    await expect(page.getByTestId("sync-status")).toContainText("Offline");

    await page.unroute(idempotentRpcPattern, abortSync);
    await context.setOffline(false);
    await expect(page.getByTestId("sync-status")).toContainText("Synced", { timeout: 10_000 });
  });

  test("queues Add, Complete and Edit for one Set while offline", async ({ page, context }) => {
    await page.route(idempotentRpcPattern, abortSync);
    await context.setOffline(true);
    await page.getByTestId("add-set").click();
    await expect.poll(() => syncQueueCount(page)).toBe(1);
    const rows = page.locator('article[data-testid^="set-row-"]');
    await expect(rows).toHaveCount(2);
    const addedRow = rows.nth(1);
    await addedRow.locator('input[type="number"]').first().fill("80");
    await page.getByTestId("primary-set-action").click();
    await expect.poll(() => syncQueueCount(page)).toBe(2);
    await expect(addedRow).toContainText("80 KG");

    await addedRow.locator('button[aria-expanded]').click();
    await addedRow.locator('input[type="number"]').first().fill("82.5");
    await addedRow.locator('[data-testid^="save-set-"]').click();
    await expect.poll(() => syncQueueCount(page)).toBe(3);
    await expect(addedRow).toContainText("82.5 KG");
    await expect(page.getByTestId("sync-status")).toContainText("3 รายการรอซิงก์");

    await page.unroute(idempotentRpcPattern, abortSync);
    await context.setOffline(false);
    await expect(page.getByTestId("sync-status")).toContainText("Synced", { timeout: 10_000 });
  });

  test("queues Skip while offline and preserves it after sync and refresh", async ({ page, context }) => {
    await page.route(idempotentRpcPattern, abortSync);
    await context.setOffline(true);
    await page.getByTestId("skip-set-session-set-1").click();
    await expect(page.getByTestId("set-row-session-set-1")).toContainText("ข้ามแล้ว");
    await page.unroute(idempotentRpcPattern, abortSync);
    await context.setOffline(false);
    await expect(page.getByTestId("sync-status")).toContainText("Synced", { timeout: 10_000 });
    await page.reload();
    await expect(page.getByTestId("set-row-session-set-1")).toContainText("ข้ามแล้ว");
  });

  test("queues Delete while offline and keeps remaining Set sequence intact", async ({ page, context }) => {
    await page.getByTestId("primary-set-action").click();
    await expect(page.getByTestId("sync-status")).toContainText("Synced", { timeout: 10_000 });
    await page.getByTestId("add-set").click();
    await expect(page.locator('article[data-testid^="set-row-"]')).toHaveCount(2);
    await expect(page.getByTestId("sync-status")).toContainText("Synced", { timeout: 10_000 });

    await page.route(idempotentRpcPattern, abortSync);
    await context.setOffline(true);
    await page.getByTestId("set-row-session-set-1").locator('button[aria-expanded]').click();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByTestId("delete-set-session-set-1").click();
    const remainingRows = page.locator('article[data-testid^="set-row-"]');
    await expect(remainingRows).toHaveCount(1);
    await expect(remainingRows.first()).toContainText("01");
    await page.unroute(idempotentRpcPattern, abortSync);
    await context.setOffline(false);
    await expect(page.getByTestId("sync-status")).toContainText("Synced", { timeout: 10_000 });
  });

  test("finishes offline into a local Summary and syncs the lifecycle once", async ({ page, context }) => {
    await page.getByTestId("primary-set-action").click();
    await expect(page.getByTestId("sync-status")).toContainText("Synced", { timeout: 10_000 });
    await expect.poll(() => syncQueueCount(page)).toBe(0);
    await waitForOfflineShell(page);
    await page.route(idempotentRpcPattern, abortSync);
    await context.setOffline(true);
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Finish Workout" }).click();
    await expect(page).toHaveURL(/\/workout\/complete\//);
    await expect(page.getByText(/Offline · บันทึก Summary/)).toBeVisible();
    await expect.poll(() => syncQueueCount(page)).toBe(1);
    await page.unroute(idempotentRpcPattern, abortSync);
    await context.setOffline(false);
    await expect(page.getByText("Synced", { exact: true })).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => window.localStorage.getItem("fitness-workout-device-id"))).toBe(deviceId);
  });

  test("discards offline without offering a second Start before sync", async ({ page, context }) => {
    await waitForOfflineShell(page);
    await page.route(idempotentRpcPattern, abortSync);
    await context.setOffline(true);
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByTestId("today-terminal-pending")).toBeVisible();
    await expect(page.getByText(/ยังไม่สามารถเริ่มหรือ Resume/)).toBeVisible();
    await expect.poll(() => syncQueueCount(page)).toBe(1);
    await page.unroute(idempotentRpcPattern, abortSync);
    await context.setOffline(false);
    await expect.poll(() => syncQueueCount(page)).toBe(0, { timeout: 10_000 });
  });

  test("keeps the mobile layout within the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await expect(page.getByTestId("primary-set-action")).toBeVisible();
    await expect(page.getByTestId("save-set-session-set-1")).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole("button", { name: "เพิ่ม Exercise" }).click();
    const picker = page.getByRole("dialog", { name: "เพิ่มท่าออกกำลังกาย" });
    const pickerBox = await picker.boundingBox();
    expect(pickerBox).toMatchObject({ x: 0, y: 0, width: 320, height: 800 });
    await page.getByLabel("เปิดตัวกรอง Exercise").click();
    const mobileFilters = page.getByRole("dialog", { name: "ตัวกรอง Exercise" });
    await expect(mobileFilters).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(mobileFilters).toBeHidden();
    await expect(picker).toBeVisible();
    await page.getByLabel("ปิดตัวเลือกท่า").click();
  });

  test("keeps desktop set controls separated and within the workspace", async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 900 });

    const row = page.getByTestId("set-row-session-set-1");
    await expect(row).toBeVisible();
    await expect.poll(() => row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const controls = [
      page.locator('input[id="session-set-1-weight"]'),
      page.getByLabel("Reps เซ็ต 1"),
      page.getByLabel("Effort value เซ็ต 1"),
      page.getByTestId("save-set-session-set-1"),
    ];
    const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 1; second < boxes.length; second += 1) {
        const a = boxes[first];
        const b = boxes[second];
        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        const overlaps = a!.x < b!.x + b!.width
          && a!.x + a!.width > b!.x
          && a!.y < b!.y + b!.height
          && a!.y + a!.height > b!.y;
        expect(overlaps).toBe(false);
      }
    }

    const menuButton = page.getByLabel("เปิดเมนูจัดการ Exercise");
    await expect(menuButton).toHaveCSS("width", "44px");
    await expect(menuButton).toHaveCSS("height", "44px");
    await menuButton.click();
    await expect(page.getByRole("button", { name: "ลบ Exercise" })).toBeVisible();
    await expect(page.getByRole("button", { name: "เลื่อนขึ้น" })).toHaveCount(0);
  });

  test("keeps exercise filters inside the picker at tablet width", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 760 });
    await page.getByRole("button", { name: "เพิ่ม Exercise" }).click();
    await page.getByLabel("เปิดตัวกรอง Exercise").click();

    const picker = page.getByRole("dialog", { name: "เพิ่มท่าออกกำลังกาย" });
    const filters = page.getByRole("dialog", { name: "ตัวกรอง Exercise" });
    await expect(filters).toBeVisible();
    const pickerClose = page.getByLabel("ปิดตัวเลือกท่า");
    const filterClose = page.getByRole("button", { name: "ปิดตัวกรอง", exact: true });
    await expect(pickerClose).toHaveCSS("width", "48px");
    await expect(pickerClose).toHaveCSS("height", "48px");
    await expect(filterClose).toHaveCSS("width", "48px");
    await expect(filterClose).toHaveCSS("height", "48px");
    await expect(pickerClose.locator("svg")).toHaveCSS("width", "24px");
    await expect(filterClose.locator("svg")).toHaveCSS("width", "24px");

    const pickerBox = await picker.boundingBox();
    const filterBox = await filters.boundingBox();
    expect(pickerBox).not.toBeNull();
    expect(filterBox).not.toBeNull();
    expect(filterBox!.x).toBeGreaterThanOrEqual(pickerBox!.x);
    expect(filterBox!.x + filterBox!.width).toBeLessThanOrEqual(
      pickerBox!.x + pickerBox!.width + 1,
    );

    await page.getByRole("button", { name: "ทุกกลุ่มกล้ามเนื้อ", exact: true }).click();
    const muscleOptions = page.getByRole("listbox", { name: "หมวดหมู่กล้ามเนื้อ" });
    await expect(muscleOptions).toBeVisible();
    await expect(filters).toHaveCSS("overflow-y", "visible");

    const muscleOptionsBox = await muscleOptions.boundingBox();
    expect(muscleOptionsBox).not.toBeNull();
    expect(muscleOptionsBox!.x).toBeGreaterThanOrEqual(pickerBox!.x);
    expect(muscleOptionsBox!.x + muscleOptionsBox!.width).toBeLessThanOrEqual(
      pickerBox!.x + pickerBox!.width + 1,
    );
    await page.keyboard.press("Escape");
    await expect(muscleOptions).toBeHidden();
    await expect(filters).toBeVisible();
    await expect(picker).toBeVisible();
  });
});
