(function () {
    "use strict";

    const params = new URLSearchParams(window.location.search);
    const listId = params.get("listId");

    if (!listId) {
        document.body.textContent = "No list ID specified.";
        return;
    }

    const listNameEl = document.getElementById("list-name");
    const videoCountEl = document.getElementById("video-count");
    const videosEl = document.getElementById("videos");
    const emptyStateEl = document.getElementById("empty-state");
    const mergeBtnEl = document.getElementById("merge-btn");
    const deleteListBtnEl = document.getElementById("delete-list-btn");
    const mergeModalEl = document.getElementById("merge-modal");
    const mergeOptionsEl = document.getElementById("merge-list-options");
    const mergeCancelEl = document.getElementById("merge-cancel");

    function formatTime(seconds) {
        const s = Math.floor(seconds);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) {
            return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
        }
        return `${m}:${String(sec).padStart(2, "0")}`;
    }

    function renderVideos(list) {
        document.title = list.name;
        listNameEl.textContent = list.name;
        videoCountEl.textContent = `${list.videos.length} video${list.videos.length !== 1 ? "s" : ""}`;

        videosEl.innerHTML = "";

        if (list.videos.length === 0) {
            videosEl.style.display = "none";
            emptyStateEl.style.display = "block";
            return;
        }

        videosEl.style.display = "flex";
        emptyStateEl.style.display = "none";

        for (const video of list.videos) {
            const row = document.createElement("div");
            row.className = "video-row";

            const progress =
                video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;

            row.innerHTML = `
        <img class="video-thumbnail" src="${escapeAttr(video.thumbnailUrl)}" alt="" />
        <div class="video-info">
          <div class="video-title">${escapeHtml(video.title)}</div>
          <div class="video-channel">${escapeHtml(video.channelName)}${video.playlistId ? ' <span class="playlist-badge" title="In playlist">&#9776; Playlist</span>' : ''}</div>
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <span class="progress-text">${formatTime(video.currentTime)} / ${formatTime(video.duration)}</span>
          </div>
        </div>
        <div class="video-actions">
          <button class="btn-remove" data-video-id="${escapeAttr(video.videoId)}" title="Remove">×</button>
        </div>
      `;

            // Click row to open video
            row.addEventListener("click", (e) => {
                if (e.target.closest(".btn-remove")) return;
                chrome.runtime.sendMessage({
                    type: "OPEN_VIDEO",
                    listId,
                    videoId: video.videoId,
                });
            });

            // Remove button
            row.querySelector(".btn-remove").addEventListener("click", (e) => {
                e.stopPropagation();
                chrome.runtime.sendMessage({
                    type: "DELETE_VIDEO",
                    listId,
                    videoId: video.videoId,
                });
            });

            videosEl.appendChild(row);
        }
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    async function loadAndRender() {
        const response = await chrome.runtime.sendMessage({ type: "GET_LISTS" });
        const lists = response?.lists || [];
        const list = lists.find((l) => l.id === listId);

        if (!list) {
            document.body.innerHTML =
                '<div class="empty-state"><p>List not found.</p></div>';
            return;
        }

        renderVideos(list);
    }

    // Rename on blur
    listNameEl.addEventListener("blur", () => {
        const newName = listNameEl.textContent.trim();
        if (newName) {
            chrome.runtime.sendMessage({
                type: "RENAME_LIST",
                listId,
                name: newName,
            });
        }
    });

    // Rename on Enter
    listNameEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            listNameEl.blur();
        }
    });

    // Delete list
    deleteListBtnEl.addEventListener("click", async () => {
        if (!confirm("Delete this entire list?")) return;
        await chrome.runtime.sendMessage({ type: "DELETE_LIST", listId });
        window.close();
    });

    // Merge modal
    mergeBtnEl.addEventListener("click", async () => {
        const response = await chrome.runtime.sendMessage({ type: "GET_LISTS" });
        const lists = (response?.lists || []).filter((l) => l.id !== listId);

        if (lists.length === 0) {
            alert("No other lists to merge.");
            return;
        }

        mergeOptionsEl.innerHTML = "";
        for (const list of lists) {
            const option = document.createElement("div");
            option.className = "merge-option";
            option.textContent = `${list.name} (${list.videos.length} video${list.videos.length !== 1 ? "s" : ""})`;
            option.addEventListener("click", async () => {
                const result = await chrome.runtime.sendMessage({
                    type: "MERGE_LISTS",
                    targetId: list.id,
                    sourceId: listId,
                });

                if (result?.success) {
                    window.location.href = `collapsed.html?listId=${encodeURIComponent(list.id)}`;
                } else {
                    mergeModalEl.style.display = "none";
                    alert("Failed to merge lists.");
                }
            });
            mergeOptionsEl.appendChild(option);
        }

        mergeModalEl.style.display = "flex";
    });

    mergeCancelEl.addEventListener("click", () => {
        mergeModalEl.style.display = "none";
    });

    mergeModalEl.addEventListener("click", (e) => {
        if (e.target === mergeModalEl) {
            mergeModalEl.style.display = "none";
        }
    });

    // Listen for storage changes to update reactively
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.videoLists) {
            const lists = changes.videoLists.newValue || [];
            const list = lists.find((l) => l.id === listId);
            if (list) {
                renderVideos(list);
            } else {
                // List was deleted (e.g. auto-deleted when empty)
                window.close();
            }
        }
    });

    // Initial load
    loadAndRender();
})();
