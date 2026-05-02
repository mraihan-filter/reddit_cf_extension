const SETTINGS_KEY = "redditContentFilterSettings";
const LOCAL_AI_SETTINGS_KEY = "redditContentFilterAiSettings";
const AI_CACHE_KEY = "redditContentFilterAiVerdictCache";
const AI_LOGS_KEY = "redditContentFilterRuntimeLogs";
const AI_LAB_SETTINGS_KEY = "redditContentFilterAiLabSettings";
const AI_LAB_LOGS_KEY = "redditContentFilterAiLabLogs";
const PROMPT_INDEX_PATH = "prompts/index.json";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_AI_LAB_LOGS = 100;

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
const DEFAULT_AI_LAB_SETTINGS = {
  models: ["google/gemini-2.5-flash-lite"],
  selectedModel: "google/gemini-2.5-flash-lite",
  selectedPromptPath: "prompts/search-review-default.md",
  userInput: ""
};

let currentSettings = { ...DEFAULT_SETTINGS };
let currentAiSettings = { ...DEFAULT_AI_SETTINGS };
let aiLabSettings = { ...DEFAULT_AI_LAB_SETTINGS };
let runtimeLogs = [];
let aiLabLogs = [];
let aiLabPrompts = [];
let selectedLogId = "";
let selectedAiLabLogId = "";
let saveTimer = 0;

const status = document.getElementById("status");
const navItems = Array.from(document.querySelectorAll(".nav-item"));
const panels = Array.from(document.querySelectorAll("[data-view-panel]"));
const settingControls = Array.from(document.querySelectorAll("[data-setting]"));
const apiKeyInput = document.getElementById("openRouterApiKey");
const modelInput = document.getElementById("openRouterModel");
const logsList = document.getElementById("logsList");
const logDetails = document.getElementById("logDetails");
const logCount = document.getElementById("logCount");
const aiLabModelInput = document.getElementById("aiLabModelInput");
const aiLabModelSelect = document.getElementById("aiLabModelSelect");
const aiLabAddModel = document.getElementById("aiLabAddModel");
const aiLabRemoveModel = document.getElementById("aiLabRemoveModel");
const aiLabPromptSelect = document.getElementById("aiLabPromptSelect");
const aiLabPromptDescription = document.getElementById("aiLabPromptDescription");
const aiLabUserInput = document.getElementById("aiLabUserInput");
const aiLabRun = document.getElementById("aiLabRun");
const aiLabClearLogs = document.getElementById("aiLabClearLogs");
const aiLabOutput = document.getElementById("aiLabOutput");
const aiLabLogsList = document.getElementById("aiLabLogsList");
const aiLabLogDetails = document.getElementById("aiLabLogDetails");
const aiLabLogCount = document.getElementById("aiLabLogCount");
const CATEGORY_LABELS = {
  1: "Female name of any locale or nationality",
  2: "Performative entertainment title or personality",
  3: "Human sexuality content or product",
  4: "NSFW content or product",
  5: "Female apparel",
  6: "Common human body-part term",
  7: "Obfuscated fragment"
};

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
  return settingControls.filter((control) => control.dataset.setting === key);
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

  currentAiSettings = next;
  apiKeyInput.value = next.openRouterApiKey;
  modelInput.value = next.openRouterModel;
}

function normalizeAiLabSettings(settings = {}, aiGateModel = currentAiSettings.openRouterModel) {
  const models = Array.from(new Set([
    ...DEFAULT_AI_LAB_SETTINGS.models,
    aiGateModel,
    ...(Array.isArray(settings.models) ? settings.models : [])
  ].filter(Boolean)));
  const selectedModel = models.includes(settings.selectedModel) ? settings.selectedModel : models[0];

  return {
    ...DEFAULT_AI_LAB_SETTINGS,
    ...settings,
    models,
    selectedModel
  };
}

