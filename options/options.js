const SETTINGS_KEY = "redditContentFilterSettings";
const LOCAL_AI_SETTINGS_KEY = "redditContentFilterAiSettings";
const AI_CACHE_KEY = "redditContentFilterAiVerdictCache";
const AI_LOGS_KEY = "redditContentFilterRuntimeLogs";

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

let currentSettings = { ...DEFAULT_SETTINGS };
let runtimeLogs = [];
let selectedLogId = "";
let saveTimer = 0;

const status = document.getElementById("status");
const navItems = Array.from(document.querySelectorAll(".nav-item"));
const panels = Array.from(document.querySelectorAll("[data-view-panel]"));
const settingControls = Array.from(document.querySelectorAll("[data-setting]"));
const masterToggle = document.getElementById("enabled");
const apiKeyInput = document.getElementById("openRouterApiKey");
const modelInput = document.getElementById("openRouterModel");
const logsList = document.getElementById("logsList");
const logDetails = document.getElementById("logDetails");
const logCount = document.getElementById("logCount");

function setStatus(message) {
  status.textContent = message;
}

function switchView(view) {
  for (const item of navItems) {
    item.classList.toggle("active", item.dataset.view === view);
  }

  for (const panel of panels) {
    panel.classList.toggle("active", panel.dataset.viewPanel === view);
  }
}

function getSettingControls(key) {
  const controls = settingControls.filter((control) => control.dataset.setting === key);

  if (key === "enabled") {
    controls.push(masterToggle);
  }

  return controls;
}

function renderSettings(settings) {
  currentSettings = {
    ...DEFAULT_SETTINGS,
    ...settings
  };

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    for (const control of getSettingControls(key)) {
      control.checked = currentSettings[key];
    }
  }

  updateDisabledState();
}

function renderAiSettings(settings) {
  const next = {
    ...DEFAULT_AI_SETTINGS,
    ...settings
  };

  apiKeyInput.value = next.openRouterApiKey;
  modelInput.value = next.openRouterModel;
}

function readSettingsFromControls(changedKey, checked) {
  return {
    ...currentSettings,
    [changedKey]: checked
  };
}

async function saveSettings(settings) {
  currentSettings = {
    ...DEFAULT_SETTINGS,
    ...settings
  };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: currentSettings });
  await notifyRedditTabs(currentSettings);
  setStatus("Settings saved");
}

async function saveAiSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await chrome.storage.local.set({
      [LOCAL_AI_SETTINGS_KEY]: {
        openRouterApiKey: apiKeyInput.value.trim(),
        openRouterModel: modelInput.value.trim() || DEFAULT_AI_SETTINGS.openRouterModel
      }
    });
    setStatus("AI settings saved");
  }, 250);
}

async function notifyRedditTabs(settings) {
  const tabs = await chrome.tabs.query({
    url: ["*://*.reddit.com/*", "*://reddit.com/*", "*://*.redd.it/*"]
  });

  await Promise.allSettled(
    tabs.map((tab) =>
      chrome.tabs.sendMessage(tab.id, {
        type: "redditContentFilter:applySettings",
        settings
      })
    )
  );
}

function updateDisabledState() {
  const extensionEnabled = currentSettings.enabled;

  for (const control of settingControls) {
    if (control.dataset.setting !== "enabled") {
      control.disabled = !extensionEnabled;
    }
  }

  apiKeyInput.disabled = !extensionEnabled;
  modelInput.disabled = !extensionEnabled;
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "";
  }

  return new Date(timestamp).toLocaleString();
}

function formatLatency(value) {
  return Number.isFinite(value) ? `${value} ms` : "Not recorded";
}

function summarizeUsage(usage = {}) {
  const input = usage.prompt_tokens ?? 0;
  const output = usage.completion_tokens ?? 0;
  const total = usage.total_tokens ?? 0;
  return `Input ${input} | Output ${output} | Total ${total}`;
}

function formatCost(value) {
  return typeof value === "number" ? `$${value}` : "Not recorded";
}

function getDecision(log) {
  return log?.decision === "allow" ? "Allow" : "Block";
}

function renderLogs() {
  logCount.textContent = String(runtimeLogs.length);
  logsList.textContent = "";

  if (runtimeLogs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-panel";
    empty.textContent = "No runtime logs recorded.";
    logsList.append(empty);
    renderSelectedLog(null);
    return;
  }

  if (!runtimeLogs.some((log) => log.id === selectedLogId)) {
    selectedLogId = runtimeLogs[0].id;
  }

  for (const log of runtimeLogs) {
    const button = document.createElement("button");
    const decision = log.decision === "allow" ? "allow" : "block";
    button.className = `log-item${log.id === selectedLogId ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <span class="log-title-row">
        <strong>${escapeHtml(log.normalizedQuery || log.query || "Untitled query")}</strong>
        <span class="decision-pill ${decision}">${getDecision(log)}</span>
      </span>
      <span class="log-summary">${escapeHtml(buildLogSummary(log))}</span>
      <span>${escapeHtml(log.failureReason || "No match details recorded.")}</span>
    `;
    button.addEventListener("click", () => {
      selectedLogId = log.id;
      renderLogs();
    });
    logsList.append(button);
  }

  renderSelectedLog(runtimeLogs.find((log) => log.id === selectedLogId));
}

