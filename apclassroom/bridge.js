(function () {
  "use strict";

  let currentState = {
    initialized: false,
    videoId: null,
    blocking: [],
  };

  // Listen for state updates from the MAIN world content script
  window.addEventListener("message", (event) => {
    if (event.data?.type === "AP_TOOLS_STATE") {
      currentState = event.data.state;

      // Send to background script for badge update
      chrome.runtime
        .sendMessage({
          type: "STATE_UPDATE",
          state: currentState,
        })
        .catch(() => {
          // Background might not be ready yet
        });
    }
  });

  // Listen for state requests from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_STATE") {
      // Request fresh state from content script
      window.postMessage({ type: "AP_TOOLS_GET_STATE" }, "*");

      // Return current cached state immediately
      sendResponse({ state: currentState });
    }
    return true;
  });

  // Request initial state
  setTimeout(() => {
    window.postMessage({ type: "AP_TOOLS_GET_STATE" }, "*");
  }, 100);

  console.log("[AP Tools] Bridge script initialized");
})();
