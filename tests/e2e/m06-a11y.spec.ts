import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const representativeRoutes = [
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

async function assertNoAxeViolations(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main#main-content")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, `${path} accessibility violations`).toEqual([]);
}

test("representative MVP pages meet the automated WCAG A/AA baseline", async ({ page }) => {
  await assertNoAxeViolations(page, "/login");
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

  for (const path of representativeRoutes) await assertNoAxeViolations(page, path);
});
