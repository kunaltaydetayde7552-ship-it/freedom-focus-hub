// Freedom Focus Guard - Background Service Worker (Manifest V3)

const DEFAULT_SERVER = "https://freedom-focus-hub.onrender.com";
let currentServer = DEFAULT_SERVER;
let activeSession = null;
let currentBlocklist = [];
let isLockedMode = false;

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Freedom Ext] Installed successfully.");
  chrome.storage.local.get(["serverUrl"], (res) => {
    if (res.serverUrl) currentServer = res.serverUrl;
    syncSession();
  });

  // Alarm for periodic sync (every 0.2 minutes / 12 seconds)
  chrome.alarms.create("freedom_sync_alarm", { periodInMinutes: 0.2 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "freedom_sync_alarm") {
    syncSession();
  }
});

// Sync active session from Freedom Hub
async function syncSession() {
  try {
    const res = await fetch(`${currentServer}/api/session/active`);
    const data = await res.json();

    if (data.active) {
      activeSession = data.session;
      currentBlocklist = data.blocklist?.domains || [];
      isLockedMode = Boolean(data.session.locked_mode);

      await chrome.storage.local.set({
        sessionActive: true,
        sessionName: data.session.name,
        remainingSeconds: data.remaining_seconds,
        lockedMode: isLockedMode,
        blockedDomains: currentBlocklist,
      });

      applyDeclarativeRules(currentBlocklist);
      scanOpenTabs(currentBlocklist);
    } else {
      activeSession = null;
      currentBlocklist = [];
      isLockedMode = false;

      await chrome.storage.local.set({
        sessionActive: false,
        lockedMode: false,
        blockedDomains: [],
      });

      clearDeclarativeRules();
    }
  } catch (err) {
    console.warn("[Freedom Ext] Sync error:", err.message);
  }
}

// Intercept navigations via webNavigation for instant green-screen redirect
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return; // Main frame only

  // 1. Anti-Tamper: Prevent opening chrome://extensions if Locked Mode is active
  if (isLockedMode && details.url.startsWith("chrome://extensions")) {
    chrome.tabs.update(details.tabId, {
      url: `${currentServer}/blocked.html?site=Extensions%20Management%20(Locked%20Mode)`,
    });
    return;
  }

  // 2. Intercept Blocked Domains
  if (currentBlocklist.length > 0) {
    try {
      const urlObj = new URL(details.url);
      const host = urlObj.hostname.toLowerCase();

      for (const domain of currentBlocklist) {
        const cleanDomain = domain.toLowerCase().trim();
        if (host === cleanDomain || host.endsWith("." + cleanDomain)) {
          console.log(`[Freedom Ext] Intercepting ${details.url} -> Redirecting to Green Screen`);
          chrome.tabs.update(details.tabId, {
            url: `${currentServer}/blocked.html?site=${encodeURIComponent(cleanDomain)}`,
          });
          break;
        }
      }
    } catch (e) {}
  }
});

// Scan currently open tabs and redirect if any blocked domain is running
function scanOpenTabs(domains) {
  if (!domains || domains.length === 0) return;
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tab.url) continue;
      try {
        const urlObj = new URL(tab.url);
        const host = urlObj.hostname.toLowerCase();
        for (const domain of domains) {
          const cleanDomain = domain.toLowerCase().trim();
          if (host === cleanDomain || host.endsWith("." + cleanDomain)) {
            chrome.tabs.update(tab.id, {
              url: `${currentServer}/blocked.html?site=${encodeURIComponent(cleanDomain)}`,
            });
            break;
          }
        }
      } catch (e) {}
    }
  });
}

// declarativeNetRequest dynamic rules
async function applyDeclarativeRules(domains) {
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = oldRules.map(r => r.id);

  const addRules = [];
  let id = 1;

  for (const domain of domains) {
    const cleanDomain = domain.toLowerCase().trim();
    if (!cleanDomain) continue;

    addRules.push({
      id: id++,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          url: `${currentServer}/blocked.html?site=${encodeURIComponent(cleanDomain)}`
        }
      },
      condition: {
        urlFilter: `*://${cleanDomain}/*`,
        resourceTypes: ["main_frame"]
      }
    });

    addRules.push({
      id: id++,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          url: `${currentServer}/blocked.html?site=${encodeURIComponent(cleanDomain)}`
        }
      },
      condition: {
        urlFilter: `*://*.${cleanDomain}/*`,
        resourceTypes: ["main_frame"]
      }
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
  console.log(`[Freedom Ext] Updated ${addRules.length} dynamic blocking rules.`);
}

async function clearDeclarativeRules() {
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = oldRules.map(r => r.id);
  if (removeRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
  }
}

// Message handler from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TRIGGER_SYNC") {
    syncSession().then(() => sendResponse({ success: true }));
    return true;
  }
});
