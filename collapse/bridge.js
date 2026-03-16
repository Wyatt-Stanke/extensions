(function () {
    "use strict";

    // Bridge between MAIN world content script (postMessage) and background (chrome.runtime)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "GET_VIDEO_INFO") {
            window.postMessage({ type: "COLLAPSE_GET_VIDEO_INFO" }, "*");

            const handler = (event) => {
                if (event.data?.type === "COLLAPSE_VIDEO_INFO") {
                    window.removeEventListener("message", handler);
                    sendResponse({ data: event.data.data });
                }
            };
            window.addEventListener("message", handler);

            // Timeout after 3 seconds if content script doesn't respond
            setTimeout(() => {
                window.removeEventListener("message", handler);
                sendResponse({ data: null });
            }, 3000);

            return true; // keep sendResponse channel open
        }
    });

    console.log("[Collapse] Bridge script initialized");
})();
