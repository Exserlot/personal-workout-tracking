import { expect, test, type Page } from "@playwright/test";

async function mockApi(page: Page) {
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/rpc/**", (route) => route.fulfill({ json: null }));
}

async function setAuthenticated(page: Page) {
  await page.evaluate(() => {
    window.localStorage.setItem("fitness-auth-token", JSON.stringify({
      access_token: "m06-access-token",
      refresh_token: "m06-refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "m06-owner", email: "owner@example.test" },
    }));
  });
}

test("core routes render and keyboard navigation works on mobile and desktop", async ({ page }) => {
  test.setTimeout(90_000);
  await mockApi(page);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await page.evaluate(() => window.localStorage.removeItem("fitness-auth-token"));
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
    await setAuthenticated(page);
    for (const path of ["/today", "/plans", "/workout/active", "/history", "/progress", "/settings"]) {
      await page.goto(path);
      await expect(page.locator("main#main-content")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    await page.goto("/today");
    if (width < 768) {
      const menu = page.getByRole("button", { name: "เปิดเมนู" });
      await menu.click();
      await expect(page.getByRole("dialog", { name: "เมนูทั้งหมด" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
    } else {
      await page.locator(".skip-link").focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("main#main-content")).toBeFocused();
    }
  }
});
