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

test.describe("Reddit content filter extension", () => {
  test("hides homepage feed and right recent posts on the Reddit homepage", async ({}, testInfo) => {
    const { context, page } = await openRedditFixture(testInfo);

    try {
      await expect(page.getByTestId("home-feed")).toBeHidden();
      await expect(page.getByTestId("right-recent-posts")).toBeHidden();
      await expect(page.getByTestId("home-nav-section")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("keeps feed and right recent posts visible away from the homepage", async ({}, testInfo) => {
    const { context, page } = await openRedditFixture(testInfo, "https://www.reddit.com/r/all/");

    try {
      await expect(page.getByTestId("home-feed")).toBeVisible();
      await expect(page.getByTestId("right-recent-posts")).toBeVisible();
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
});
