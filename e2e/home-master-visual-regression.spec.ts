import { expect, test, type Page, type Route } from "@playwright/test";

const HOME_MODE_STORAGE_KEY = "vyva:home-interaction-mode:v1";
const HOME_THEME_STORAGE_KEY = "vyva:home-master-theme:v1";
const VOICE_ORB_HINT_SEEN_STORAGE_KEY = "vyva:voice-orb-hint-seen:v1";
const FIXED_HOME_NOW_MS = new Date("2026-07-07T20:00:00+02:00").getTime();
const FUTURE_AUTH_TOKEN = [
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0",
  btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 })),
  "signature",
].join(".");

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installHomeMasterMocks(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/api/auth/me") {
      await fulfillJson(route, 200, {
        id: "home-master-visual-user",
        email: "karim@example.com",
        language: "es",
        activeProfileId: "home-master-preview",
        role: "user",
      });
      return;
    }

    if (url.pathname === "/api/profile") {
      await fulfillJson(route, 200, {
        firstName: "Karim",
        lastName: "",
        email: "",
        phone: "",
        country: "ES",
        timezone: "Europe/Madrid",
        language: "es",
        languagePreference: "es",
        profileId: "home-master-preview",
      });
      return;
    }

    if (url.pathname === "/api/meds/adherence-report") {
      await fulfillJson(route, 200, {
        todaySummary: { scheduled: 1, remaining: 1 },
        nextDose: { name: "Monoprost", minutesUntil: 25 },
      });
      return;
    }

    if (url.pathname === "/api/home/fast-help/sync") {
      await fulfillJson(route, 200, { ok: true, journeys: [] });
      return;
    }

    await fulfillJson(route, 200, {});
  });
}

async function prepareHomeMasterPreview(page: Page) {
  await installHomeMasterMocks(page);
  await page.addInitScript(({ authToken, homeModeKey, themeKey, hintKey, fixedNowMs }) => {
    Date.now = () => fixedNowMs;
    window.localStorage.setItem("vyva_auth_token", authToken);
    window.localStorage.setItem(homeModeKey, "voice");
    window.localStorage.setItem(themeKey, "light");
    window.localStorage.setItem(hintKey, "true");
    window.localStorage.setItem("vyva_lang", "es");
    window.localStorage.setItem("vyva_lang_source", "user");
  }, {
    authToken: FUTURE_AUTH_TOKEN,
    homeModeKey: HOME_MODE_STORAGE_KEY,
    themeKey: HOME_THEME_STORAGE_KEY,
    hintKey: VOICE_ORB_HINT_SEEN_STORAGE_KEY,
    fixedNowMs: FIXED_HOME_NOW_MS,
  });
}

async function openHomeMasterVoiceMode(page: Page) {
  await prepareHomeMasterPreview(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts?.ready);
  await page.locator("#vyva-launch").waitFor({ state: "detached", timeout: 5_000 });
  await expect(page.getByTestId("home-master-layout")).toBeVisible();
  await expect(page.getByTestId("home-master-hero")).toBeVisible();
  await expect(page.getByTestId("home-dormant-zamora-orb-visual")).toBeVisible();
}

