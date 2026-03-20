import { createIcons, SquaresUnite } from "lucide";
import { displayVersion } from "../shared/popup-version.js";
import { getById } from "../shared/typed-getters";
import { CollapseMessageType, sendMessage, VideoList } from "./messaging";
import { html } from "../shared/html";

const YOUTUBE_VIDEO_PATTERN = /youtube\.com\/watch\?.*v=/;

function getCollapsedListIdFromUrl(urlString: string) {
	if (!urlString) return null;

	try {
		const url = new URL(urlString);
		if (!url.pathname.endsWith("/collapsed.html")) {
			return null;
		}

		return url.searchParams.get("listId") || null;
	} catch {
		return null;
	}
}

document.addEventListener("DOMContentLoaded", async () => {
	displayVersion();

	const tabCountEl = getById<HTMLElement>("tab-count");
	const collapseBtn = getById<HTMLButtonElement>("collapse-btn");
	const listsSection = getById<HTMLElement>("lists-section");
	const listsContainer = getById<HTMLElement>("lists-container");

	const tabs = await chrome.tabs.query({
		highlighted: true,
		currentWindow: true,
	});
	const youtubeTabs = tabs.filter((tab) =>
		YOUTUBE_VIDEO_PATTERN.test(tab.url || ""),
	);
	const listTabs = tabs.filter((tab) =>
		Boolean(getCollapsedListIdFromUrl(tab.url || "")),
	);
	const selectedCount = youtubeTabs.length + listTabs.length;

	tabCountEl.textContent = `${selectedCount} tab${selectedCount !== 1 ? "s" : ""}`;
	collapseBtn.textContent = `Create List from ${selectedCount} Tab${selectedCount !== 1 ? "s" : ""}`;
	collapseBtn.disabled = selectedCount === 0;

	collapseBtn.addEventListener("click", async () => {
		collapseBtn.disabled = true;
		collapseBtn.textContent = "Collapsing...";

		const response = (await sendMessage({
			type: CollapseMessageType.COLLAPSE_TABS,
		})) as { success: boolean; error?: string };

		if (response?.success) {
			window.close();
		} else {
			collapseBtn.textContent = response?.error || "Failed";
			setTimeout(() => {
				collapseBtn.textContent = `Create List from ${selectedCount} Tab${selectedCount !== 1 ? "s" : ""}`;
				collapseBtn.disabled = selectedCount === 0;
			}, 2000);
		}
	});

	const response = (await sendMessage({
		type: CollapseMessageType.GET_LISTS,
	})) as { lists: VideoList[] };
	const lists = response?.lists || [];

	if (lists.length > 0) {
		listsSection.style.display = "block";
		listsContainer.innerHTML = "";

		for (const list of lists) {
			const item = document.createElement("div");
			item.className = "list-item";
			item.addEventListener("click", () => {
				chrome.tabs.create({
					url: chrome.runtime.getURL(`collapsed.html?listId=${list.id}`),
				});
				window.close();
			});

			const name = document.createElement("span");
			name.className = "list-item-name";
			name.textContent = list.name;

			const countBadge = document.createElement("span");
			countBadge.className = "list-item-count";
			countBadge.textContent = `${list.videos.length} video${list.videos.length !== 1 ? "s" : ""}`;

			item.appendChild(name);
			item.appendChild(countBadge);

			if (selectedCount > 0) {
				const addBtn = document.createElement("button");
				addBtn.className = "btn-add-to-list";
				addBtn.title = "Add selected tabs to this list";
				addBtn.innerHTML = html`<i data-lucide="squares-unite"></i>`;
				addBtn.addEventListener("click", async (event) => {
					event.stopPropagation();
					addBtn.disabled = true;
					const result = (await sendMessage({
						type: CollapseMessageType.ADD_TO_LIST,
						listId: list.id,
					})) as { success: boolean; listId?: string };
					if (result?.success) {
						window.close();
					} else {
						addBtn.disabled = false;
					}
				});
				item.appendChild(addBtn);
			}

			listsContainer.appendChild(item);
		}

		if (selectedCount > 0) {
			createIcons({
				icons: {
					SquaresUnite,
				},
				attrs: {
					width: "16",
					height: "16",
				},
			});
		}
	}
});
