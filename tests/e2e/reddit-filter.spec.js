import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../src");
const fixturePath = path.resolve(__dirname, "../fixtures/reddit-feed.html");
const redditFixtureUrl = "https://www.reddit.com/r/all/";

async function openRedditFixture(testInfo) {
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

  await page.goto(redditFixtureUrl);

  return { context, page };
}

test.describe("Reddit content filter extension", () => {
  test("hides adult content while leaving safe posts visible", async ({}, testInfo) => {
    const { context, page } = await openRedditFixture(testInfo);

    try {
      await expect(page.getByTestId("safe-post")).toBeVisible();
      await expect(page.getByTestId("nsfw-post")).toBeHidden();
      await expect(page.getByTestId("adult-keyword-post")).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test("filters posts added after initial page load", async ({}, testInfo) => {
    const { context, page } = await openRedditFixture(testInfo);

    try {
      await page.evaluate(() => {
        const post = document.createElement("article");
        post.dataset.testid = "dynamic-nsfw-post";
        post.textContent = "NSFW post added by infinite scroll";
        document.querySelector("main").append(post);
      });

      await expect(page.getByTestId("dynamic-nsfw-post")).toBeHidden();
    } finally {
      await context.close();
    }
  });
});
