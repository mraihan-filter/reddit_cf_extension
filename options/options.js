const SETTINGS_KEY = "redditContentFilterSettings";
const LOCAL_AI_SETTINGS_KEY = "redditContentFilterAiSettings";
const AI_CACHE_KEY = "redditContentFilterAiVerdictCache";
const AI_LOGS_KEY = "redditContentFilterRuntimeLogs";
const AI_LAB_SETTINGS_KEY = "redditContentFilterAiLabSettings";
const AI_LAB_LOGS_KEY = "redditContentFilterAiLabLogs";
const SUBREDDIT_SAFE_CACHE_KEY = "redditContentFilterSubredditSafeCache";
const PROMPT_INDEX_PATH = "prompts/index.json";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_AI_LAB_LOGS = 100;
const MAX_AI_LAB_TEXT_FILE_CHARS = 12000;

const DEFAULT_SETTINGS = {
  enabled: true,
  hideGamesOnReddit: true,
  hideLeftRecent: true,
  hideHomepageContent: true,
  hideSearchCommunities: true,
  hideSearchProfiles: true,
  hideBlockedCommunityOver18Button: true,
  hideSettingsMatureContentRow: true,
  reviewSearchPagesWithAi: true,
  blockedUrlPrefixes: [],
  blockedExactUrls: [],
  subredditGateEnabled: true,
  subredditAllowlist: [],
  subredditBlocklist: [],
  subredditKeywords: []
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
let subredditSafeCache = [];
let aiLabPrompts = [];
let selectedLogId = "";
let selectedAiLabLogId = "";
let saveTimer = 0;
let aiLabImageInput = null;

const status = document.getElementById("status");
const navItems = Array.from(document.querySelectorAll(".nav-item"));
const panels = Array.from(document.querySelectorAll("[data-view-panel]"));
const settingControls = Array.from(document.querySelectorAll("[data-setting]"));
const apiKeyInput = document.getElementById("openRouterApiKey");
const modelInput = document.getElementById("openRouterModel");
const logsList = document.getElementById("logsList");
const logDetails = document.getElementById("logDetails");
const logCount = document.getElementById("logCount");
const blockedUrlPrefixInput = document.getElementById("blockedUrlPrefixInput");
const addBlockedUrlPrefix = document.getElementById("addBlockedUrlPrefix");
const blockedUrlPrefixList = document.getElementById("blockedUrlPrefixList");
const blockedExactUrlInput = document.getElementById("blockedExactUrlInput");
const addBlockedExactUrl = document.getElementById("addBlockedExactUrl");
const blockedExactUrlList = document.getElementById("blockedExactUrlList");
const subredditSlugInput = document.getElementById("subredditSlugInput");
const runSubredditSlugExperiment = document.getElementById("runSubredditSlugExperiment");
const subredditSlugOutput = document.getElementById("subredditSlugOutput");
const subredditAllowlistInput = document.getElementById("subredditAllowlistInput");
const addSubredditAllowlist = document.getElementById("addSubredditAllowlist");
const subredditAllowlist = document.getElementById("subredditAllowlist");
const subredditBlocklistInput = document.getElementById("subredditBlocklistInput");
const addSubredditBlocklist = document.getElementById("addSubredditBlocklist");
const subredditBlocklist = document.getElementById("subredditBlocklist");
const subredditKeywordInput = document.getElementById("subredditKeywordInput");
const addSubredditKeyword = document.getElementById("addSubredditKeyword");
const subredditKeywordList = document.getElementById("subredditKeywordList");
const clearSubredditSafeCache = document.getElementById("clearSubredditSafeCache");
const subredditSafeCacheList = document.getElementById("subredditSafeCacheList");
const aiLabModelInput = document.getElementById("aiLabModelInput");
const aiLabModelSelect = document.getElementById("aiLabModelSelect");
const aiLabAddModel = document.getElementById("aiLabAddModel");
const aiLabModelTags = document.getElementById("aiLabModelTags");
const aiLabPromptSelect = document.getElementById("aiLabPromptSelect");
const aiLabPromptDescription = document.getElementById("aiLabPromptDescription");
const aiLabUserInput = document.getElementById("aiLabUserInput");
const aiLabRun = document.getElementById("aiLabRun");
const aiLabChooseImage = document.getElementById("aiLabChooseImage");
const aiLabImageFileInput = document.getElementById("aiLabImageFileInput");
const aiLabPasteImage = document.getElementById("aiLabPasteImage");
const aiLabClearImage = document.getElementById("aiLabClearImage");
const aiLabImageDropzone = document.getElementById("aiLabImageDropzone");
const aiLabImagePreview = document.getElementById("aiLabImagePreview");
const aiLabImageEmpty = document.getElementById("aiLabImageEmpty");
const aiLabClearLogs = document.getElementById("aiLabClearLogs");
const aiLabOutput = document.getElementById("aiLabOutput");
const aiLabCurrentDetails = document.getElementById("aiLabCurrentDetails");
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

  renderUrlRules();
  renderSubredditGateRules();
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
  renderAiLabModelTags();
  renderAiLabPrompts();
}

