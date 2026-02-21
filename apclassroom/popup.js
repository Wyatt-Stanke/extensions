document.addEventListener("DOMContentLoaded", async function () {
  const scriptStatusEl = document.getElementById("script-status");
  const videoIdEl = document.getElementById("video-id");
  const modeEl = document.getElementById("mode");
  const statusContainer = document.getElementById("status-container");
  const notOnPageEl = document.getElementById("not-on-page");

  async function updateStatus() {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Check if we're on AP Classroom
      if (!tab.url?.includes("apclassroom.collegeboard.org")) {
        statusContainer.style.display = "none";
        notOnPageEl.style.display = "block";
        return;
      }

      statusContainer.style.display = "block";
      notOnPageEl.style.display = "none";

      // Try to get state from content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "GET_STATE",
      });

      if (response?.state) {
        const state = response.state;

        // Script status
        if (state.initialized) {
          scriptStatusEl.textContent = "Active";
          scriptStatusEl.className = "status-value active";
        } else {
          scriptStatusEl.textContent = "Not Running";
          scriptStatusEl.className = "status-value inactive";
        }

        // Video ID
        if (state.videoId) {
          videoIdEl.textContent = state.videoId;
          videoIdEl.className = "status-value ready";
        } else {
          videoIdEl.textContent = "Waiting...";
          videoIdEl.className = "status-value loading";
        }

        // Mode
        if (state.blocking) {
          modeEl.textContent = "Blocking";
          modeEl.className = "status-value blocking";
        } else if (state.videoId) {
          modeEl.textContent = "Ready";
          modeEl.className = "status-value ready";
        } else {
          modeEl.textContent = "Monitoring";
          modeEl.className = "status-value loading";
        }
      } else {
        throw new Error("No response");
      }
    } catch (e) {
      console.log("Error getting state:", e);
      scriptStatusEl.textContent = "Not Running";
      scriptStatusEl.className = "status-value inactive";
      videoIdEl.textContent = "—";
      videoIdEl.className = "status-value";
      modeEl.textContent = "—";
      modeEl.className = "status-value";
    }
  }

  // Initial update
  await updateStatus();

  // Refresh every second while popup is open
  setInterval(updateStatus, 1000);
});
