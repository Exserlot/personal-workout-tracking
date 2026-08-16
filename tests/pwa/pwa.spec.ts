import { expect, test } from "@playwright/test";

test("manifest and service worker make the application shell available offline", async ({ page, context }) => {
  await page.goto("/login");
  const manifestHref = await page.evaluate(() => document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ?? null);
  expect(manifestHref).toBeTruthy();
  const manifest = await page.evaluate(async (href) => (await fetch(href!)).json(), manifestHref);
  expect(manifest).toMatchObject({ short_name: "FORM", display: "standalone", start_url: "/today" });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192" }),
    expect.objectContaining({ sizes: "512x512" }),
    expect.objectContaining({ purpose: "maskable" }),
  ]));

  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const cachedUrls = await page.evaluate(async () => {
    const keys = await caches.keys();
    const requests = await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()));
    return requests.flat().map((request) => request.url);
  });
  expect(cachedUrls.some((value) => {
    const url = new URL(value);
    return /supabase|sentry/.test(url.hostname) || /\/auth\/v1|\/rest\/v1/.test(url.pathname);
  })).toBe(false);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
});
