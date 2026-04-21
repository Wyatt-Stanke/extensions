import { ChevronDown, createIcons, SquaresUnite } from "lucide";
// biome-ignore lint/correctness/noUnusedImports: JSX factory
import { jsx } from "../shared/jsx-runtime";
import { displayVersion } from "../shared/popup-version.js";
import { getById } from "../shared/typed-getters";
import { show } from "../shared/ui";
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
		show(listsSection);
		listsContainer.innerHTML = "";

		for (const list of lists) {
			const item = (
				<div className="list-item">
					<span className="list-item-name">{list.name}</span>
					<span className="list-item-count">
						{list.videos.length} video
						{list.videos.length !== 1 ? "s" : ""}
					</span>
				</div>
			);
			item.addEventListener("click", () => {
				chrome.tabs.create({
					url: chrome.runtime.getURL(`collapsed.html?listId=${list.id}`),
				});
				window.close();
			});

			if (totalCollapsableCount > 0) {
				const mainBtn = (
					<button
						type="button"
						className="add-split-main"
						title={`Add ${selectedCount} selected tab${selectedCount !== 1 ? "s" : ""}`}
						disabled={selectedCount === 0}
					>
						<i data-lucide="squares-unite" />
					</button>
				) as HTMLButtonElement;
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

				const addSelectedOpt = (
					<button
						type="button"
						className="add-dropdown-item"
						disabled={selectedCount === 0}
					>
						Add selected ({selectedCount})
					</button>
				) as HTMLButtonElement;
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

				const addAllOpt = (
					<button type="button" className="add-dropdown-item">
						Add all tabs ({totalCollapsableCount})
					</button>
				) as HTMLButtonElement;
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

				const dropdown = (
					<div className="add-dropdown">
						{addSelectedOpt}
						{addAllOpt}
					</div>
				);

				const chevronBtn = (
					<button type="button" className="add-split-chevron" title="More options">
						<i data-lucide="chevron-down" />
					</button>
				) as HTMLButtonElement;
				chevronBtn.addEventListener("click", (event) => {
					event.stopPropagation();
					for (const d of document.querySelectorAll(
						".add-dropdown.open",
					)) {
						if (d !== dropdown) d.classList.remove("open");
					}
					dropdown.classList.toggle("open");
				});

				item.appendChild(
					<div className="add-split">
						{mainBtn}
						{chevronBtn}
						{dropdown}
					</div>,
				);
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
