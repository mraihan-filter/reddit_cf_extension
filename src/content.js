const FILTERED_ATTRIBUTE = "data-rcf-filtered";
const FILTERED_PREVIOUS_DISPLAY_ATTRIBUTE = "data-rcf-previous-display";
const SETTINGS_KEY = "redditContentFilterSettings";
const LOCAL_AI_SETTINGS_KEY = "redditContentFilterAiSettings";
const AI_CACHE_KEY = "redditContentFilterAiVerdictCache";
const AI_LOGS_KEY = "redditContentFilterRuntimeLogs";
const PREFILTER_STYLE_ID = "reddit-content-filter-prefilter";
const OVERLAY_ID = "reddit-content-filter-ai-overlay";
const PROMPT_PATH = "prompts/search-review-default.md";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LOGS = 50;

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
  hideSettingsMatureContentRow: true,
  reviewSearchPagesWithAi: true
};
const DEFAULT_AI_SETTINGS = {
  openRouterApiKey: "",
  openRouterModel: "google/gemini-2.5-flash-lite"
};
const CATEGORY_LABELS = {
  1: "Female name of any locale or nationality",
  2: "Performative entertainment title or personality",
  3: "Human sexuality content or product",
  4: "NSFW content or product",
  5: "Female apparel",
  6: "Common human body-part term",
  7: "Obfuscated fragment"
};

let currentSettings = { ...DEFAULT_SETTINGS };
let observer;
let currentUrl = location.href;
let routeWatcherInstalled = false;
let activeSearchReviewId = 0;
let overlayShownAt = 0;
let settingsLoaded = false;
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

function getSearchQuery() {
  const host = location.hostname.replace(/^www\./, "");

  if (host !== "reddit.com" || location.pathname.replace(/\/+$/, "") !== "/search") {
    return "";
  }

  return new URLSearchParams(location.search).get("q") || "";
}

function normalizeSearchQuery(query) {
  return query
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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
    removeAiOverlay();
    return 0;
  }

  observeShadowRoots();

  return hideAlwaysBlockedSections() + hideHomepageContent() + hideSearchDropdownSections() + hideBlockedCommunityModalActions() + hideSettingsRows();
}

function getCategoryLabels(categories = []) {
  return categories.map((category) => CATEGORY_LABELS[category] || `Category ${category}`);
}

