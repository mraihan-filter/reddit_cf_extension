const FILTERED_ATTRIBUTE = "data-rcf-filtered";
const FILTERED_PREVIOUS_DISPLAY_ATTRIBUTE = "data-rcf-previous-display";
const SETTINGS_KEY = "redditContentFilterSettings";
const PREFILTER_STYLE_ID = "reddit-content-filter-prefilter";

const GAMES_ON_REDDIT_SELECTOR = 'faceplate-tracker[source="nav"][action="view"][noun="games_drawer"]';
const LEFT_RECENT_SELECTOR = "#recent-communities-section";
const HOMEPAGE_CONTENT_SELECTOR = ".main-container";
const HOMEPAGE_CONTENT_READY_SELECTOR = `${HOMEPAGE_CONTENT_SELECTOR}:has(#main-content, #right-sidebar-container)`;
const SEARCH_COMMUNITIES_SELECTOR = "#subreddit_typeahead_section";
const SEARCH_PROFILES_SELECTOR = "#profile_typeahead_section";
const SEARCH_COMMUNITY_ITEMS_SELECTOR = 'search-telemetry-tracker[data-type="search-dropdown-item"][data-faceplate-tracking-context*="\\"type\\":\\"subreddit\\""]';
const SEARCH_PROFILE_ITEMS_SELECTOR = 'search-telemetry-tracker[data-type="search-dropdown-item"][data-faceplate-tracking-context*="\\"type\\":\\"profile\\""]';
const BLOCKED_COMMUNITY_OVER_18_SELECTOR = 'faceplate-tracker[source="blocked_community_page"][action="click"][noun="browse"], #nsfw-action-button, confirm-over-18';
const SETTINGS_MATURE_CONTENT_ROW_SELECTOR = 'settings-preferences label[data-testid="is-nsfw-shown"], label[data-testid="is-nsfw-shown"]';
const DEFAULT_SETTINGS = {
  enabled: true,
  hideGamesOnReddit: true,
  hideLeftRecent: true,
  hideHomepageContent: true,
  hideSearchCommunities: true,
  hideSearchProfiles: true,
  hideBlockedCommunityOver18Button: true,
  hideSettingsMatureContentRow: true
};

let currentSettings = { ...DEFAULT_SETTINGS };
let observer;
let currentUrl = location.href;
let routeWatcherInstalled = false;
const observedRoots = new WeakSet();

function buildPrefilterCss(settings) {
  if (!settings.enabled) {
    return "";
  }

  const selectors = [];

  if (settings.hideGamesOnReddit) {
    selectors.push(GAMES_ON_REDDIT_SELECTOR);
  }

  if (settings.hideLeftRecent) {
    selectors.push(LEFT_RECENT_SELECTOR);
  }

  if (settings.hideHomepageContent && isRedditHomepage()) {
    selectors.push(HOMEPAGE_CONTENT_READY_SELECTOR);
  }

  if (selectors.length === 0) {
    return "";
  }

  return `${selectors.join(",")} { display: none !important; }`;
}

function removePrefilterStyle() {
  document.getElementById(PREFILTER_STYLE_ID)?.remove();
}

function applyPrefilterStyle(settings = currentSettings) {
  const css = buildPrefilterCss(settings);

  if (!css) {
    removePrefilterStyle();
    return;
  }

  let style = document.getElementById(PREFILTER_STYLE_ID);

  if (!style) {
    style = document.createElement("style");
    style.id = PREFILTER_STYLE_ID;
    (document.head || document.documentElement).append(style);
  }

  style.textContent = css;
}

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
  queryDeepAll(selector).forEach(showElement);
}

function showAllFilteredElements() {
  queryDeepAll(`[${FILTERED_ATTRIBUTE}="true"]`).forEach(showElement);
}

function queryDeepAll(selector, root = document) {
  const matches = Array.from(root.querySelectorAll(selector));

  for (const element of root.querySelectorAll("*")) {
    if (element.shadowRoot) {
      matches.push(...queryDeepAll(selector, element.shadowRoot));
    }
  }

  return matches;
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
    showElements(HOMEPAGE_CONTENT_READY_SELECTOR);
    return 0;
  }

  return hideElement(document.querySelector(HOMEPAGE_CONTENT_READY_SELECTOR)) ? 1 : 0;
}