function renderAiLabSettings(settings) {
  aiLabSettings = normalizeAiLabSettings(settings);
  aiLabModelSelect.textContent = "";

  for (const model of aiLabSettings.models) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    aiLabModelSelect.append(option);
  }

  aiLabModelSelect.value = aiLabSettings.selectedModel;
  aiLabUserInput.value = aiLabSettings.userInput || "";
  renderAiLabPrompts();
}

function renderAiLabPrompts() {
  aiLabPromptSelect.textContent = "";

  for (const prompt of aiLabPrompts) {
    const option = document.createElement("option");
    option.value = prompt.path;
    option.textContent = prompt.label;
    aiLabPromptSelect.append(option);
  }

  if (aiLabPrompts.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No prompts found";
    aiLabPromptSelect.append(option);
  }

  const promptExists = aiLabPrompts.some((prompt) => prompt.path === aiLabSettings.selectedPromptPath);
  aiLabPromptSelect.value = promptExists ? aiLabSettings.selectedPromptPath : aiLabPrompts[0]?.path || "";
  updateAiLabPromptDescription();
}

function updateAiLabPromptDescription() {
  const selected = aiLabPrompts.find((prompt) => prompt.path === aiLabPromptSelect.value);
  aiLabPromptDescription.textContent = selected?.description || "";
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
    currentAiSettings = {
      openRouterApiKey: apiKeyInput.value.trim(),
      openRouterModel: modelInput.value.trim() || DEFAULT_AI_SETTINGS.openRouterModel
    };
    await chrome.storage.local.set({
      [LOCAL_AI_SETTINGS_KEY]: currentAiSettings
    });
    setStatus("AI settings saved");
  }, 250);
}

async function saveAiLabSettings(partial = {}) {
  aiLabSettings = normalizeAiLabSettings({
    ...aiLabSettings,
    ...partial
  });
  await chrome.storage.local.set({ [AI_LAB_SETTINGS_KEY]: aiLabSettings });
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

function renderAiLabLogs() {
  aiLabLogCount.textContent = String(aiLabLogs.length);
  aiLabLogsList.textContent = "";

  if (aiLabLogs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-panel";
    empty.textContent = "No AI Lab logs recorded.";
    aiLabLogsList.append(empty);
    renderSelectedAiLabLog(null);
    return;
  }

  if (!aiLabLogs.some((log) => log.id === selectedAiLabLogId)) {
    selectedAiLabLogId = aiLabLogs[0].id;
  }

  for (const log of aiLabLogs) {
    const button = document.createElement("button");
    button.className = `log-item${log.id === selectedAiLabLogId ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <span class="log-title-row">
        <strong>${escapeHtml(log.inputPreview || "Untitled lab input")}</strong>
        <span class="decision-pill ${log.error ? "block" : "allow"}">${log.error ? "Error" : "Run"}</span>
      </span>
      <span class="log-summary">${escapeHtml(`${log.model} | ${log.promptLabel} | ${formatLatency(log.latencyMs)} | ${summarizeUsage(log.usage)} | ${formatDate(log.timestamp)}`)}</span>
      <span>${escapeHtml(log.error || "Lab run completed.")}</span>
    `;
    button.addEventListener("click", () => {
      selectedAiLabLogId = log.id;
      renderAiLabLogs();
    });
    aiLabLogsList.append(button);
  }

  renderSelectedAiLabLog(aiLabLogs.find((log) => log.id === selectedAiLabLogId));
}

function renderSelectedAiLabLog(log) {
  aiLabLogDetails.textContent = "";

  if (!log) {
    aiLabLogDetails.append(detailCard("AI Lab", "No lab log selected", "", true));
    return;
  }

  const cards = [
    detailCard("Model", log.model || "Not recorded", ""),
    detailCard("Prompt", log.promptLabel || "Not recorded", log.promptPath || ""),
    detailCard("Latency", formatLatency(log.latencyMs), ""),
    detailCard("Tokens", summarizeUsage(log.usage), ""),
    detailCard("Cost", formatCost(log.cost), log.responseId ? `Response ID: ${log.responseId}` : ""),
    detailCard("Timestamp", formatDate(log.timestamp), ""),
    detailCard("User input", log.userInput || "Not recorded", "", true),
    detailCard("Raw output", log.rawOutput || log.error || "Not recorded", "", true)
  ];

  aiLabLogDetails.append(...cards);
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
    detailCard("Matches", formatMatches(log), "Matched prompt categories.", true),
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

  return log.categories
    .map((category) => CATEGORY_LABELS[category] || `Category ${category}`)
    .join("\n");
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

async function loadPromptIndex() {
  const response = await fetch(chrome.runtime.getURL(PROMPT_INDEX_PATH));

  if (!response.ok) {
    throw new Error(`Prompt registry failed to load: ${response.status}`);
  }

  const prompts = await response.json();
  aiLabPrompts = Array.isArray(prompts) ? prompts : [];
}

async function fetchPrompt(path) {
  const response = await fetch(chrome.runtime.getURL(path));

  if (!response.ok) {
    throw new Error(`Prompt failed to load: ${response.status}`);
  }

  return response.text();
}

function buildOpenRouterHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://www.reddit.com",
    "X-OpenRouter-Title": "Personal Reddit Content Filter AI Lab"
  };
}

