import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../..");
const liveProfilePath = path.resolve(__dirname, "../../.profiles/reddit-live");
const homepageUrl = "https://www.reddit.com/";
const subredditUrl = "https://www.reddit.com/r/BondageBlowjobs/";

async function launchLiveContext() {
  const context = await chromium.launchPersistentContext(liveProfilePath, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  return { context };
}

async function openLiveReddit(url) {
  const { context } = await launchLiveContext();
  const page = await context.newPage();
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 45000
  });

  return { context, page };
}

async function expectLoggedInOrExplain(page) {
  const title = await page.title();
  const humanityChallenge = /prove your humanity/i.test(title) || await page.getByText(/prove your humanity/i).first().isVisible({ timeout: 1000 }).catch(() => false);

  expect(
    humanityChallenge,
    [
      "Reddit is showing a humanity challenge in the dedicated live browser profile.",
      `Profile path: ${liveProfilePath}`,
      "Run `npm run test:live`, complete the challenge in the opened browser, close it, then run the command again."
    ].join("\n")
  ).toBeFalsy();

  const loginSignals = page.locator('a[href*="/login"], shreddit-async-loader[name*="Auth"], text=/log in|sign up/i');
  const profileSignals = page.locator('shreddit-user-drawer, [aria-label*="profile" i], [aria-label*="user" i]');

  const maybeLoggedIn = await profileSignals.first().isVisible({ timeout: 5000 }).catch(() => false);
  const maybeLoggedOut = await loginSignals.first().isVisible({ timeout: 1000 }).catch(() => false);

  expect(
    maybeLoggedIn || !maybeLoggedOut,
    [
      "The dedicated live Reddit browser profile does not appear to be logged in.",
      `Profile path: ${liveProfilePath}`,
      "Run `npm run test:live`, log into Reddit in the opened browser window, close it, then run the command again."
    ].join("\n")
  ).toBeTruthy();
}

async function prefilterCss(page) {
  return page.locator("#reddit-content-filter-prefilter").evaluate((style) => style.textContent).catch(() => "");
}

async function expectContentScriptLoaded(page) {
  await expect
    .poll(() => page.locator("#reddit-content-filter-prefilter").count(), {
      message: "The extension content script did not inject its prefilter style into this Reddit page."
    })
    .toBe(1);
}

test.describe("Live Reddit smoke tests", () => {
  test("homepage hides the homepage content wrapper", async () => {
    const { context, page } = await openLiveReddit(homepageUrl);

    try {
      await expectLoggedInOrExplain(page);
      await expectContentScriptLoaded(page);
      await expect.poll(() => prefilterCss(page)).toContain(".main-container:has(#main-content, #right-sidebar-container)");

      const homepageContainer = page.locator(".main-container:has(#main-content, #right-sidebar-container)").first();
      await expect(homepageContainer).toBeHidden({ timeout: 15000 });
    } finally {
      await context.close();
    }
  });

  test("subreddit pages keep main content visible", async () => {
    const { context, page } = await openLiveReddit(subredditUrl);

    try {
      await expectLoggedInOrExplain(page);
      await expectContentScriptLoaded(page);
      await expect.poll(() => prefilterCss(page)).not.toContain(".main-container:has(#main-content, #right-sidebar-container)");

      const mainContent = page.locator("#main-content, main").first();
      await expect(mainContent).toBeVisible({ timeout: 15000 });
    } finally {
      await context.close();
    }
  });
});
