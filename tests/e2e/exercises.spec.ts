import { expect, test, type Page } from "@playwright/test";

const starterExercise = {
  id: "starter-bench",
  name: "Barbell Bench Press",
  normalized_name: "barbell bench press",
  equipment_code: "barbell",
  notes: "",
  owner_user_id: null,
  archived_at: null,
  version: 1,
  primary_muscle: { code: "chest" },
  exercise_secondary_muscles: [],
};

const secondExercise = {
  id: "starter-squat",
  name: "Back Squat",
  normalized_name: "back squat",
  equipment_code: "barbell",
  notes: "",
  owner_user_id: null,
  archived_at: null,
  version: 1,
  primary_muscle: { code: "quadriceps" },
  exercise_secondary_muscles: [],
};

const customExercise = {
  ...starterExercise,
  id: "custom-press",
  name: "Custom Press",
  normalized_name: "custom press",
  owner_user_id: "e2e-owner",
  notes: "Keep the ribs down.",
};

async function setupAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("fitness-auth-token", JSON.stringify({
      access_token: "e2e-access-token",
      refresh_token: "e2e-refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "e2e-owner", email: "owner@example.test" },
    }));
  });
}

async function mockExercises(page: Page) {
  await page.route("**/rest/v1/exercises**", async (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get("id")?.replace("eq.", "");
    if (id) {
      await route.fulfill({ json: id === customExercise.id ? [customExercise] : [starterExercise] });
      return;
    }
    await route.fulfill({ json: [starterExercise, secondExercise, customExercise] });
  });
}

test.describe("Exercise Library and Editor", () => {
  test("keeps search and filter compact on mobile and restores focus after Escape", async ({ page }) => {
    await setupAuth(page);
    await mockExercises(page);
    await page.goto("/exercises");

    const search = page.locator('input[type="search"]').first();
    const filterTrigger = page.locator('button[aria-haspopup="dialog"]').first();
    const mobileResults = page.locator("#exercise-results > ul").first();
    await expect(search).toBeVisible();
    await expect(filterTrigger).toBeVisible();
    await expect(mobileResults.getByText("Barbell Bench Press", { exact: true })).toBeVisible();

    await search.fill("bench");
    await expect(mobileResults.getByText("Barbell Bench Press", { exact: true })).toBeVisible();
    await expect(mobileResults.getByText("Back Squat", { exact: true })).toBeHidden();

    await filterTrigger.click();
    const dialog = page.getByRole("dialog", { name: /Exercise/ });
    await expect(dialog).toBeVisible();
    await dialog.locator('button[aria-haspopup="listbox"]').first().click();
    await dialog.getByRole("option", { name: "Chest", exact: true }).click();
    await expect(filterTrigger).toContainText("1");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(filterTrigger).toBeFocused();
    const widths = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  });

  test("guards dirty editor cancellation without losing the draft", async ({ page }) => {
    await setupAuth(page);
    await mockExercises(page);
    await page.goto("/exercises/custom-press");

    const nameInput = page.locator('input:not([type="search"])').first();
    await expect(nameInput).toHaveValue("Custom Press");
    await nameInput.fill("Unsaved Press");

    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.dismiss();
    });
    await page.locator("form button[type=button]").click();
    await expect(nameInput).toHaveValue("Unsaved Press");
  });
});
