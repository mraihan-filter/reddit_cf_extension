const DEFAULT_RULES = {
  enabled: true,
  blockedTerms: [
    "18+",
    "adult",
    "gonewild",
    "nsfl",
    "nsfw",
    "nude",
    "onlyfans",
    "porn",
    "sex",
    "sexual"
  ],
  blockedSelectors: [
    '[data-testid="post-container"]',
    "article",
    "[slot='post-container']",
    "shreddit-post",
    "[data-adclicklocation='title']"
  ]
};

const FILTERED_ATTRIBUTE = "data-rcf-filtered";

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function containsBlockedTerm(text, rules) {
  const normalized = normalizeText(text);
  return rules.blockedTerms.some((term) => normalized.includes(term));
}

function isExplicitElement(element, rules) {
  const text = [
    element.innerText,
    element.textContent,
    element.getAttribute("aria-label"),
    element.getAttribute("data-subreddit-prefixed"),
    element.getAttribute("subreddit-prefixed"),
    element.getAttribute("post-title")
  ].join(" ");

  if (containsBlockedTerm(text, rules)) {
    return true;
  }

  if (
    element.matches(
      [
        "[data-nsfw='true']",
        "[over18='true']",
        "[data-over18='true']",
        "[data-testid*='nsfw' i]",
        "[aria-label*='nsfw' i]",
        "[aria-label*='not safe for work' i]"
      ].join(",")
    )
  ) {
    return true;
  }

  return Boolean(
    element.querySelector(
      [
        "[data-nsfw='true']",
        "[over18='true']",
        "[data-over18='true']",
        "[data-testid*='nsfw' i]",
        "[aria-label*='nsfw' i]",
        "[aria-label*='not safe for work' i]"
      ].join(",")
    )
  );
}

function hideElement(element) {
  if (element.getAttribute(FILTERED_ATTRIBUTE) === "true") {
    return;
  }

  element.setAttribute(FILTERED_ATTRIBUTE, "true");
  element.style.setProperty("display", "none", "important");
}

function filterDocument(rules = DEFAULT_RULES) {
  if (!rules.enabled) {
    return 0;
  }

  let filteredCount = 0;
  const candidates = new Set();

  for (const selector of rules.blockedSelectors) {
    document.querySelectorAll(selector).forEach((element) => candidates.add(element));
  }

  document.querySelectorAll("[data-nsfw='true'], [over18='true'], [data-over18='true']").forEach((element) => {
    candidates.add(element.closest(DEFAULT_RULES.blockedSelectors.join(",")) || element);
  });

  for (const element of candidates) {
    if (isExplicitElement(element, rules)) {
      hideElement(element);
      filteredCount += 1;
    }
  }

  return filteredCount;
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