function renderAiLabModelTags() {
  aiLabModelTags.textContent = "";

  for (const model of aiLabSettings.models) {
    const tag = document.createElement("span");
    tag.className = `model-tag${model === aiLabSettings.selectedModel ? " active" : ""}`;
    tag.innerHTML = `
      <span>${escapeHtml(model)}</span>
      <button type="button" aria-label="Remove ${escapeHtml(model)}" title="Remove model">×</button>
    `;
    tag.querySelector("button").addEventListener("click", async () => {
      const models = aiLabSettings.models.filter((entry) => entry !== model);
      const fallbackModels = models.length ? models : [...DEFAULT_AI_LAB_SETTINGS.models];
      const selectedModel = model === aiLabSettings.selectedModel ? fallbackModels[0] : aiLabSettings.selectedModel;

      await saveAiLabSettings({
        models: fallbackModels,
        selectedModel
      });
      renderAiLabSettings(aiLabSettings);
      setStatus("AI Lab model removed");
    });
    aiLabModelTags.append(tag);
  }
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
  const inputHint = selected?.inputType === "image" ? " Requires an attached image." : "";
  aiLabPromptDescription.textContent = `${selected?.description || ""}${inputHint}`;
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

function normalizeUrlRuleInput(value, mode) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  let url;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return "";
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "reddit.com") {
    return "";
  }

  let pathname = url.pathname || "/";
  pathname = pathname.replace(/\/{2,}/g, "/");
  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, "");
  }

  const base = `${host}${pathname}`;
  return mode === "exact" ? `${base}${url.search}` : base;
}

function renderUrlRules() {
  renderRuleTags(blockedUrlPrefixList, currentSettings.blockedUrlPrefixes, "blockedUrlPrefixes");
  renderRuleTags(blockedExactUrlList, currentSettings.blockedExactUrls, "blockedExactUrls");
}

function renderSubredditGateRules() {
  renderRuleTags(subredditAllowlist, currentSettings.subredditAllowlist, "subredditAllowlist");
  renderRuleTags(subredditBlocklist, currentSettings.subredditBlocklist, "subredditBlocklist");
  renderRuleTags(subredditKeywordList, currentSettings.subredditKeywords, "subredditKeywords");
  renderStaticTags(subredditSafeCacheList, subredditSafeCache);
}

function renderRuleTags(container, rules, key) {
  container.textContent = "";

  if (!Array.isArray(rules) || rules.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-rule-note";
    empty.textContent = "No rules added.";
    container.append(empty);
    return;
  }

  for (const rule of rules) {
    const tag = document.createElement("span");
    tag.className = "rule-tag";
    tag.innerHTML = `
      <span>${escapeHtml(rule)}</span>
      <button type="button" aria-label="Remove ${escapeHtml(rule)}" title="Remove rule">x</button>
    `;
    tag.querySelector("button").addEventListener("click", async () => {
      const nextRules = currentSettings[key].filter((entry) => entry !== rule);
      await saveSettings({
        ...currentSettings,
        [key]: nextRules
      });
      renderSettings(currentSettings);
    });
    container.append(tag);
  }
}

