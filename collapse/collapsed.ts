import { escapeAttr, escapeHtml } from "../shared/escape";
import { html } from "../shared/html";
import { getById } from "../shared/typed-getters";
import { LayoutGrid, LayoutList, List, createIcons } from "lucide";
import { CollapseMessageType, sendMessage, type VideoList } from "./messaging";

type Layout = "list" | "grid" | "compact";
const LAYOUT_KEY = "collapse-layout";

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
const exportBtnEl = getById<HTMLButtonElement>("export-btn");
const mergeModalEl = getById<HTMLElement>("merge-modal");
const mergeOptionsEl = getById<HTMLElement>("merge-list-options");
const mergeCancelEl = getById<HTMLButtonElement>("merge-cancel");
const layoutListBtn = getById<HTMLButtonElement>("layout-list");
const layoutGridBtn = getById<HTMLButtonElement>("layout-grid");
const layoutCompactBtn = getById<HTMLButtonElement>("layout-compact");

let currentLayout: Layout =
	(localStorage.getItem(LAYOUT_KEY) as Layout) ?? "list";

function setLayout(layout: Layout) {
	currentLayout = layout;
	localStorage.setItem(LAYOUT_KEY, layout);
	for (const [btn, id] of [
		[layoutListBtn, "list"],
		[layoutGridBtn, "grid"],
		[layoutCompactBtn, "compact"],
	] as const) {
		const active = id === layout;
		btn.classList.toggle("active", active);
		btn.setAttribute("aria-pressed", String(active));
	}
	videosEl.dataset.layout = layout;
}

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
	setLayout(currentLayout);

	if (list.videos.length === 0) {
		videosEl.style.display = "none";
		emptyStateEl.style.display = "block";
		return;
	}

	videosEl.style.display = "";
	emptyStateEl.style.display = "none";

	for (const video of list.videos) {
		const card = document.createElement("div");
		card.className = "video-card";

		const progress =
			video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;

		const playlistBadge = video.playlistId
			? ' <span class="playlist-badge" title="In playlist">&#9776; Playlist</span>'
			: "";

		card.innerHTML = html`
        <img class="video-thumbnail" src="${escapeAttr(video.thumbnailUrl)}" alt="" />
        <div class="video-info">
          <div class="video-title">${escapeHtml(video.title)}</div>
          <div class="video-channel">${escapeHtml(video.channelName)}${playlistBadge}</div>
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

		// Click card to open video
		card.addEventListener("click", (e) => {
			if ((e.target as Element).closest(".btn-remove")) return;
			sendMessage({
				type: CollapseMessageType.OPEN_VIDEO,
				listId: listId as string,
				videoId: video.videoId,
			});
		});

		// Remove button
		card.querySelector(".btn-remove")?.addEventListener("click", (e) => {
			e.stopPropagation();
			sendMessage({
				type: CollapseMessageType.DELETE_VIDEO,
				listId: listId as string,
				videoId: video.videoId,
			});
		});

		videosEl.appendChild(card);
	}
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

// Export list
exportBtnEl.addEventListener("click", async () => {
	const response = (await sendMessage({
		type: CollapseMessageType.GET_LISTS,
	})) as { lists: VideoList[] };
	const list = (response?.lists || []).find((l) => l.id === listId);
	if (!list) return;

	const blob = new Blob([JSON.stringify([list], null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${list.name.replace(/[^a-z0-9]/gi, "_")}.json`;
	a.click();
	URL.revokeObjectURL(url);
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

// Layout toggle buttons
layoutListBtn.addEventListener("click", () => setLayout("list"));
layoutGridBtn.addEventListener("click", () => setLayout("grid"));
layoutCompactBtn.addEventListener("click", () => setLayout("compact"));

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

// Render lucide icons
createIcons({
	icons: { LayoutList, LayoutGrid, List },
	attrs: { width: "16", height: "16" },
});
