import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "API unavailable in smoke test" }),
    });
  });
});

test("login screen renders auth controls", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByTestId("input-auth-email")).toBeVisible();
  await expect(page.getByTestId("input-auth-password")).toBeVisible();
  await expect(page.getByTestId("button-auth-submit")).toBeVisible();
});

test("home screen renders core cards and navigates to concierge", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("card-home-agent-health")).toBeVisible();
  await expect(page.getByTestId("card-home-agent-concierge")).toBeVisible();
  await expect(page.getByTestId("carousel-today-for-you")).toBeVisible();

  await page.getByTestId("card-home-agent-concierge").click();
  await expect(page).toHaveURL(/\/concierge$/);
});