function renderStaticTags(container, rules) {
  container.textContent = "";

  if (!Array.isArray(rules) || rules.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-rule-note";
    empty.textContent = "No cached subreddits.";
    container.append(empty);
    return;
  }

  for (const rule of rules) {
    const tag = document.createElement("span");
    tag.className = "rule-tag";
    tag.innerHTML = `<span>${escapeHtml(rule)}</span>`;
    container.append(tag);
  }
}

function normalizeSubredditNameInput(value) {
  const tools = globalThis.redditContentFilterSlugTools;
  return tools?.splitSubredditSlug(value).normalizedName || "";
}

function normalizeKeywordInput(value) {
  return globalThis.redditContentFilterSlugTools?.normalizeText(value) || String(value || "").trim().toLowerCase();
}

async function addUrlRule(input, key, mode) {
  const normalized = normalizeUrlRuleInput(input.value, mode);

  if (!normalized) {
    setStatus("Enter a valid reddit.com URL");
    return;
  }

  const rules = Array.isArray(currentSettings[key]) ? currentSettings[key] : [];
  if (rules.includes(normalized)) {
    input.value = "";
    setStatus("URL rule already exists");
    return;
  }

  await saveSettings({
    ...currentSettings,
    [key]: [...rules, normalized]
  });
  input.value = "";
  renderSettings(currentSettings);
  setStatus("URL rule added");
}

