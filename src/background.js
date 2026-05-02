const LOCAL_AI_SETTINGS_KEY = "redditContentFilterAiSettings";
const PROMPT_PATH = "prompts/search-review-default.md";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_AI_SETTINGS = {
  openRouterApiKey: "",
  openRouterModel: "google/gemini-2.5-flash-lite"
};

chrome.runtime.onInstalled.addListener(() => {});

function now() {
  return performance.now();
}

function buildOpenRouterHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://www.reddit.com",
    "X-OpenRouter-Title": "Personal Reddit Content Filter"
  };
}

async function getPrompt() {
  const response = await fetch(chrome.runtime.getURL(PROMPT_PATH));

  if (!response.ok) {
    throw new Error(`Prompt fetch failed: ${response.status}`);
  }

  return response.text();
}

async function getAiSettings() {
  const result = await chrome.storage.local.get(LOCAL_AI_SETTINGS_KEY);
  return {
    ...DEFAULT_AI_SETTINGS,
    ...result[LOCAL_AI_SETTINGS_KEY]
  };
}

async function classifySearchQuery(normalizedQuery) {
  const settings = await getAiSettings();

  if (!settings.openRouterApiKey) {
    throw new Error("OpenRouter API key is missing");
  }

  const prompt = await getPrompt();
  const startedAt = now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: buildOpenRouterHeaders(settings.openRouterApiKey),
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.openRouterModel,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: normalizedQuery }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      })
    });

    const responseText = await response.text();
    const latencyMs = Math.round(now() - startedAt);

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status} ${responseText.slice(0, 180)}`);
    }

    const data = JSON.parse(responseText);
    return {
      latencyMs,
      model: data.model || settings.openRouterModel,
      id: data.id || "",
      usage: data.usage || {},
      content: data.choices?.[0]?.message?.content || "",
      provider: "OpenRouter"
    };
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "redditContentFilter:classifySearchQuery") {
    return false;
  }

  classifySearchQuery(message.normalizedQuery)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));

  return true;
});