function buildLogSummary(log) {
  const mode = log.cacheStatus === "cache hit" ? "cache" : log.workerFetchLatencyMs ? "worker fetch" : "content fetch";
  const cost = typeof log.cost === "number" ? ` | $${log.cost}` : "";
  return `${getDecision(log)} | ${mode} | ${formatLatency(log.roundTripMs)} | ${summarizeUsage(log.usage)}${cost} | ${formatDate(log.timestamp)}`;
}

function renderSelectedLog(log) {
  logDetails.textContent = "";

  if (!log) {
    logDetails.append(detailCard("Decision", "No log selected", "", true));
    return;
  }

  const cards = [
    detailCard("Decision", getDecision(log), ""),
    detailCard("Content fetch latency", formatLatency(log.directFetchLatencyMs), "Direct content-script request."),
    detailCard("Worker fetch latency", formatLatency(log.workerFetchLatencyMs), "Fallback request inside extension worker."),
    detailCard("Round-trip", formatLatency(log.roundTripMs), "Total extension request timing."),
    detailCard("Tokens", summarizeUsage(log.usage), "Provider reported token usage for this AI review."),
    detailCard("Overlay visible", formatLatency(log.overlayVisibleMs), "How long the page gate stayed on screen."),
    detailCard("Cost", formatCost(log.cost), log.responseId ? `Response ID: ${log.responseId}` : ""),
    detailCard("Model", log.model || "Not recorded", log.provider ? `Provider: ${log.provider}` : ""),
    detailCard("Cache status", log.cacheStatus || "Not recorded", formatDate(log.timestamp)),
    detailCard("Matches", formatMatches(log), "Matched prompt category numbers.", true),
    detailCard("Raw AI output", log.rawOutput || "Not recorded", "", true),
    detailCard("Search query", log.normalizedQuery || log.query || "Not recorded", log.query && log.query !== log.normalizedQuery ? `Original: ${log.query}` : "", true)
  ];

  if (log.failureReason) {
    cards.splice(1, 0, detailCard("Failure", log.failureReason, "", true));
  }

  logDetails.append(...cards);
}

function formatMatches(log) {
  if (!Array.isArray(log.categories) || log.categories.length === 0) {
    return "No match details recorded.";
  }

  return log.categories.join(", ");
}

function detailCard(label, value, hint, wide = false) {
  const card = document.createElement("div");
  card.className = `detail-card${wide ? " wide" : ""}`;
  card.innerHTML = `
    <span class="detail-label">${escapeHtml(label)}</span>
    <span class="detail-value">${escapeHtml(String(value ?? ""))}</span>
    ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
  `;
  return card;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

async function loadLogs() {
  const result = await chrome.storage.local.get(AI_LOGS_KEY);
  runtimeLogs = Array.isArray(result[AI_LOGS_KEY]) ? result[AI_LOGS_KEY] : [];
  renderLogs();
}

async function clearCache() {
  await chrome.storage.local.remove(AI_CACHE_KEY);
  setStatus("AI verdict cache cleared");
}

async function clearLogs() {
  runtimeLogs = [];
  selectedLogId = "";
  await chrome.storage.local.set({ [AI_LOGS_KEY]: [] });
  renderLogs();
  setStatus("Runtime logs cleared");
}

async function removeSelectedLog() {
  if (!selectedLogId) {
    return;
  }

  runtimeLogs = runtimeLogs.filter((log) => log.id !== selectedLogId);
  selectedLogId = runtimeLogs[0]?.id || "";
  await chrome.storage.local.set({ [AI_LOGS_KEY]: runtimeLogs });
  renderLogs();
  setStatus("Runtime log removed");
}

function downloadLogs() {
  const blob = new Blob([JSON.stringify(runtimeLogs, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `reddit-content-filter-runtime-logs-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function init() {
  const [syncResult, localResult] = await Promise.all([
    chrome.storage.sync.get(SETTINGS_KEY),
    chrome.storage.local.get([LOCAL_AI_SETTINGS_KEY, AI_LOGS_KEY])
  ]);

  renderSettings(syncResult[SETTINGS_KEY]);
  renderAiSettings(localResult[LOCAL_AI_SETTINGS_KEY]);
  runtimeLogs = Array.isArray(localResult[AI_LOGS_KEY]) ? localResult[AI_LOGS_KEY] : [];
  renderLogs();

  for (const item of navItems) {
    item.addEventListener("click", () => switchView(item.dataset.view));
  }

  for (const control of [...settingControls, masterToggle]) {
    control.addEventListener("change", async () => {
      const key = control.dataset.setting || "enabled";
      const settings = readSettingsFromControls(key, control.checked);
      renderSettings(settings);
      await saveSettings(settings);
    });
  }

  apiKeyInput.addEventListener("input", saveAiSettings);
  modelInput.addEventListener("input", saveAiSettings);
  document.getElementById("clearCache").addEventListener("click", clearCache);
  document.getElementById("clearLogs").addEventListener("click", clearLogs);
  document.getElementById("removeLog").addEventListener("click", removeSelectedLog);
  document.getElementById("downloadLogs").addEventListener("click", downloadLogs);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[AI_LOGS_KEY]) {
      runtimeLogs = Array.isArray(changes[AI_LOGS_KEY].newValue) ? changes[AI_LOGS_KEY].newValue : [];
      renderLogs();
    }
  });

  setStatus("Settings loaded");
}

init().catch((error) => {
  setStatus(error.message || String(error));
});