async function addSubredditRule(input, key, normalizer = normalizeSubredditNameInput) {
  const normalized = normalizer(input.value);

  if (!normalized) {
    setStatus("Enter a valid value");
    return;
  }

  const rules = Array.isArray(currentSettings[key]) ? currentSettings[key] : [];
  if (rules.includes(normalized)) {
    input.value = "";
    setStatus("Rule already exists");
    return;
  }

  await saveSettings({
    ...currentSettings,
    [key]: [...rules, normalized]
  });
  input.value = "";
  renderSettings(currentSettings);
  setStatus("Subreddit gate rule added");
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
  aiLabChooseImage.disabled = !extensionEnabled;
  aiLabPasteImage.disabled = !extensionEnabled;
  aiLabImageFileInput.disabled = !extensionEnabled;
  aiLabClearImage.disabled = !extensionEnabled || !aiLabImageInput;
  blockedUrlPrefixInput.disabled = !extensionEnabled;
  addBlockedUrlPrefix.disabled = !extensionEnabled;
  blockedExactUrlInput.disabled = !extensionEnabled;
  addBlockedExactUrl.disabled = !extensionEnabled;
  subredditAllowlistInput.disabled = !extensionEnabled || !currentSettings.subredditGateEnabled;
  addSubredditAllowlist.disabled = !extensionEnabled || !currentSettings.subredditGateEnabled;
  subredditBlocklistInput.disabled = !extensionEnabled || !currentSettings.subredditGateEnabled;
  addSubredditBlocklist.disabled = !extensionEnabled || !currentSettings.subredditGateEnabled;
  subredditKeywordInput.disabled = !extensionEnabled || !currentSettings.subredditGateEnabled;
  addSubredditKeyword.disabled = !extensionEnabled || !currentSettings.subredditGateEnabled;
  clearSubredditSafeCache.disabled = !extensionEnabled || !currentSettings.subredditGateEnabled;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("File read failed")));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("Text file read failed")));
    reader.readAsText(file);
  });
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 bytes";
  }

  const units = ["bytes", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function isTextLikeFile(file) {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const textExtensions = [
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".jsonl",
    ".csv",
    ".tsv",
    ".xml",
    ".html",
    ".htm",
    ".css",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".py",
    ".rb",
    ".php",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".go",
    ".rs",
    ".sh",
    ".bat",
    ".ps1",
    ".yaml",
    ".yml",
    ".ini",
    ".toml",
    ".env",
    ".log",
    ".svg"
  ];

  return (
    type.startsWith("text/") ||
    type.includes("json") ||
    type.includes("xml") ||
    type.includes("javascript") ||
    type.includes("csv") ||
    type.includes("yaml") ||
    textExtensions.some((extension) => name.endsWith(extension))
  );
}

function isImageLikeFile(file) {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif", ".svg"];

  return type.startsWith("image/") || imageExtensions.some((extension) => name.endsWith(extension));
}

function getAiLabAttachmentLabel() {
  if (!aiLabImageInput) {
    return "";
  }

  const readable = aiLabImageInput.isImage ? "image" : aiLabImageInput.isText ? "text" : "binary";
  return `${aiLabImageInput.name} | ${aiLabImageInput.type} | ${formatBytes(aiLabImageInput.size)} | ${readable}`;
}

function getAiLabFileLogFields() {
  return {
    fileAttached: Boolean(aiLabImageInput),
    fileName: aiLabImageInput?.name || "",
    fileType: aiLabImageInput?.type || "",
    fileSize: aiLabImageInput?.size || 0,
    fileReadableText: Boolean(aiLabImageInput?.isText),
    imageAttached: Boolean(aiLabImageInput?.isImage),
    imageType: aiLabImageInput?.isImage ? aiLabImageInput.type : "",
    imageSize: aiLabImageInput?.isImage ? aiLabImageInput.size : 0
  };
}

function showAiLabValidationError(message) {
  const promptPath = aiLabPromptSelect.value;
  const promptMeta = aiLabPrompts.find((prompt) => prompt.path === promptPath);
  const log = {
    id: `validation-${Date.now()}`,
    timestamp: Date.now(),
    model: aiLabModelSelect.value || "Not selected",
    promptPath,
    promptLabel: promptMeta?.label || promptPath || "Not selected",
    userInput: aiLabUserInput.value.trim(),
    inputPreview: aiLabUserInput.value.trim().slice(0, 80) || aiLabImageInput?.name || "Validation failed",
    latencyMs: 0,
    usage: {},
    cost: null,
    responseId: "",
    rawOutput: "",
    error: message,
    ...getAiLabFileLogFields()
  };

  aiLabOutput.textContent = message;
  renderAiLabCurrentRun(log);
  setStatus(message);
}

function renderAiLabImageInput() {
  const hasAttachment = Boolean(aiLabImageInput);
  const hasImage = Boolean(aiLabImageInput?.isImage && aiLabImageInput?.dataUrl);
  aiLabImagePreview.hidden = !hasImage;
  aiLabImageEmpty.hidden = hasImage;
  aiLabClearImage.disabled = !currentSettings.enabled || !hasAttachment;

  if (!hasAttachment) {
    aiLabImagePreview.removeAttribute("src");
    aiLabImageEmpty.className = "";
    aiLabImageEmpty.textContent = "No file attached. Drop a file here or choose one.";
    return;
  }

  if (hasImage) {
    aiLabImagePreview.src = aiLabImageInput.dataUrl;
    aiLabImageEmpty.className = "";
    aiLabImageEmpty.textContent = "";
    return;
  }

  aiLabImagePreview.removeAttribute("src");
  aiLabImageEmpty.hidden = false;
  aiLabImageEmpty.className = "lab-file-summary";
  aiLabImageEmpty.innerHTML = "";

  const name = document.createElement("strong");
  name.textContent = aiLabImageInput.name;
  const meta = document.createElement("small");
  meta.textContent = `${aiLabImageInput.type} | ${formatBytes(aiLabImageInput.size)}`;
  const mode = document.createElement("small");
  mode.textContent = aiLabImageInput.isText
    ? `Readable text attached${aiLabImageInput.truncated ? `, first ${MAX_AI_LAB_TEXT_FILE_CHARS.toLocaleString()} characters included` : ""}.`
    : "Binary file attached as metadata. No readable text content was extracted.";

  aiLabImageEmpty.append(name, meta, mode);
}

async function setAiLabImageFromFile(file) {
  if (!file) {
    setStatus("No file selected");
    return;
  }

  const type = file.type || "application/octet-stream";
  const isImage = isImageLikeFile(file);
  const isText = !isImage && isTextLikeFile(file);
  let text = "";
  let truncated = false;

  if (isText) {
    text = await readFileAsText(file);
    truncated = text.length > MAX_AI_LAB_TEXT_FILE_CHARS;
    text = text.slice(0, MAX_AI_LAB_TEXT_FILE_CHARS);
  }

  aiLabImageInput = {
    dataUrl: isImage ? await readFileAsDataUrl(file) : "",
    isImage,
    isText,
    name: file.name || (isImage ? "clipboard image" : "attached file"),
    size: file.size,
    text,
    truncated,
    type
  };
  renderAiLabImageInput();

  const promptMeta = aiLabPrompts.find((prompt) => prompt.path === aiLabPromptSelect.value);

  if (promptMeta?.inputType === "image" && !isImage) {
    showAiLabValidationError(`Attached ${type} file, but "${promptMeta.label}" requires an image file.`);
    return;
  }

  setStatus(`AI Lab file attached: ${getAiLabAttachmentLabel()}`);
}

async function chooseAiLabImageFromFilePicker() {
  aiLabImageFileInput.click();
}

async function pasteAiLabImageFromClipboard() {
  if (!navigator.clipboard?.read) {
    setStatus("Clipboard image read is not available in this browser");
    return;
  }

  try {
    const items = await navigator.clipboard.read();

    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith("image/"));

      if (imageType) {
        const blob = await item.getType(imageType);
        await setAiLabImageFromFile(blob);
        return;
      }
    }

    setStatus("Clipboard does not contain an image");
  } catch (error) {
    setStatus(`Clipboard image paste failed: ${error.message || error}`);
  }
}