test.describe("home master visual contract", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.use({
    viewport: { width: 400, height: 844 },
    colorScheme: "light",
    reducedMotion: "reduce",
    timezoneId: "Europe/Madrid",
  });

  test("keeps voice mode focused on greeting, orb, and compact controls", async ({ page }) => {
    await openHomeMasterVoiceMode(page);

    await expect(page.getByTestId("home-topbar-action-pill")).toBeVisible();
    await expect(page.getByTestId("button-home-mode-touch")).toBeVisible();
    await expect(page.getByTestId("button-home-profile")).toBeVisible();
    await expect(page.getByTestId("home-dormant-zamora-orb-visual")).toHaveAttribute("data-orb-state", "idle");
    await expect(page.getByTestId("home-pillar-cards")).toHaveCount(0);
    await expect(page.getByTestId("home-fast-help")).toHaveCount(0);

    await expect(page).toHaveScreenshot("home-master-voice-mode-mobile.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });
  });

  test("keeps top-level Home orb-first after touch mode and routes tiles through Menu", async ({ page }) => {
    await openHomeMasterVoiceMode(page);

    await page.getByTestId("button-home-mode-touch").click();
    await expect(page).toHaveURL(/\/menu$/);

    await expect(page.getByTestId("menu-tile-grid").getByRole("button")).toHaveCount(4);

    const columns = await page.getByTestId("menu-tile-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    const lastTileBox = await page.getByTestId("menu-tile-concierge").boundingBox();
    const dockBox = await page.getByRole("navigation").boundingBox();
    expect(columns).toBe(1);
    expect(lastTileBox).not.toBeNull();
    expect(dockBox).not.toBeNull();
    expect(lastTileBox!.y + lastTileBox!.height).toBeLessThan(dockBox!.y - 12);
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("keeps the mobile Profile menu inside the production shell", async ({ page }) => {
    await openHomeMasterVoiceMode(page);
    await page.getByTestId("button-home-profile").click();

    const dialogBox = await page.getByTestId("home-profile-menu").boundingBox();
    const columns = await page.getByTestId("home-profile-menu-links").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(16);
    expect(dialogBox!.y).toBeGreaterThanOrEqual(80);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(384);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(828);
    expect(columns).toBe(1);
  });

  test("uses a two-column tablet Menu with clear dock separation", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 900 });
    await openHomeMasterVoiceMode(page);
    await page.getByTestId("button-home-mode-touch").click();
    await expect(page).toHaveURL(/\/menu$/);

    const columns = await page.getByTestId("menu-tile-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    const gridBox = await page.getByTestId("menu-tile-grid").boundingBox();
    const dockBox = await page.getByRole("navigation").boundingBox();
    expect(columns).toBe(2);
    expect(gridBox).not.toBeNull();
    expect(dockBox).not.toBeNull();
    expect(gridBox!.y + gridBox!.height).toBeLessThan(dockBox!.y - 24);
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("keeps the Health hub usable across mobile and desktop shells", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareHomeMasterPreview(page);
    await page.goto("/health", { waitUntil: "domcontentloaded" });
    await page.locator("#vyva-launch").waitFor({ state: "detached", timeout: 5_000 });

    await expect(page.getByTestId("prototype-health-screen")).toBeVisible();
    await expect(page.getByTestId("prototype-home-master-topbar")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mi salud", exact: true })).toBeVisible();
    await expect(page.getByTestId("button-health-plan")).toBeVisible();
    await expect(page.getByTestId("button-health-symptom-report")).toBeVisible();
    await expect(page.getByTestId("button-health-vitals")).toBeVisible();
    await expect(page.getByTestId("button-health-medicines")).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
    const mobileSubtitleOverflows = await page.getByTestId("prototype-health-screen").locator("span.truncate").evaluateAll((elements) =>
      elements
        .filter((element) => element.scrollWidth > element.clientWidth)
        .map((element) => ({ text: element.textContent, className: element.className, parentClassName: element.parentElement?.className, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })),
    );
    expect(mobileSubtitleOverflows).toEqual([]);
    await page.setViewportSize({ width: 1290, height: 663 });
    await expect(page.getByTestId("prototype-health-screen")).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("keeps the Prevention page usable across mobile and desktop shells", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareHomeMasterPreview(page);
    await page.goto("/health/prevention", { waitUntil: "domcontentloaded" });
    await page.locator("#vyva-launch").waitFor({ state: "detached", timeout: 5_000 });

    await expect(page.getByTestId("prevention-page")).toBeVisible();
    await expect(page.getByTestId("prevention-hero")).toBeVisible();
    await expect(page.getByTestId("prevention-guidance-panel")).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(mobileOverflow).toBe(false);

    await page.setViewportSize({ width: 1290, height: 663 });
    await expect(page.getByTestId("prevention-page")).toBeVisible();
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(desktopOverflow).toBe(false);
  });

  test("balances the Home voice surface inside the desktop shell", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHomeMasterVoiceMode(page);
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId("home-master-layout")).toBeVisible();

    const layoutBox = await page.getByTestId("home-master-layout").boundingBox();
    const topbarBox = await page.getByTestId("home-topbar").boundingBox();
    const headingBox = await page.getByTestId("home-master-hero").getByRole("heading").boundingBox();
    const orbBox = await page.getByTestId("button-home-hero-talk").boundingBox();
    const dockBox = await page.getByRole("navigation").boundingBox();

    expect(layoutBox).not.toBeNull();
    expect(topbarBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(orbBox).not.toBeNull();
    expect(dockBox).not.toBeNull();

    expect(layoutBox!.width).toBeGreaterThanOrEqual(600);
    expect(layoutBox!.width).toBeLessThanOrEqual(720);
    expect(dockBox!.width).toBeGreaterThanOrEqual(540);
    expect(dockBox!.width).toBeLessThanOrEqual(620);

    const availableCenter = (topbarBox!.y + topbarBox!.height + dockBox!.y) / 2;
    const heroContentCenter = (headingBox!.y + orbBox!.y + orbBox!.height) / 2;
    expect(Math.abs(heroContentCenter - availableCenter)).toBeLessThan(100);
    expect(orbBox!.y + orbBox!.height).toBeLessThan(dockBox!.y - 24);

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBe(false);

  });

  test("uses a centered desktop profile dialog without exposing the Home hero", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHomeMasterVoiceMode(page);
    await page.getByTestId("button-home-profile").click();

    const dialog = page.getByTestId("home-profile-menu");
    const dialogBox = await dialog.boundingBox();
    const columns = await page.getByTestId("home-profile-menu-links").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );

    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.width).toBeGreaterThanOrEqual(680);
    expect(dialogBox!.width).toBeLessThanOrEqual(720);
    expect(Math.abs(dialogBox!.x + dialogBox!.width / 2 - 720)).toBeLessThan(2);
    expect(Math.abs(dialogBox!.y + dialogBox!.height / 2 - 450)).toBeLessThan(2);
    expect(columns).toBe(2);
    await expect(page.getByTestId("button-home-profile-menu-backdrop")).toBeVisible();
  });

  test("uses a balanced desktop Menu dashboard and keeps the shared dock visible", async ({ page }) => {
    await page.setViewportSize({ width: 1290, height: 663 });
    await openHomeMasterVoiceMode(page);
    await page.getByTestId("button-home-mode-touch").click();
    await expect(page).toHaveURL(/\/menu$/);

    const menuShellBox = await page.getByTestId("menu-shell").boundingBox();
    const columns = await page.getByTestId("menu-tile-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    const dock = page.getByRole("navigation");

    expect(menuShellBox).not.toBeNull();
    expect(menuShellBox!.width).toBeGreaterThanOrEqual(840);
    expect(menuShellBox!.width).toBeLessThanOrEqual(880);
    expect(columns).toBe(4);
    await expect(dock).toBeVisible();

    const gridBox = await page.getByTestId("menu-tile-grid").boundingBox();
    const topbarBox = await page.getByTestId("menu-topbar").boundingBox();
    const dockBox = await dock.boundingBox();
    expect(gridBox).not.toBeNull();
    expect(topbarBox).not.toBeNull();
    expect(dockBox).not.toBeNull();
    const availableCenter = (topbarBox!.y + topbarBox!.height + dockBox!.y) / 2;
    const gridCenter = gridBox!.y + gridBox!.height / 2;
    expect(Math.abs(gridCenter - availableCenter)).toBeLessThan(70);
    expect(gridBox!.y + gridBox!.height).toBeLessThan(dockBox!.y - 24);

    const titleTops = await page.locator('[data-testid$="-title"]').evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().top),
    );
    expect(Math.max(...titleTops) - Math.min(...titleTops)).toBeLessThan(2);
    const detailsAreScreenReaderOnly = await page.locator('[data-testid$="-detail"]').evaluateAll((elements) =>
      elements.every((element) => {
        const style = getComputedStyle(element);
        return element.classList.contains("sr-only") && style.position === "absolute" &&
          style.overflow === "hidden" && element.getBoundingClientRect().width <= 1;
      }),
    );
    expect(detailsAreScreenReaderOnly).toBe(true);

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });
});
