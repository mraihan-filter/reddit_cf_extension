const FILTERED_ATTRIBUTE = "data-rcf-filtered";
const FILTERED_PREVIOUS_DISPLAY_ATTRIBUTE = "data-rcf-previous-display";
const SETTINGS_KEY = "redditContentFilterSettings";

const GAMES_ON_REDDIT_SELECTOR = 'faceplate-tracker[source="nav"][action="view"][noun="games_drawer"]';
const LEFT_RECENT_SELECTOR = "#recent-communities-section";
const HOMEPAGE_CONTENT_SELECTOR = ".main-container";
const DEFAULT_SETTINGS = {
  enabled: true,
  hideGamesOnReddit: true,
  hideLeftRecent: true,
  hideHomepageContent: true
};

let currentSettings = { ...DEFAULT_SETTINGS };
let observer;

function hideElement(element) {
  if (!element || element.getAttribute(FILTERED_ATTRIBUTE) === "true") {
    return false;
  }

  element.setAttribute(FILTERED_PREVIOUS_DISPLAY_ATTRIBUTE, element.style.display || "");
  element.setAttribute(FILTERED_ATTRIBUTE, "true");
  element.style.setProperty("display", "none", "important");
  return true;
}

function showElement(element) {
  if (!element || element.getAttribute(FILTERED_ATTRIBUTE) !== "true") {
    return false;
  }

  const previousDisplay = element.getAttribute(FILTERED_PREVIOUS_DISPLAY_ATTRIBUTE) || "";

  element.style.removeProperty("display");
  if (previousDisplay) {
    element.style.display = previousDisplay;
  }

  element.removeAttribute(FILTERED_ATTRIBUTE);
  element.removeAttribute(FILTERED_PREVIOUS_DISPLAY_ATTRIBUTE);
  return true;
}

function showElements(selector) {
  document.querySelectorAll(selector).forEach(showElement);
}

function showAllFilteredElements() {
  document.querySelectorAll(`[${FILTERED_ATTRIBUTE}="true"]`).forEach(showElement);
}

function isRedditHomepage() {
  const host = location.hostname.replace(/^www\./, "");
  return host === "reddit.com" && location.pathname === "/";
}

function hideAlwaysBlockedSections() {
  let hiddenCount = 0;

  if (currentSettings.hideGamesOnReddit && hideElement(document.querySelector(GAMES_ON_REDDIT_SELECTOR))) {
    hiddenCount += 1;
  } else if (!currentSettings.hideGamesOnReddit) {
    showElements(GAMES_ON_REDDIT_SELECTOR);
  }

  if (currentSettings.hideLeftRecent && hideElement(document.querySelector(LEFT_RECENT_SELECTOR))) {
    hiddenCount += 1;
  } else if (!currentSettings.hideLeftRecent) {
    showElements(LEFT_RECENT_SELECTOR);
  }

  return hiddenCount;
}

function hideHomepageContent() {
  if (!isRedditHomepage() || !currentSettings.hideHomepageContent) {
    showElements(HOMEPAGE_CONTENT_SELECTOR);
    return 0;
  }

  const homepageContent = document.querySelector(HOMEPAGE_CONTENT_SELECTOR);
  const hasHomeRegions =
    homepageContent &&
    homepageContent.querySelector("#main-content, #right-sidebar-container");

  return hasHomeRegions && hideElement(homepageContent) ? 1 : 0;
}

function filterDocument() {
  if (!currentSettings.enabled) {
    showAllFilteredElements();
    return 0;
  }

  return hideAlwaysBlockedSections() + hideHomepageContent();
}

function ensureObserver() {
  if (observer) {
    return;
  }

  observer = new MutationObserver(() => {
    filterDocument();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function stopObserver() {
  observer?.disconnect();
  observer = undefined;
}

function applySettings(settings) {
  currentSettings = {
    ...DEFAULT_SETTINGS,
    ...settings
  };

  if (!currentSettings.enabled) {
    stopObserver();
    showAllFilteredElements();
    return;
  }

  ensureObserver();
  filterDocument();
}

async function loadSettings() {
  if (!globalThis.chrome?.storage?.sync) {
    return DEFAULT_SETTINGS;
  }

  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...result[SETTINGS_KEY]
  };
}

function startFiltering() {
  applySettings(currentSettings);

  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" || !changes[SETTINGS_KEY]) {
        return;
      }

      applySettings(changes[SETTINGS_KEY].newValue);
    });
  }

  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === "redditContentFilter:applySettings") {
        applySettings(message.settings);
      }
    });
  }
}

loadSettings()
  .then((settings) => {
    currentSettings = settings;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startFiltering, { once: true });
    } else {
      startFiltering();
    }
  })
  .catch(() => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startFiltering, { once: true });
    } else {
      startFiltering();
    }
  });

globalThis.redditContentFilter = {
  applySettings,
  filterDocument,
  getSettings: () => currentSettings,
  showAllFilteredElements,
  stop: () => {
    observer?.disconnect();
    showAllFilteredElements();
  }
};
