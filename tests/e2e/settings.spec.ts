import { expect, test } from "@playwright/test";

test.describe("Settings and sync status", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("fitness-auth-token", JSON.stringify({
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "e2e-owner", email: "owner@example.test" },
      }));
    });
  });

  test("shows sync status, queue controls and read-only preferences", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByText("สถานะการซิงก์")).toBeVisible();
    await expect(page.getByText("Synced", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "ซิงก์อีกครั้ง" })).toBeVisible();
    await expect(page.getByText("หน่วยและตัวจับเวลา")).toBeVisible();
    await expect(page.locator('input[value="Kilograms (kg)"]')).toBeVisible();
  });
});
