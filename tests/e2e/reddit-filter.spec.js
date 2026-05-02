import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../..");
const fixturePath = path.resolve(__dirname, "../fixtures/reddit-feed.html");

async function openRedditFixture(testInfo, url = "https://www.reddit.com/") {
  const userDataDir = testInfo.outputPath("user-data");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = await context.newPage();
  await page.route("https://www.reddit.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: await readFile(fixturePath, "utf8")
    });
  });

  await page.goto(url);

  return { context, page };
}

async function getExtensionId(context) {
  let [serviceWorker] = context.serviceWorkers();

  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker");
  }

  return new URL(serviceWorker.url()).host;
}

async function setOption(page, id, checked) {
  const control = page.locator(`#${id}`);
  if ((await control.isChecked()) !== checked) {
    await control.click();
    if (checked) {
      await expect(control).toBeChecked();
    } else {
      await expect(control).not.toBeChecked();
    }

    await page.waitForFunction(
      async ([settingsKey, settingId, expected]) => {
        const result = await chrome.storage.sync.get(settingsKey);
        return result[settingsKey]?.[settingId] === expected;
      },
      ["redditContentFilterSettings", id, checked]
    );
  }
}

test.describe("Reddit content filter extension", () => {
  test("hides the homepage content wrapper on the Reddit homepage", async ({}, testInfo) => {
    const { context, page } = await openRedditFixture(testInfo);

    try {
      await expect.poll(async () => {
        return page.locator("#reddit-content-filter-prefilter").evaluate((style) => style.textContent);
      }).toContain(".main-container:has(#main-content, #right-sidebar-container)");
      await expect(page.getByTestId("homepage-content")).toBeHidden();
      await expect(page.getByTestId("home-nav-section")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("keeps feed and right recent posts visible away from the homepage", async ({}, testInfo) => {
    const { context, page } = await openRedditFixture(testInfo, "https://www.reddit.com/r/all/");

    try {
      await expect(page.getByTestId("homepage-content")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("always hides left navigation games and recent sections", async ({}, testInfo) => {
    const { context, page } = await openRedditFixture(testInfo, "https://www.reddit.com/r/all/");

    try {
      await expect(page.getByTestId("games-on-reddit-section")).toBeHidden();
      await expect(page.getByTestId("left-recent-section")).toBeHidden();
      await expect(page.getByTestId("home-nav-section")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("master disable restores all filtered page sections", async ({}, testInfo) => {
    const { context, page } = await openRedditFixture(testInfo);

    try {
      const extensionId = await getExtensionId(context);
      const optionsPage = await context.newPage();
      await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);

      await expect(page.getByTestId("homepage-content")).toBeHidden();
      await expect(page.getByTestId("games-on-reddit-section")).toBeHidden();
      await expect(page.getByTestId("left-recent-section")).toBeHidden();

      await setOption(optionsPage, "enabled", false);

      await expect(page.getByTestId("homepage-content")).toBeVisible();
      await expect(page.getByTestId("games-on-reddit-section")).toBeVisible();
      await expect(page.getByTestId("left-recent-section")).toBeVisible();
      await expect(optionsPage.locator("#hideGamesOnReddit")).toBeDisabled();
    } finally {
      await context.close();
    }
  });

  test("individual settings restore their matching sections", async ({}, testInfo) => {
    const { context, page } = await openRedditFixture(testInfo);

    try {
      const extensionId = await getExtensionId(context);
      const optionsPage = await context.newPage();
      await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);
      await setOption(optionsPage, "hideGamesOnReddit", false);
      await setOption(optionsPage, "hideHomepageContent", false);

      await expect(page.getByTestId("games-on-reddit-section")).toBeVisible();
      await expect(page.getByTestId("left-recent-section")).toBeHidden();
      await expect(page.getByTestId("homepage-content")).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
