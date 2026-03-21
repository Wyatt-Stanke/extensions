import { ChevronDown, createIcons, SquaresUnite } from "lucide";
import { html } from "../shared/html";
import { displayVersion } from "../shared/popup-version.js";
import { getById } from "../shared/typed-getters";
import { CollapseMessageType, sendMessage, type VideoList } from "./messaging";

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

	const scopeSelectedBtn = getById<HTMLButtonElement>("scope-selected");
	const scopeAllBtn = getById<HTMLButtonElement>("scope-all");
	const scopeSelectedCount = getById<HTMLElement>("scope-selected-count");
	const scopeAllCount = getById<HTMLElement>("scope-all-count");
	const collapseBtn = getById<HTMLButtonElement>("collapse-btn");
	const listsSection = getById<HTMLElement>("lists-section");
	const listsContainer = getById<HTMLElement>("lists-container");

	let useAllTabs = false;

	const allTabs = await chrome.tabs.query({
		currentWindow: true,
	});
	const tabs = allTabs.filter((tab) => tab.highlighted);
	const youtubeTabs = tabs.filter((tab) =>
		YOUTUBE_VIDEO_PATTERN.test(tab.url || ""),
	);
	const listTabs = tabs.filter((tab) =>
		Boolean(getCollapsedListIdFromUrl(tab.url || "")),
	);
	const selectedCount = youtubeTabs.length + listTabs.length;

	const allYoutubeTabs = allTabs.filter((tab) =>
		YOUTUBE_VIDEO_PATTERN.test(tab.url || ""),
	);
	const allListTabs = allTabs.filter((tab) =>
		Boolean(getCollapsedListIdFromUrl(tab.url || "")),
	);
	const totalCollapsableCount = allYoutubeTabs.length + allListTabs.length;

	scopeSelectedCount.textContent = String(selectedCount);
	scopeAllCount.textContent = String(totalCollapsableCount);

	function getActiveCount() {
		return useAllTabs ? totalCollapsableCount : selectedCount;
	}

	function updateCollapseButton() {
		const count = getActiveCount();
		collapseBtn.textContent = `Create List from ${count} Tab${count !== 1 ? "s" : ""}`;
		collapseBtn.disabled = count === 0;
	}

	function setScope(all: boolean) {
		useAllTabs = all;
		scopeSelectedBtn.classList.toggle("active", !all);
		scopeAllBtn.classList.toggle("active", all);
		updateCollapseButton();
	}

	scopeSelectedBtn.addEventListener("click", () => setScope(false));
	scopeAllBtn.addEventListener("click", () => setScope(true));

	updateCollapseButton();

	collapseBtn.addEventListener("click", async () => {
		collapseBtn.disabled = true;
		collapseBtn.textContent = "Collapsing...";

		const response = (await sendMessage({
			type: CollapseMessageType.COLLAPSE_TABS,
			...(useAllTabs ? { allTabs: true } : {}),
		})) as { success: boolean; error?: string };

		if (response?.success) {
			window.close();
		} else {
			collapseBtn.textContent = response?.error || "Failed";
			setTimeout(() => {
				updateCollapseButton();
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

			if (totalCollapsableCount > 0) {
				const splitWrap = document.createElement("div");
				splitWrap.className = "add-split";

				// Main button: add selected tabs (most common action)
				const mainBtn = document.createElement("button");
				mainBtn.className = "add-split-main";
				mainBtn.title = `Add ${selectedCount} selected tab${selectedCount !== 1 ? "s" : ""}`;
				mainBtn.innerHTML = html`<i data-lucide="squares-unite"></i>`;
				mainBtn.disabled = selectedCount === 0;
				mainBtn.addEventListener("click", async (event) => {
					event.stopPropagation();
					mainBtn.disabled = true;
					const result = (await sendMessage({
						type: CollapseMessageType.ADD_TO_LIST,
						listId: list.id,
					})) as { success: boolean; listId?: string };
					if (result?.success) {
						window.close();
					} else {
						mainBtn.disabled = selectedCount === 0;
					}
				});

				// Chevron button: opens dropdown
				const chevronBtn = document.createElement("button");
				chevronBtn.className = "add-split-chevron";
				chevronBtn.title = "More options";
				chevronBtn.innerHTML = html`<i data-lucide="chevron-down"></i>`;

				// Dropdown menu
				const dropdown = document.createElement("div");
				dropdown.className = "add-dropdown";

				const addSelectedOpt = document.createElement("button");
				addSelectedOpt.className = "add-dropdown-item";
				addSelectedOpt.textContent = `Add selected (${selectedCount})`;
				addSelectedOpt.disabled = selectedCount === 0;
				addSelectedOpt.addEventListener("click", async (event) => {
					event.stopPropagation();
					addSelectedOpt.disabled = true;
					const result = (await sendMessage({
						type: CollapseMessageType.ADD_TO_LIST,
						listId: list.id,
					})) as { success: boolean };
					if (result?.success) window.close();
					else addSelectedOpt.disabled = selectedCount === 0;
				});

				const addAllOpt = document.createElement("button");
				addAllOpt.className = "add-dropdown-item";
				addAllOpt.textContent = `Add all tabs (${totalCollapsableCount})`;
				addAllOpt.addEventListener("click", async (event) => {
					event.stopPropagation();
					addAllOpt.disabled = true;
					const result = (await sendMessage({
						type: CollapseMessageType.ADD_TO_LIST,
						listId: list.id,
						allTabs: true,
					})) as { success: boolean };
					if (result?.success) window.close();
					else addAllOpt.disabled = false;
				});

				dropdown.appendChild(addSelectedOpt);
				dropdown.appendChild(addAllOpt);

				chevronBtn.addEventListener("click", (event) => {
					event.stopPropagation();
					// Close any other open dropdowns first
					for (const d of document.querySelectorAll(".add-dropdown.open")) {
						if (d !== dropdown) d.classList.remove("open");
					}
					dropdown.classList.toggle("open");
				});

				splitWrap.appendChild(mainBtn);
				splitWrap.appendChild(chevronBtn);
				splitWrap.appendChild(dropdown);
				item.appendChild(splitWrap);
			}

			listsContainer.appendChild(item);
		}

		if (totalCollapsableCount > 0) {
			createIcons({
				icons: {
					SquaresUnite,
					ChevronDown,
				},
				attrs: {
					width: "14",
					height: "14",
				},
			});
		}

		// Close dropdowns when clicking outside
		document.addEventListener("click", () => {
			for (const d of document.querySelectorAll(".add-dropdown.open")) {
				d.classList.remove("open");
			}
		});
	}
});