async function appendAiLabLog(log) {
  aiLabLogs.unshift(log);
  aiLabLogs = aiLabLogs.slice(0, MAX_AI_LAB_LOGS);
  await chrome.storage.local.set({ [AI_LAB_LOGS_KEY]: aiLabLogs });
  selectedAiLabLogId = aiLabLogs[0]?.id || "";
  renderAiLabLogs();
}

async function runAiLabRequest() {
  const apiKey = apiKeyInput.value.trim();
  const model = aiLabModelSelect.value;
  const promptPath = aiLabPromptSelect.value;
  const promptMeta = aiLabPrompts.find((prompt) => prompt.path === promptPath);
  const userInput = aiLabUserInput.value.trim();
  const startedAt = performance.now();

  if (!apiKey) {
    setStatus("OpenRouter API key is required in AI Gate");
    return;
  }

  if (!model || !promptPath || !userInput) {
    setStatus("AI Lab requires a model, prompt, and user input");
    return;
  }

  aiLabRun.disabled = true;
  aiLabOutput.textContent = "Running lab request...";
  await saveAiLabSettings({
    selectedModel: model,
    selectedPromptPath: promptPath,
    userInput
  });

  const baseLog = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    model,
    promptPath,
    promptLabel: promptMeta?.label || promptPath,
    userInput,
    inputPreview: userInput.slice(0, 80),
    latencyMs: 0,
    usage: {},
    cost: null,
    responseId: "",
    rawOutput: "",
    error: ""
  };

  try {
    const prompt = await fetchPrompt(promptPath);
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: buildOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: userInput }
        ],
        temperature: 0
      })
    });
    const responseText = await response.text();
    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status} ${responseText.slice(0, 180)}`);
    }

    const data = JSON.parse(responseText);
    const rawOutput = data.choices?.[0]?.message?.content || "";
    const log = {
      ...baseLog,
      latencyMs,
      usage: data.usage || {},
      cost: data.usage?.cost ?? null,
      responseId: data.id || "",
      rawOutput
    };

    aiLabOutput.textContent = rawOutput || JSON.stringify(data, null, 2);
    await appendAiLabLog(log);
    setStatus("AI Lab run complete");
  } catch (error) {
    const log = {
      ...baseLog,
      latencyMs: Math.round(performance.now() - startedAt),
      error: error.message || String(error)
    };

    aiLabOutput.textContent = log.error;
    await appendAiLabLog(log);
    setStatus("AI Lab run failed");
  } finally {
    aiLabRun.disabled = false;
  }
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

async function clearAiLabLogs() {
  aiLabLogs = [];
  selectedAiLabLogId = "";
  await chrome.storage.local.set({ [AI_LAB_LOGS_KEY]: [] });
  renderAiLabLogs();
  setStatus("AI Lab logs cleared");
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
  await loadPromptIndex();
  const [syncResult, localResult] = await Promise.all([
    chrome.storage.sync.get(SETTINGS_KEY),
    chrome.storage.local.get([LOCAL_AI_SETTINGS_KEY, AI_LOGS_KEY, AI_LAB_SETTINGS_KEY, AI_LAB_LOGS_KEY])
  ]);

  renderSettings(syncResult[SETTINGS_KEY]);
  renderAiSettings(localResult[LOCAL_AI_SETTINGS_KEY]);
  renderAiLabSettings(localResult[AI_LAB_SETTINGS_KEY]);
  runtimeLogs = Array.isArray(localResult[AI_LOGS_KEY]) ? localResult[AI_LOGS_KEY] : [];
  aiLabLogs = Array.isArray(localResult[AI_LAB_LOGS_KEY]) ? localResult[AI_LAB_LOGS_KEY] : [];
  renderLogs();
  renderAiLabLogs();

  for (const item of navItems) {
    item.addEventListener("click", () => switchView(item.dataset.view));
  }

  for (const control of settingControls) {
    control.addEventListener("change", async () => {
      const key = control.dataset.setting;
      const settings = readSettingsFromControls(key, control.checked);
      renderSettings(settings);
      await saveSettings(settings);
    });
  }

  apiKeyInput.addEventListener("input", saveAiSettings);
  modelInput.addEventListener("input", saveAiSettings);
  aiLabAddModel.addEventListener("click", async () => {
    const model = aiLabModelInput.value.trim();

    if (!model) {
      return;
    }

    await saveAiLabSettings({
      models: Array.from(new Set([...aiLabSettings.models, model])),
      selectedModel: model
    });
    aiLabModelInput.value = "";
    renderAiLabSettings(aiLabSettings);
    setStatus("AI Lab model added");
  });
  aiLabRemoveModel.addEventListener("click", async () => {
    const model = aiLabModelSelect.value;
    const models = aiLabSettings.models.filter((entry) => entry !== model);
    await saveAiLabSettings({
      models: models.length ? models : [...DEFAULT_AI_LAB_SETTINGS.models],
      selectedModel: models[0] || DEFAULT_AI_LAB_SETTINGS.selectedModel
    });
    renderAiLabSettings(aiLabSettings);
    setStatus("AI Lab model removed");
  });
  aiLabModelSelect.addEventListener("change", async () => {
    await saveAiLabSettings({ selectedModel: aiLabModelSelect.value });
  });
  aiLabPromptSelect.addEventListener("change", async () => {
    updateAiLabPromptDescription();
    await saveAiLabSettings({ selectedPromptPath: aiLabPromptSelect.value });
  });
  aiLabUserInput.addEventListener("input", () => {
    saveAiLabSettings({ userInput: aiLabUserInput.value });
  });
  aiLabRun.addEventListener("click", runAiLabRequest);
  aiLabClearLogs.addEventListener("click", clearAiLabLogs);
  document.getElementById("clearCache").addEventListener("click", clearCache);
  document.getElementById("clearLogs").addEventListener("click", clearLogs);
  document.getElementById("removeLog").addEventListener("click", removeSelectedLog);
  document.getElementById("downloadLogs").addEventListener("click", downloadLogs);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[AI_LOGS_KEY]) {
      runtimeLogs = Array.isArray(changes[AI_LOGS_KEY].newValue) ? changes[AI_LOGS_KEY].newValue : [];
      renderLogs();
    }

    if (areaName === "local" && changes[AI_LAB_LOGS_KEY]) {
      aiLabLogs = Array.isArray(changes[AI_LAB_LOGS_KEY].newValue) ? changes[AI_LAB_LOGS_KEY].newValue : [];
      renderAiLabLogs();
    }
  });

  setStatus("Settings loaded");
}

init().catch((error) => {
  setStatus(error.message || String(error));
});
