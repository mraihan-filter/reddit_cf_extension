const FILTERED_ATTRIBUTE = "data-rcf-filtered";

const GAMES_ON_REDDIT_SELECTOR = 'faceplate-tracker[source="nav"][action="view"][noun="games_drawer"]';
const LEFT_RECENT_SELECTOR = "#recent-communities-section";
const HOMEPAGE_CONTENT_SELECTOR = ".main-container";

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

function hideAlwaysBlockedSections() {
  let hiddenCount = 0;

  if (hideElement(document.querySelector(GAMES_ON_REDDIT_SELECTOR))) {
    hiddenCount += 1;
  }

  if (hideElement(document.querySelector(LEFT_RECENT_SELECTOR))) {
    hiddenCount += 1;
  }

  return hiddenCount;
}

function hideHomepageContent() {
  if (!isRedditHomepage()) {
    return 0;
  }

  const homepageContent = document.querySelector(HOMEPAGE_CONTENT_SELECTOR);
  const hasHomeRegions =
    homepageContent &&
    homepageContent.querySelector("#main-content, #right-sidebar-container");

  return hasHomeRegions && hideElement(homepageContent) ? 1 : 0;
}

function filterDocument() {
  return hideAlwaysBlockedSections() + hideHomepageContent();
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