function clearAiLabImageInput() {
  aiLabImageInput = null;
  renderAiLabImageInput();
  setStatus("AI Lab file cleared");
}

function buildAiLabUserMessage(userInput, promptMeta) {
  if (!aiLabImageInput) {
    return { role: "user", content: userInput };
  }

  const fallbackText = promptMeta?.inputType === "image" ? "Classify the attached screenshot." : "";
  const baseText = userInput || promptMeta?.defaultUserInput || fallbackText || "Review the attached file.";

  if (!aiLabImageInput.isImage || !aiLabImageInput.dataUrl) {
    const fileText = [
      baseText,
      "",
      "Attached file metadata:",
      `Name: ${aiLabImageInput.name}`,
      `Type: ${aiLabImageInput.type}`,
      `Size: ${aiLabImageInput.size} bytes`
    ];

    if (aiLabImageInput.isText) {
      fileText.push(
        `Text content${aiLabImageInput.truncated ? ` (truncated to ${MAX_AI_LAB_TEXT_FILE_CHARS} characters)` : ""}:`,
        aiLabImageInput.text || "[empty file]"
      );
    } else {
      fileText.push("No readable text content was extracted from this binary file.");
    }

    return { role: "user", content: fileText.join("\n") };
  }

  return {
    role: "user",
    content: [
      {
        type: "text",
        text: baseText
      },
      {
        type: "image_url",
        image_url: {
          url: aiLabImageInput.dataUrl
        }
      }
    ]
  };
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

function getLogTitle(log) {
  if (log?.kind === "subredditGate") {
    return log.normalizedSubreddit || log.subredditSlug || "Untitled subreddit";
  }

  return log?.normalizedQuery || log?.query || "Untitled query";
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
        <strong>${escapeHtml(getLogTitle(log))}</strong>
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

function renderAiLabCurrentRun(log) {
  aiLabCurrentDetails.textContent = "";

  if (!log) {
    aiLabCurrentDetails.append(detailCard("Decision", "No lab run yet", "", false));
    return;
  }

  aiLabCurrentDetails.append(
    detailCard("Status", log.error ? "Error" : "Run complete", ""),
    detailCard("Latency", formatLatency(log.latencyMs), ""),
    detailCard("Model", log.model || "Not recorded", ""),
    detailCard("File", log.fileAttached || log.imageAttached ? "Attached" : "None", log.fileType || log.imageType || ""),
    detailCard("Tokens", summarizeUsage(log.usage), ""),
    detailCard("Cost", formatCost(log.cost), ""),
    detailCard("Timestamp", formatDate(log.timestamp), "")
  );
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
    detailCard("File input", log.fileAttached || log.imageAttached ? "Attached" : "None", log.fileName ? `${log.fileName} | ${log.fileType || "unknown"} | ${formatBytes(log.fileSize || 0)}` : log.imageType || ""),
    detailCard("Timestamp", formatDate(log.timestamp), ""),
    detailCard("User input", log.userInput || "Not recorded", "", true),
    detailCard("Raw output", log.rawOutput || log.error || "Not recorded", "", true)
  ];

  aiLabLogDetails.append(...cards);
}

function buildLogSummary(log) {
  if (log?.kind === "subredditGate") {
    const source = log.decisionSource || "subreddit gate";
    const match = log.matchedKeyword ? ` | ${log.matchedKeyword}` : "";
    return `${getDecision(log)} | ${source}${match} | ${formatLatency(log.roundTripMs)} | ${formatDate(log.timestamp)}`;
  }

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

  if (log.kind === "subredditGate") {
    const cards = [
      detailCard("Decision", getDecision(log), ""),
      detailCard("Subreddit", log.normalizedSubreddit || log.subredditSlug || "Not recorded", log.subredditSlug ? `Original: ${log.subredditSlug}` : ""),
      detailCard("Decision source", log.decisionSource || "Not recorded", log.cacheStatus || ""),
      detailCard("Round-trip", formatLatency(log.roundTripMs), "Total gate timing."),
      detailCard("Overlay visible", formatLatency(log.overlayVisibleMs), "How long the page gate stayed on screen."),
      detailCard("Slug split mode", log.splitMode || "Not recorded", ""),
      detailCard("Slug terms", Array.isArray(log.splitTerms) && log.splitTerms.length ? log.splitTerms.join("\n") : "No terms recorded.", "", true),
      detailCard("Matched keyword", log.matchedKeyword || "No keyword match", log.matchedTextSource || ""),
      detailCard("Matched text", log.matchedText || "No matched text recorded.", "", true)
    ];

    if (log.failureReason) {
      cards.splice(1, 0, detailCard("Failure", log.failureReason, "", true));
    }

    logDetails.append(...cards);
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
  if (log?.kind === "subredditGate") {
    return log.matchedKeyword ? `${log.matchedTextSource || "Match"}: ${log.matchedKeyword}` : "No match details recorded.";
  }

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

function renderSubredditSlugExperiment() {
  const tools = globalThis.redditContentFilterSlugTools;
  const result = tools?.splitSubredditSlug(subredditSlugInput.value);

  subredditSlugOutput.textContent = "";

  if (!tools || !result) {
    subredditSlugOutput.append(detailCard("Status", "Slug splitter is not loaded", "", true));
    return;
  }

  subredditSlugOutput.append(
    detailCard("Extracted slug", result.slug || "Not detected", ""),
    detailCard("Normalized name", result.normalizedName || "Not detected", ""),
    detailCard("Mode", result.splitMode, result.splitMode === "split" ? "Uppercase, number, or underscore split path." : "Whole lowercase slug path."),
    detailCard("Split terms", result.terms.length ? result.terms.join("\n") : "No terms", "", true),
    detailCard("JSON", JSON.stringify(result, null, 2), "", true)
  );
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
  renderAiLabCurrentRun(log);
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
    showAiLabValidationError("OpenRouter API key is required in AI Gate");
    return;
  }

  if (!model || !promptPath) {
    showAiLabValidationError("AI Lab requires a model and prompt");
    return;
  }

  if (promptMeta?.inputType === "image" && !aiLabImageInput?.isImage) {
    const attachedType = aiLabImageInput?.type ? ` Attached file type: ${aiLabImageInput.type}.` : "";
    showAiLabValidationError(`Selected prompt requires an attached image file.${attachedType}`);
    return;
  }

  if (!userInput && !aiLabImageInput) {
    showAiLabValidationError("AI Lab requires user input or an attached file");
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
    inputPreview: userInput.slice(0, 80) || (aiLabImageInput ? aiLabImageInput.name : ""),
    ...getAiLabFileLogFields(),
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
          buildAiLabUserMessage(userInput, promptMeta)
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

async function clearSubredditCache() {
  subredditSafeCache = [];
  await chrome.storage.local.set({ [SUBREDDIT_SAFE_CACHE_KEY]: [] });
  renderSubredditGateRules();
  setStatus("Subreddit safe cache cleared");
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
    chrome.storage.local.get([LOCAL_AI_SETTINGS_KEY, AI_LOGS_KEY, AI_LAB_SETTINGS_KEY, AI_LAB_LOGS_KEY, SUBREDDIT_SAFE_CACHE_KEY])
  ]);

  subredditSafeCache = Array.isArray(localResult[SUBREDDIT_SAFE_CACHE_KEY]) ? localResult[SUBREDDIT_SAFE_CACHE_KEY] : [];
  renderSettings(syncResult[SETTINGS_KEY]);
  renderAiSettings(localResult[LOCAL_AI_SETTINGS_KEY]);
  renderAiLabSettings(localResult[AI_LAB_SETTINGS_KEY]);
  runtimeLogs = Array.isArray(localResult[AI_LOGS_KEY]) ? localResult[AI_LOGS_KEY] : [];
  aiLabLogs = Array.isArray(localResult[AI_LAB_LOGS_KEY]) ? localResult[AI_LAB_LOGS_KEY] : [];
  renderLogs();
  renderAiLabLogs();
  renderAiLabCurrentRun(aiLabLogs[0]);
  renderAiLabImageInput();
  if (aiLabLogs[0]) {
    aiLabOutput.textContent = aiLabLogs[0].rawOutput || aiLabLogs[0].error || "No output recorded.";
  }

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
  addSubredditAllowlist.addEventListener("click", () => {
    addSubredditRule(subredditAllowlistInput, "subredditAllowlist");
  });
  subredditAllowlistInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSubredditRule(subredditAllowlistInput, "subredditAllowlist");
    }
  });
  addSubredditBlocklist.addEventListener("click", () => {
    addSubredditRule(subredditBlocklistInput, "subredditBlocklist");
  });
  subredditBlocklistInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSubredditRule(subredditBlocklistInput, "subredditBlocklist");
    }
  });
  addSubredditKeyword.addEventListener("click", () => {
    addSubredditRule(subredditKeywordInput, "subredditKeywords", normalizeKeywordInput);
  });
  subredditKeywordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSubredditRule(subredditKeywordInput, "subredditKeywords", normalizeKeywordInput);
    }
  });
  clearSubredditSafeCache.addEventListener("click", clearSubredditCache);
  runSubredditSlugExperiment.addEventListener("click", renderSubredditSlugExperiment);
  subredditSlugInput.addEventListener("input", renderSubredditSlugExperiment);
  addBlockedUrlPrefix.addEventListener("click", () => {
    addUrlRule(blockedUrlPrefixInput, "blockedUrlPrefixes", "prefix");
  });
  blockedUrlPrefixInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addUrlRule(blockedUrlPrefixInput, "blockedUrlPrefixes", "prefix");
    }
  });
  addBlockedExactUrl.addEventListener("click", () => {
    addUrlRule(blockedExactUrlInput, "blockedExactUrls", "exact");
  });
  blockedExactUrlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addUrlRule(blockedExactUrlInput, "blockedExactUrls", "exact");
    }
  });
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
  aiLabModelSelect.addEventListener("change", async () => {
    await saveAiLabSettings({ selectedModel: aiLabModelSelect.value });
    renderAiLabModelTags();
  });
  aiLabPromptSelect.addEventListener("change", async () => {
    updateAiLabPromptDescription();
    await saveAiLabSettings({ selectedPromptPath: aiLabPromptSelect.value });
  });
  aiLabUserInput.addEventListener("input", () => {
    saveAiLabSettings({ userInput: aiLabUserInput.value });
  });
  aiLabPasteImage.addEventListener("click", pasteAiLabImageFromClipboard);
  aiLabChooseImage.addEventListener("click", chooseAiLabImageFromFilePicker);
  aiLabImageFileInput.addEventListener("change", async () => {
    const file = aiLabImageFileInput.files?.[0];

    if (file) {
      await setAiLabImageFromFile(file);
    }

    aiLabImageFileInput.value = "";
  });
  aiLabClearImage.addEventListener("click", clearAiLabImageInput);
  aiLabImageDropzone.addEventListener("click", chooseAiLabImageFromFilePicker);
  aiLabImageDropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseAiLabImageFromFilePicker();
    }
  });
  aiLabImageDropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    aiLabImageDropzone.classList.add("drag-over");
  });
  aiLabImageDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    aiLabImageDropzone.classList.add("drag-over");
  });
  aiLabImageDropzone.addEventListener("dragleave", (event) => {
    if (!aiLabImageDropzone.contains(event.relatedTarget)) {
      aiLabImageDropzone.classList.remove("drag-over");
    }
  });
  aiLabImageDropzone.addEventListener("drop", async (event) => {
    event.preventDefault();
    aiLabImageDropzone.classList.remove("drag-over");

    const file = Array.from(event.dataTransfer?.files || [])[0];

    if (!file) {
      setStatus("Drop did not include a file");
      return;
    }

    await setAiLabImageFromFile(file);
  });
  aiLabImageDropzone.addEventListener("paste", async (event) => {
    const file = Array.from(event.clipboardData?.files || [])[0];

    if (file) {
      event.preventDefault();
      await setAiLabImageFromFile(file);
    }
  });
  aiLabRun.addEventListener("click", runAiLabRequest);
  aiLabClearLogs.addEventListener("click", clearAiLabLogs);
  document.getElementById("clearCache").addEventListener("click", clearCache);
  document.getElementById("clearLogs").addEventListener("click", clearLogs);
  document.getElementById("removeLog").addEventListener("click", removeSelectedLog);
  document.getElementById("downloadLogs").addEventListener("click", downloadLogs);
  renderSubredditSlugExperiment();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[AI_LOGS_KEY]) {
      runtimeLogs = Array.isArray(changes[AI_LOGS_KEY].newValue) ? changes[AI_LOGS_KEY].newValue : [];
      renderLogs();
    }

    if (areaName === "local" && changes[AI_LAB_LOGS_KEY]) {
      aiLabLogs = Array.isArray(changes[AI_LAB_LOGS_KEY].newValue) ? changes[AI_LAB_LOGS_KEY].newValue : [];
      renderAiLabLogs();
    }

    if (areaName === "local" && changes[SUBREDDIT_SAFE_CACHE_KEY]) {
      subredditSafeCache = Array.isArray(changes[SUBREDDIT_SAFE_CACHE_KEY].newValue) ? changes[SUBREDDIT_SAFE_CACHE_KEY].newValue : [];
      renderSubredditGateRules();
    }
  });

  setStatus("Settings loaded");
}

init().catch((error) => {
  setStatus(error.message || String(error));
});
