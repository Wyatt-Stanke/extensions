import { html } from "../shared/html";
import { getById } from "../shared/typed-getters";
import { CollapseMessageType, sendMessage, type VideoList } from "./messaging";

const params = new URLSearchParams(window.location.search);
const listId = params.get("listId");

if (!listId) {
	document.body.innerHTML = html`<div class="empty-state"><p>No list ID specified.</p></div>`;
	throw new Error("No list ID specified.");
}

const listNameEl = getById<HTMLElement>("list-name");
const videoCountEl = getById<HTMLElement>("video-count");
const videosEl = getById<HTMLElement>("videos");
const emptyStateEl = getById<HTMLElement>("empty-state");
const mergeBtnEl = getById<HTMLButtonElement>("merge-btn");
const deleteListBtnEl = getById<HTMLButtonElement>("delete-list-btn");
const mergeModalEl = getById<HTMLElement>("merge-modal");
const mergeOptionsEl = getById<HTMLElement>("merge-list-options");
const mergeCancelEl = getById<HTMLButtonElement>("merge-cancel");

function formatTime(seconds: number) {
	const s = Math.floor(seconds);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (h > 0) {
		return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
	}
	return `${m}:${String(sec).padStart(2, "0")}`;
}

function renderVideos(list: VideoList) {
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

		row.innerHTML = html`
        <img class="video-thumbnail" src="${escapeAttr(video.thumbnailUrl)}" alt="" />
        <div class="video-info">
          <div class="video-title">${escapeHtml(video.title)}</div>
          <div class="video-channel">${escapeHtml(video.channelName)}${video.playlistId ? ' <span class="playlist-badge" title="In playlist">&#9776; Playlist</span>' : ""}</div>
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
			if ((e.target as Element).closest(".btn-remove")) return;
			sendMessage({
				type: CollapseMessageType.OPEN_VIDEO,
				listId: listId as string,
				videoId: video.videoId,
			});
		});

		// Remove button
		row.querySelector(".btn-remove")?.addEventListener("click", (e) => {
			e.stopPropagation();
			sendMessage({
				type: CollapseMessageType.DELETE_VIDEO,
				listId: listId as string,
				videoId: video.videoId,
			});
		});

		videosEl.appendChild(row);
	}
}

function escapeHtml(str: string) {
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}

function escapeAttr(str: string) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

async function loadAndRender() {
	const response = (await sendMessage({
		type: CollapseMessageType.GET_LISTS,
	})) as Extract<
		import("./messaging").CollapseProtocol[CollapseMessageType.GET_LISTS]["response"],
		{ lists: VideoList[] }
	>;
	const lists = response?.lists || [];
	const list = lists.find((l) => l.id === listId);

	if (!list) {
		document.body.innerHTML = html`<div class="empty-state"><p>List not found.</p></div>`;
		return;
	}

	renderVideos(list);
}

// Rename on blur
listNameEl.addEventListener("blur", () => {
	const newName = listNameEl.textContent?.trim();
	if (newName) {
		sendMessage({
			type: CollapseMessageType.RENAME_LIST,
			listId: listId || "",
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
	await sendMessage({
		type: CollapseMessageType.DELETE_LIST,
		listId: listId || "",
	});
	window.close();
});

// Merge modal
mergeBtnEl.addEventListener("click", async () => {
	const response = (await sendMessage({
		type: CollapseMessageType.GET_LISTS,
	})) as { lists: VideoList[] };
	const lists = (response?.lists || []).filter(
		(l: VideoList) => l.id !== listId,
	);

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
			const result = (await sendMessage({
				type: CollapseMessageType.MERGE_LISTS,
				targetId: list.id,
				sourceId: listId || "",
			})) as { success: boolean; error?: string };

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
		const lists = (changes.videoLists.newValue as VideoList[]) || [];
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
