import { expect, test, type Page } from "@playwright/test";

const futureToken = [
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0",
  btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 })),
  "signature",
].join(".");

async function mockSignedInOnboarding(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem("vyva_auth_token", token);
  }, futureToken);

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-responsive",
        email: "responsive@example.com",
        phone: null,
        language: "en",
        activeProfileId: "profile-responsive",
        role: "user",
      }),
    });
  });

  await page.route("**/api/onboarding/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          conditions: [],
          mobility_level: null,
          living_situation: null,
        },
        onboardingState: {
          current_stage: "stage_4_profile",
        },
      }),
    });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("onboarding responsive layout", () => {
  test("health conditions step avoids cramped two-column cards on narrow phones", async ({ page }) => {
    await mockSignedInOnboarding(page);

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/onboarding/profile/health");
    await expect(page.getByTestId("phone-frame")).toBeVisible();
    await page.getByTestId("accordion-heart").click();

    const conditionGrid = page.locator('[data-testid="card-condition-hypertension"]').locator("..");
    await expect(conditionGrid).toHaveCSS("grid-template-columns", /[0-9.]+px$/);
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(conditionGrid).toHaveCSS("grid-template-columns", /[0-9.]+px [0-9.]+px/);
    await expectNoHorizontalOverflow(page);
  });

  test("selected badges do not force accordion headers wider than the viewport", async ({ page }) => {
    await mockSignedInOnboarding(page);

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/onboarding/profile/health");
    await page.getByTestId("accordion-heart").click();
    await page.getByTestId("card-condition-hypertension").click();

    await expect(page.getByTestId("badge-count-heart")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
