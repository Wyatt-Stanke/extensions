chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STATE_UPDATE") {
    const state = message.state;
    const tabId = sender.tab?.id;

    if (!tabId) return;

    let badgeText = "";
    let badgeColor = "#888888";

    if (!state.initialized) {
      badgeText = "";
      badgeColor = "#888888";
    } else if (state.blocking) {
      badgeText = "🔒";
      badgeColor = "#f44336";
    } else if (state.videoId) {
      badgeText = "✓";
      badgeColor = "#4CAF50";
    } else {
      badgeText = "...";
      badgeColor = "#888888";
    }

    chrome.action.setBadgeText({ text: badgeText, tabId });
    chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
  }
});

// Clear badge when tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    chrome.action.setBadgeText({ text: "", tabId });
  }
});

console.log("[AP Tools] Background service worker initialized");
