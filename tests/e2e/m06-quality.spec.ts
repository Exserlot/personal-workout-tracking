import { expect, test, type Page } from "@playwright/test";

const widths = [320, 360, 600, 768, 1024, 1280, 1600];
const authenticatedRoutes = [
  "/today",
  "/exercises",
  "/exercises/new",
  "/plans",
  "/plans/templates/new",
  "/workout/active",
  "/workout/complete",
  "/history",
  "/history/missing-session",
  "/progress",
  "/progress/missing-exercise",
  "/settings",
];

async function authenticate(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("fitness-auth-token", JSON.stringify({
      access_token: "m06-access-token",
      refresh_token: "m06-refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "m06-owner", email: "owner@example.test" },
    }));
  });
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/rpc/**", (route) => route.fulfill({ json: null }));
}

test.describe("M-06 responsive quality gate", () => {
  for (const width of widths) {
    test(`P-01 login has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/login");
      await expect(page.locator("main#main-content")).toBeVisible();
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator(".skip-link")).toHaveAttribute("href", "#main-content");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

    test(`P-02–P-13 have no horizontal overflow at ${width}px`, async ({ page }) => {
      test.setTimeout(90_000);
      await authenticate(page);
      await page.setViewportSize({ width, height: 900 });
      for (const path of authenticatedRoutes) {
        await page.goto(path);
        await expect(page.locator("main#main-content")).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
          `${path} overflows at ${width}px`,
        ).toBe(true);
      }
    });
  }

  test("supports keyboard route focus and drawer semantics", async ({ page }) => {
    await authenticate(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/today");
    await page.locator(".skip-link").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();
    const menu = page.getByRole("button", { name: "เปิดเมนู" });
    await menu.focus();
    await menu.press("Enter");
    const drawer = page.getByRole("dialog", { name: "เมนูทั้งหมด" });
    await expect(drawer).toBeVisible();
    const closeMenu = drawer.getByRole("button", { name: "ปิดเมนู" });
    await expect(closeMenu).toHaveCSS("width", "48px");
    await expect(closeMenu).toHaveCSS("height", "48px");
    await expect(closeMenu.locator("svg")).toHaveCSS("width", "24px");
    await expect(closeMenu.locator("svg")).toHaveCSS("height", "24px");
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox).toMatchObject({ x: 0, y: 0, height: 800 });
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
  });

  test("mobile filter sheet traps focus, locks scrolling and restores its trigger", async ({ page }) => {
    await authenticate(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/exercises");
    const trigger = page.getByRole("button", { name: "เปิดตัวกรอง Exercise" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "ตัวกรอง Exercise" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("an async page-title update does not steal focus", async ({ page }) => {
    await authenticate(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    let releaseResponse: (() => void) | undefined;
    const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
    await page.route("**/rest/v1/workout_sessions?*", async (route) => {
      await responseGate;
      await route.fulfill({ json: [] });
    });
    await page.goto("/history/missing-session");
    await expect(page.getByRole("heading", { name: "กำลังโหลด History…" })).toBeVisible();
    const historyNavigation = page.getByRole("link", { name: "ประวัติ" }).first();
    await historyNavigation.focus();
    releaseResponse?.();
    await expect(page.getByRole("heading", { name: "ไม่พบ Session" })).toBeVisible();
    await expect(historyNavigation).toBeFocused();
  });
});
