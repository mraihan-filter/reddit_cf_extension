const FILTERED_ATTRIBUTE = "data-rcf-filtered";

const ALWAYS_HIDE_SECTION_HEADINGS = ["games on reddit", "recent"];
const HOME_FEED_SELECTORS = [
  '[data-rcf-region="home-feed"]',
  "main",
  '[role="main"]'
];
const RIGHT_RECENT_POSTS_SELECTORS = [
  '[data-rcf-region="right-recent-posts"]',
  'aside[aria-label*="recent posts" i]',
  '[aria-label*="recent posts" i]'
];

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hideElement(element) {
  if (!element || element.getAttribute(FILTERED_ATTRIBUTE) === "true") {
    return false;
  }

  element.setAttribute(FILTERED_ATTRIBUTE, "true");
  element.style.setProperty("display", "none", "important");
  return true;
}

function isRedditHomepage() {
  const host = location.hostname.replace(/^www\./, "");
  return host === "reddit.com" && location.pathname === "/";
}

function findSectionContainerFromHeading(heading) {
  return (
    heading.closest("section") ||
    heading.closest("reddit-sidebar-nav-section") ||
    heading.closest("[data-rcf-section]") ||
    heading.parentElement
  );
}

function hideLeftNavSections() {
  let hiddenCount = 0;

  document.querySelectorAll("nav h1, nav h2, nav h3, nav h4, nav h5, nav h6, nav summary, nav [aria-label], nav [data-rcf-heading]").forEach((element) => {
    const label = normalizeText(
      element.getAttribute("aria-label") ||
        element.getAttribute("data-rcf-heading") ||
        element.textContent
    );

    if (!ALWAYS_HIDE_SECTION_HEADINGS.includes(label)) {
      return;
    }

    if (hideElement(findSectionContainerFromHeading(element))) {
      hiddenCount += 1;
    }
  });

  return hiddenCount;
}

function hideHomepageRegions() {
  if (!isRedditHomepage()) {
    return 0;
  }

  let hiddenCount = 0;

  for (const selector of HOME_FEED_SELECTORS) {
    const element = document.querySelector(selector);
    if (element && hideElement(element)) {
      hiddenCount += 1;
      break;
    }
  }

  for (const selector of RIGHT_RECENT_POSTS_SELECTORS) {
    const element = document.querySelector(selector);
    if (element && hideElement(element)) {
      hiddenCount += 1;
      break;
    }
  }

  return hiddenCount;
}

function filterDocument() {
  return hideLeftNavSections() + hideHomepageRegions();
}

function startFiltering() {
  filterDocument();

  const observer = new MutationObserver(() => {
    filterDocument();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startFiltering, { once: true });
} else {
  startFiltering();
}

globalThis.redditContentFilter = {
  filterDocument
};
