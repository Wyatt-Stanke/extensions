(function () {
  "use strict";

  let state = {
    videoId: null,
    duration: null,
    blocking: false,
    capturedHeaders: {},
    capturedBody: null,
    initialized: true,
  };

  // Send state updates to the bridge script
  function broadcastState() {
    window.postMessage(
      {
        type: "AP_TOOLS_STATE",
        state: {
          initialized: state.initialized,
          videoId: state.videoId,
          blocking: state.blocking,
        },
      },
      "*",
    );
  }

  // Listen for state requests from bridge
  window.addEventListener("message", (event) => {
    if (event.data?.type === "AP_TOOLS_GET_STATE") {
      broadcastState();
    }
  });

  // Intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = url;
    this._method = method;
    this._headers = {};
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this._headers) {
      this._headers[name] = value;
    }
    return originalSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (
      this._url &&
      this._url.includes("/videos/") &&
      this._url.includes("/progress")
    ) {
      const match = this._url.match(/\/videos\/(\d+)\/progress/);

      if (state.blocking) {
        console.log(
          "[AP Tools] Blocked progress request for video:",
          match?.[1],
        );
        Object.defineProperty(this, "status", { value: 200 });
        Object.defineProperty(this, "readyState", { value: 4 });
        Object.defineProperty(this, "responseText", { value: "{}" });
        setTimeout(() => {
          this.onreadystatechange?.();
          this.onload?.();
        }, 10);
        return;
      }

      if (match) {
        state.capturedHeaders = { ...this._headers };
        try {
          state.capturedBody = JSON.parse(body);
        } catch (e) {
          state.capturedBody = body;
        }
        console.log("[AP Tools] Captured headers:", state.capturedHeaders);
        console.log("[AP Tools] Captured body structure:", state.capturedBody);

        if (!state.videoId) {
          state.videoId = match[1];
          console.log("[AP Tools] Found video ID:", state.videoId);
          updateButton();
          broadcastState();
        }
      }
    }
    return originalSend.call(this, body);
  };

  // Create and manage the button
  let button = null;

  function createButton() {
    if (document.getElementById("ap-tools-btn")) return;

    button = document.createElement("button");
    button.id = "ap-tools-btn";
    button.innerHTML = "⏸ Start playing a video...";
    button.style.cssText = `
            position: fixed;
            top: 15px;
            right: 15px;
            z-index: 999999;
            padding: 12px 18px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            cursor: not-allowed;
            background: #888;
            color: #ccc;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
    button.disabled = true;
    button.onclick = handleClick;
    document.body.appendChild(button);
  }

  function updateButton() {
    if (!button) {
      button = document.getElementById("ap-tools-btn");
    }
    if (!button) return;

    if (state.blocking) {
      button.innerHTML = "🔒 Blocking - Click to Reset";
      button.style.background = "#f44336";
      button.style.color = "white";
      button.style.cursor = "pointer";
      button.disabled = false;
    } else if (state.videoId) {
      button.innerHTML = "✓ Mark Complete";
      button.style.background = "#4CAF50";
      button.style.color = "white";
      button.style.cursor = "pointer";
      button.disabled = false;
    } else {
      button.innerHTML = "⏸ Start playing a video...";
      button.style.background = "#888";
      button.style.color = "#ccc";
      button.style.cursor = "not-allowed";
      button.disabled = true;
    }
  }

  function getVideoDuration() {
    // Check main document first
    const video = document.querySelector("video");
    if (video && video.duration && !isNaN(video.duration)) {
      return Math.ceil(video.duration);
    }

    // Check inside iframes (e.g. Wistia player)
    try {
      const iframes = document.querySelectorAll("iframe, wistia-player iframe");
      for (const iframe of iframes) {
        try {
          const iframeVideo = iframe.contentDocument?.querySelector("video");
          if (iframeVideo && iframeVideo.duration && !isNaN(iframeVideo.duration)) {
            return Math.ceil(iframeVideo.duration);
          }
        } catch (e) {
          // Cross-origin iframe, skip
        }
      }
    } catch (e) {
      console.log("[AP Tools] Error searching iframes for video:", e);
    }

    // Check shadow DOMs (wistia-player is a custom element)
    try {
      const wistiaPlayers = document.querySelectorAll("wistia-player");
      for (const player of wistiaPlayers) {
        const shadowVideo = player.shadowRoot?.querySelector("video");
        if (shadowVideo && shadowVideo.duration && !isNaN(shadowVideo.duration)) {
          return Math.ceil(shadowVideo.duration);
        }
      }
    } catch (e) {
      console.log("[AP Tools] Error searching shadow DOM for video:", e);
    }

    return null;
  }

  async function handleClick() {
    if (state.blocking) {
      state.blocking = false;
      state.videoId = null;
      state.duration = null;
      state.capturedHeaders = {};
      state.capturedBody = null;
      console.log("[AP Tools] Reset - now searching for new video");
      updateButton();
      broadcastState();
      return;
    }

    if (!state.videoId) return;

    const duration = getVideoDuration();
    if (!duration) {
      alert("Could not get video duration. Make sure the video is loaded.");
      return;
    }

    const watchedSeconds = Array.from(
      { length: duration },
      () => Math.floor(Math.random() * 2) + 1,
    );

    const requestBody = {
      ...(state.capturedBody || {}),
      watched_seconds: watchedSeconds,
      playhead_position: "1.0000",
    };

    const url = `https://apc-api-production.collegeboard.org/fym/common/videos/${state.videoId}/progress/`;

    const headers = new Headers();

    for (const [name, value] of Object.entries(state.capturedHeaders)) {
      const skipHeaders = [
        "content-length",
        "host",
        "connection",
        "origin",
        "referer",
      ];
      if (!skipHeaders.includes(name.toLowerCase())) {
        try {
          headers.set(name, value);
        } catch (e) {
          console.log("[AP Tools] Could not set header:", name, e);
        }
      }
    }

    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    console.log(
      "[AP Tools] Sending request with headers:",
      Object.fromEntries(headers.entries()),
    );
    console.log("[AP Tools] Request body:", requestBody);

    try {
      button.innerHTML = "⏳ Sending...";
      button.disabled = true;

      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        console.log(
          "[AP Tools] Successfully marked video",
          state.videoId,
          "as complete",
        );
        state.blocking = true;
        updateButton();
        broadcastState();
        const closeBtn = document.querySelector(
          '[data-test-id="modal-close-button"]',
        );
        if (closeBtn) {
          closeBtn.click();
          console.log("[AP Tools] Clicked modal close button");
        }
        setTimeout(() => location.reload(), 500);
        return;
      } else {
        const text = await response.text();
        console.error("[AP Tools] Failed:", response.status, text);
        alert(`Failed: ${response.status}`);
        updateButton();
      }
    } catch (e) {
      console.error("[AP Tools] Error:", e);
      alert("Error: " + e.message);
      updateButton();
    }
  }

  function init() {
    if (document.body) {
      createButton();
      updateButton();
      broadcastState();
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        createButton();
        updateButton();
        broadcastState();
      });
    }
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (!state.blocking) {
        state.videoId = null;
        state.duration = null;
        state.capturedHeaders = {};
        state.capturedBody = null;
        updateButton();
        broadcastState();
      }
    }
    if (document.body && !document.getElementById("ap-tools-btn")) {
      createButton();
      updateButton();
    }
  }).observe(document, { subtree: true, childList: true });

  init();
  console.log("[AP Tools] Content script initialized");
})();
