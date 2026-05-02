const SETTINGS_KEY = "redditContentFilterSettings";
const DEFAULT_SETTINGS = {
  enabled: true,
  hideGamesOnReddit: true,
  hideLeftRecent: true,
  hideHomepageContent: true,
  hideSearchCommunities: true,
  hideSearchProfiles: true
};

const controls = Object.fromEntries(
  Object.keys(DEFAULT_SETTINGS).map((key) => [key, document.getElementById(key)])
);
const status = document.getElementById("status");

function readControls() {
  return Object.fromEntries(
    Object.entries(controls).map(([key, control]) => [key, control.checked])
  );
}

function render(settings) {
  for (const [key, value] of Object.entries(settings)) {
    controls[key].checked = value;
  }

  updateDisabledState();
}

async function save() {
  updateDisabledState();
  status.textContent = "Saving...";
  const settings = readControls();

  await chrome.storage.sync.set({
    [SETTINGS_KEY]: settings
  });
  await notifyRedditTabs(settings);

  status.textContent = "Settings saved";
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
  const extensionEnabled = controls.enabled.checked;

  for (const [key, control] of Object.entries(controls)) {
    if (key !== "enabled") {
      control.disabled = !extensionEnabled;
    }
  }
}

async function init() {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  render({
    ...DEFAULT_SETTINGS,
    ...result[SETTINGS_KEY]
  });

  for (const control of Object.values(controls)) {
    control.addEventListener("change", save);
  }
}

init();