function hideSearchDropdownSections() {
  let hiddenCount = 0;

  if (currentSettings.hideSearchCommunities) {
    for (const element of queryDeepAll(`${SEARCH_COMMUNITIES_SELECTOR}, ${SEARCH_COMMUNITY_ITEMS_SELECTOR}`)) {
      if (hideElement(element)) {
        hiddenCount += 1;
      }
    }
  } else {
    showElements(SEARCH_COMMUNITIES_SELECTOR);
    showElements(SEARCH_COMMUNITY_ITEMS_SELECTOR);
  }

  if (currentSettings.hideSearchProfiles) {
    for (const element of queryDeepAll(`${SEARCH_PROFILES_SELECTOR}, ${SEARCH_PROFILE_ITEMS_SELECTOR}`)) {
      if (hideElement(element)) {
        hiddenCount += 1;
      }
    }
  } else {
    showElements(SEARCH_PROFILES_SELECTOR);
    showElements(SEARCH_PROFILE_ITEMS_SELECTOR);
  }

  return hiddenCount;
}

function hideBlockedCommunityModalActions() {
  if (currentSettings.hideBlockedCommunityOver18Button) {
    let hiddenCount = 0;

    for (const element of queryDeepAll(BLOCKED_COMMUNITY_OVER_18_SELECTOR)) {
      if (hideElement(element)) {
        hiddenCount += 1;
      }
    }

    return hiddenCount;
  }

  showElements(BLOCKED_COMMUNITY_OVER_18_SELECTOR);
  return 0;
}

function hideSettingsRows() {
  if (currentSettings.hideSettingsMatureContentRow) {
    let hiddenCount = 0;

    for (const element of queryDeepAll(SETTINGS_MATURE_CONTENT_ROW_SELECTOR)) {
      if (hideElement(element)) {
        hiddenCount += 1;
      }
    }

    return hiddenCount;
  }

  showElements(SETTINGS_MATURE_CONTENT_ROW_SELECTOR);
  return 0;
}

function filterDocument() {
  if (!currentSettings.enabled) {
    removePrefilterStyle();
    showAllFilteredElements();
    return 0;
  }

  observeShadowRoots();

  return hideAlwaysBlockedSections() + hideHomepageContent() + hideSearchDropdownSections() + hideBlockedCommunityModalActions() + hideSettingsRows();
}

function reconcileRoute() {
  applyPrefilterStyle(currentSettings);

  if (!isRedditHomepage()) {
    showElements(HOMEPAGE_CONTENT_READY_SELECTOR);
  }

  filterDocument();
}

function handlePossibleRouteChange() {
  if (currentUrl === location.href) {
    return;
  }

  currentUrl = location.href;
  reconcileRoute();
}

function installRouteWatcher() {
  if (routeWatcherInstalled) {
    return;
  }

  routeWatcherInstalled = true;
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    queueMicrotask(handlePossibleRouteChange);
    return result;
  };

  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    queueMicrotask(handlePossibleRouteChange);
    return result;
  };

  window.addEventListener("popstate", handlePossibleRouteChange);
}

function observeRoot(root) {
  if (!observer || observedRoots.has(root)) {
    return;
  }

  observer.observe(root, {
    childList: true,
    subtree: true
  });
  observedRoots.add(root);
}

function observeShadowRoots(root = document) {
  for (const element of root.querySelectorAll("*")) {
    if (element.shadowRoot) {
      observeRoot(element.shadowRoot);
      observeShadowRoots(element.shadowRoot);
    }
  }
}

function ensureObserver() {
  if (observer) {
    observeShadowRoots();
    return;
  }

  observer = new MutationObserver(() => {
    handlePossibleRouteChange();
    filterDocument();
  });

  observeRoot(document.documentElement);
  observeShadowRoots();
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
    removePrefilterStyle();
    showAllFilteredElements();
    return;
  }

  applyPrefilterStyle(currentSettings);
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
  installRouteWatcher();
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

applyPrefilterStyle(currentSettings);
ensureObserver();
filterDocument();

loadSettings()
  .then((settings) => {
    applySettings(settings);
  })
  .catch(() => {
    applySettings(DEFAULT_SETTINGS);
  });

startFiltering();

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