function ensureAiOverlay(mode, text, categories = []) {
  let overlay = document.getElementById(OVERLAY_ID);

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
      <div class="rcf-ai-card">
        <div class="rcf-ai-spinner" aria-hidden="true"></div>
        <strong class="rcf-ai-title"></strong>
        <span class="rcf-ai-copy"></span>
        <ul class="rcf-ai-reasons"></ul>
        <div class="rcf-ai-actions">
          <button class="rcf-ai-action rcf-ai-back" type="button" data-rcf-action="back" aria-label="Go back" title="Go back"></button>
          <button class="rcf-ai-action rcf-ai-home" type="button" data-rcf-action="home" aria-label="Go home" title="Go home"></button>
        </div>
      </div>
    `;
    overlay.addEventListener("click", (event) => {
      const action = event.target?.closest?.("[data-rcf-action]")?.dataset.rcfAction;

      if (action === "back") {
        history.back();
      } else if (action === "home") {
        location.assign("https://www.reddit.com/");
      }
    });
    (document.documentElement || document.body).append(overlay);
  }

  if (!overlayShownAt) {
    overlayShownAt = performance.now();
  }

  overlay.dataset.mode = mode;
  overlay.querySelector(".rcf-ai-title").textContent = mode === "blocked" ? "Search blocked" : "Reviewing search";
  overlay.querySelector(".rcf-ai-copy").textContent = text;

  const reasons = overlay.querySelector(".rcf-ai-reasons");
  reasons.textContent = "";
  for (const label of getCategoryLabels(categories)) {
    const item = document.createElement("li");
    item.textContent = label;
    reasons.append(item);
  }
}

function removeAiOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
  overlayShownAt = 0;
}

function getOverlayVisibleMs() {
  return overlayShownAt ? Math.max(1, Math.round(performance.now() - overlayShownAt)) : 0;
}

function getQueryCacheKey(normalizedQuery) {
  return `q:${normalizedQuery}`;
}

async function readAiSettings() {
  const result = await chrome.storage.local.get(LOCAL_AI_SETTINGS_KEY);
  return {
    ...DEFAULT_AI_SETTINGS,
    ...result[LOCAL_AI_SETTINGS_KEY]
  };
}

async function getPrompt() {
  const response = await fetch(chrome.runtime.getURL(PROMPT_PATH));

  if (!response.ok) {
    throw new Error(`Prompt fetch failed: ${response.status}`);
  }

  return response.text();
}

function buildOpenRouterHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://www.reddit.com",
    "X-OpenRouter-Title": "Personal Reddit Content Filter"
  };
}

async function classifyWithContentFetch(normalizedQuery) {
  const aiSettings = await readAiSettings();

  if (!aiSettings.openRouterApiKey) {
    throw new Error("OpenRouter API key is missing");
  }

  const prompt = await getPrompt();
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: buildOpenRouterHeaders(aiSettings.openRouterApiKey),
      signal: controller.signal,
      body: JSON.stringify({
        model: aiSettings.openRouterModel,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: normalizedQuery }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      })
    });

    const responseText = await response.text();
    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status} ${responseText.slice(0, 180)}`);
    }

    const data = JSON.parse(responseText);
    return {
      latencyMs,
      model: data.model || aiSettings.openRouterModel,
      id: data.id || "",
      usage: data.usage || {},
      content: data.choices?.[0]?.message?.content || "",
      provider: "OpenRouter"
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function classifyWithWorker(normalizedQuery) {
  const startedAt = performance.now();
  const response = await chrome.runtime.sendMessage({
    type: "redditContentFilter:classifySearchQuery",
    normalizedQuery
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Worker classification failed");
  }

  return {
    ...response.result,
    latencyMs: Math.round(performance.now() - startedAt)
  };
}

function parseAiDecision(rawOutput) {
  const parsed = JSON.parse(rawOutput);
  const decisionCode = parsed?.d;
  const categories = Array.isArray(parsed?.c) ? parsed.c.filter((value) => Number.isInteger(value)) : [];

  if (decisionCode !== "p" && decisionCode !== "b" && decisionCode !== "u") {
    throw new Error("AI response decision code is invalid");
  }

  return {
    decision: decisionCode === "p" ? "allow" : "block",
    decisionCode,
    categories
  };
}

async function readCachedVerdict(normalizedQuery) {
  const cacheKey = getQueryCacheKey(normalizedQuery);
  const result = await chrome.storage.local.get(AI_CACHE_KEY);
  const cache = result[AI_CACHE_KEY] || {};
  const cached = cache[cacheKey];

  if (!cached || cached.expiresAt <= Date.now()) {
    return null;
  }

  return cached;
}

async function writeCachedVerdict(normalizedQuery, verdict) {
  const cacheKey = getQueryCacheKey(normalizedQuery);
  const result = await chrome.storage.local.get(AI_CACHE_KEY);
  const cache = result[AI_CACHE_KEY] || {};

  cache[cacheKey] = {
    ...verdict,
    createdAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  await chrome.storage.local.set({ [AI_CACHE_KEY]: cache });
}

async function appendRuntimeLog(log) {
  const result = await chrome.storage.local.get(AI_LOGS_KEY);
  const logs = Array.isArray(result[AI_LOGS_KEY]) ? result[AI_LOGS_KEY] : [];
  logs.unshift(log);
  await chrome.storage.local.set({ [AI_LOGS_KEY]: logs.slice(0, MAX_LOGS) });
}

function buildLog(base, details) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    url: location.href,
    overlayVisibleMs: getOverlayVisibleMs(),
    ...base,
    ...details
  };
}

async function reviewCurrentSearchPage() {
  activeSearchReviewId += 1;
  const reviewId = activeSearchReviewId;
  const rawQuery = getSearchQuery();
  const normalizedQuery = normalizeSearchQuery(rawQuery);

  if (!currentSettings.enabled || !currentSettings.reviewSearchPagesWithAi || !normalizedQuery) {
    removeAiOverlay();
    return;
  }

  ensureAiOverlay("loading", "Checking this Reddit search before showing results.");
  const roundTripStartedAt = performance.now();
  const baseLog = {
    query: rawQuery,
    normalizedQuery,
    directFetchLatencyMs: null,
    workerFetchLatencyMs: null,
    roundTripMs: 0,
    model: "",
    provider: "",
    responseId: "",
    usage: {},
    cost: null,
    rawOutput: "",
    categories: [],
    cacheStatus: "fresh provider run",
    failureReason: ""
  };

  try {
    const cached = await readCachedVerdict(normalizedQuery);
    if (reviewId !== activeSearchReviewId) {
      return;
    }

    if (cached) {
      baseLog.cacheStatus = "cache hit";
      const log = buildLog(baseLog, {
        decision: cached.decision,
        decisionCode: cached.decisionCode,
        categories: cached.categories || [],
        rawOutput: cached.rawOutput || "",
        model: cached.model || "",
        provider: cached.provider || "",
        roundTripMs: Math.round(performance.now() - roundTripStartedAt)
      });
      await appendRuntimeLog(log);
      applyAiVerdict(cached.decision, "Cached search verdict blocked this page.", cached.categories || []);
      return;
    }

    let providerResult;
    let directError = "";

    try {
      providerResult = await classifyWithContentFetch(normalizedQuery);
      baseLog.directFetchLatencyMs = providerResult.latencyMs;
    } catch (error) {
      directError = error.message || String(error);
      providerResult = await classifyWithWorker(normalizedQuery);
      baseLog.workerFetchLatencyMs = providerResult.latencyMs;
      baseLog.cacheStatus = "fresh worker fallback run";
    }

    if (reviewId !== activeSearchReviewId) {
      return;
    }

    const parsed = parseAiDecision(providerResult.content);
    const verdict = {
      decision: parsed.decision,
      decisionCode: parsed.decisionCode,
      categories: parsed.categories,
      rawOutput: providerResult.content,
      model: providerResult.model,
      provider: providerResult.provider
    };

    await writeCachedVerdict(normalizedQuery, verdict);
    await appendRuntimeLog(buildLog(baseLog, {
      decision: parsed.decision,
      decisionCode: parsed.decisionCode,
      categories: parsed.categories,
      directFetchError: directError,
      model: providerResult.model,
      provider: providerResult.provider,
      responseId: providerResult.id,
      usage: providerResult.usage || {},
      cost: providerResult.usage?.cost ?? null,
      rawOutput: providerResult.content,
      roundTripMs: Math.round(performance.now() - roundTripStartedAt)
    }));

    applyAiVerdict(parsed.decision, "This search was blocked by the AI review.", parsed.categories);
  } catch (error) {
    if (reviewId !== activeSearchReviewId) {
      return;
    }

    await appendRuntimeLog(buildLog(baseLog, {
      decision: "block",
      decisionCode: "failure",
      failureReason: error.message || String(error),
      roundTripMs: Math.round(performance.now() - roundTripStartedAt)
    }));
    ensureAiOverlay("blocked", "AI review failed, so this search is blocked.");
  }
}

function applyAiVerdict(decision, blockedText, categories = []) {
  if (decision === "allow") {
    removeAiOverlay();
    return;
  }

  ensureAiOverlay("blocked", blockedText, categories);
}

function reconcileRoute() {
  applyPrefilterStyle(currentSettings);

  if (!isRedditHomepage()) {
    showElements(HOMEPAGE_CONTENT_READY_SELECTOR);
  }

  filterDocument();
  reviewCurrentSearchPage();
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
    removeAiOverlay();
    return;
  }

  applyPrefilterStyle(currentSettings);
  ensureObserver();
  filterDocument();
  if (settingsLoaded) {
    reviewCurrentSearchPage();
  }
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
      if (areaName === "sync" && changes[SETTINGS_KEY]) {
        applySettings(changes[SETTINGS_KEY].newValue);
      }

      if (areaName === "local" && changes[LOCAL_AI_SETTINGS_KEY]) {
        reviewCurrentSearchPage();
      }
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
    settingsLoaded = true;
    applySettings(settings);
  })
  .catch(() => {
    settingsLoaded = true;
    applySettings(DEFAULT_SETTINGS);
  });

startFiltering();

globalThis.redditContentFilter = {
  applySettings,
  filterDocument,
  getSettings: () => currentSettings,
  normalizeSearchQuery,
  reviewCurrentSearchPage,
  showAllFilteredElements,
  stop: () => {
    observer?.disconnect();
    showAllFilteredElements();
    removeAiOverlay();
  }
};
