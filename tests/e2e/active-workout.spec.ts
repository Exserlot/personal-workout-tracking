import { expect, test } from "@playwright/test";

test.describe("Active Workout set logging", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("fitness-auth-token", JSON.stringify({
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "e2e-owner", email: "owner@example.test" },
      }));
    });
    await page.goto("/workout/active");
    await expect(page.getByTestId("active-workout")).toBeVisible();
  });

  test("completes a decimal-weight set, starts rest, defaults the next set, and survives refresh", async ({ page }) => {
    await page.getByLabel("น้ำหนัก เซ็ต 1").fill("72.5");
    await page.getByLabel("Reps เซ็ต 1").fill("8");
    await page.getByLabel("RPE เซ็ต 1").fill("8.5");
    await page.getByTestId("primary-set-action").click();

    await expect(page.getByTestId("set-row-set-1")).toContainText("เสร็จแล้ว");
    await expect(page.getByTestId("rest-timer")).toHaveText("01:30");

    await page.getByRole("button", { name: "เพิ่ม Set", exact: true }).click();
    await expect(page.getByLabel("น้ำหนัก เซ็ต 2")).toHaveValue("72.5");
    await expect(page.getByLabel("Reps เซ็ต 2")).toHaveValue("8");
    await expect(page.getByLabel("RPE เซ็ต 2")).toHaveValue("8.5");

    await page.getByLabel("น้ำหนัก เซ็ต 1").fill("73.5");
    await page.getByRole("button", { name: "บันทึกเซ็ต 1", exact: true }).click();
    await expect(page.getByLabel("น้ำหนัก เซ็ต 1")).toHaveValue("73.5");

    await page.reload();
    await expect(page.getByLabel("น้ำหนัก เซ็ต 1")).toHaveValue("73.5");
    await expect(page.getByTestId("set-row-set-1")).toContainText("เสร็จแล้ว");
    await expect(page.getByTestId("rest-timer")).toBeVisible();
  });

  test("does not complete a row with missing required values", async ({ page }) => {
    await page.getByLabel("น้ำหนัก เซ็ต 1").fill("");
    await page.getByTestId("primary-set-action").click();

    await expect(page.getByTestId("set-row-set-1")).toContainText("ยังไม่บันทึก");
    await expect(page.getByText("กรอกน้ำหนักก่อน Complete Set")).toBeVisible();
    await expect(page.getByTestId("rest-timer")).toHaveText("พร้อม");
  });
});
