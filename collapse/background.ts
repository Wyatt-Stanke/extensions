import {
	CollapseMessageType,
	onMessage,
	sendTabMessage,
	VideoInfo,
	VideoList,
} from "./messaging";

const YOUTUBE_VIDEO_PATTERN = /youtube\.com\/watch\?.*v=/;

function getCollapsedListIdFromTabUrl(
	urlString: string | undefined,
): string | null {
	if (!urlString) return null;

	try {
		const url = new URL(urlString);
		if (!url.pathname.endsWith("/collapsed.html")) {
			return null;
		}

		const listId = url.searchParams.get("listId");
		return listId || null;
	} catch {
		return null;
	}
}

function dedupeVideosByNewest(videos: VideoInfo[]): VideoInfo[] {
	const byId = new Map<string, VideoInfo>();

	for (const video of videos) {
		const existing = byId.get(video.videoId);
		if (!existing || (video.addedAt || 0) > (existing.addedAt || 0)) {
			byId.set(video.videoId, video);
		}
	}

	return Array.from(byId.values());
}

async function getVideoLists(): Promise<VideoList[]> {
	const result = await chrome.storage.local.get("videoLists");
	return (result.videoLists as VideoList[]) || [];
}

async function saveVideoLists(lists: VideoList[]): Promise<void> {
	await chrome.storage.local.set({ videoLists: lists });
}

function getMostRecentList(lists: VideoList[]): VideoList | null {
	if (lists.length === 0) return null;
	return lists.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
}

function extractVideoIdFromUrl(urlString: string): string | null {
	try {
		const url = new URL(urlString);
		return url.searchParams.get("v") || null;
	} catch {
		return null;
	}
}

async function addVideoFromUrl(videoUrl: string, listId: string | null) {
	const videoId = extractVideoIdFromUrl(videoUrl);
	if (!videoId) return { success: false };

	const lists = await getVideoLists();
	const list = listId
		? lists.find((l) => l.id === listId)
		: getMostRecentList(lists);
	if (!list) return { success: false };

	if (list.videos.some((v) => v.videoId === videoId)) {
		return { success: true, listId: list.id };
	}

	let playlistId = null;
	let playlistIndex = null;
	try {
		const parsedUrl = new URL(videoUrl);
		playlistId = parsedUrl.searchParams.get("list") || null;
		playlistIndex = parsedUrl.searchParams.get("index") || null;
	} catch {}

	list.videos.push({
		videoId,
		url: videoUrl,
		title: videoId,
		channelName: "",
		thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
		currentTime: 0,
		duration: 0,
		playlistId,
		playlistIndex,
		addedAt: Date.now(),
	});

	await saveVideoLists(lists);
	return { success: true, listId: list.id };
}

async function rebuildContextMenus() {
	await chrome.contextMenus.removeAll();

	const lists = await getVideoLists();
	const sorted = [...lists].sort((a, b) => b.createdAt - a.createdAt);
	const recent = sorted[0] || null;

	const contexts: ["link", "selection"] = ["link", "selection"];

	// 1. Simple button: add to most recent list
	chrome.contextMenus.create({
		id: "collapse-add-recent",
		title: recent ? `Collapse to "${recent.name}"` : "Collapse (no lists yet)",
		contexts,
		enabled: Boolean(recent),
	});

	// 2. Submenu: pick a specific list
	chrome.contextMenus.create({
		id: "collapse-add-to",
		title: "Collapse to…",
		contexts,
	});

	if (lists.length === 0) {
		chrome.contextMenus.create({
			id: "collapse-add-no-lists",
			parentId: "collapse-add-to",
			title: "No lists yet \u2014 create one first",
			contexts,
			enabled: false,
		});
	} else {
		for (const list of sorted) {
			const count = list.videos.length;
			chrome.contextMenus.create({
				id: `collapse-add-list-${list.id}`,
				parentId: "collapse-add-to",
				title: `${list.name} (${count} video${count !== 1 ? "s" : ""})`,
				contexts,
			});
		}
	}
}

async function tryGetVideoInfoFromTab(
	tabId: number,
): Promise<VideoInfo | null> {
	try {
		const response = (await sendTabMessage(tabId, {
			type: CollapseMessageType.GET_VIDEO_INFO,
		})) as { data: VideoInfo | null };
		return response?.data || null;
	} catch {
		return null;
	}
}

async function waitForTabLoadComplete(
	tabId: number,
	timeoutMs = 10000,
): Promise<boolean> {
	return await new Promise((resolve) => {
		let resolved = false;

		const cleanup = () => {
			if (resolved) return;
			resolved = true;
			chrome.tabs.onUpdated.removeListener(onUpdated);
			clearTimeout(timeoutId);
		};

		const onUpdated = (updatedTabId: number, changeInfo: any) => {
			if (updatedTabId === tabId && changeInfo.status === "complete") {
				cleanup();
				resolve(true);
			}
		};

		const timeoutId = setTimeout(() => {
			cleanup();
			resolve(false);
		}, timeoutMs);

		chrome.tabs.onUpdated.addListener(onUpdated);

		chrome.tabs
			.get(tabId)
			.then((tab) => {
				if (tab?.status === "complete") {
					cleanup();
					resolve(true);
				}
			})
			.catch(() => {
				cleanup();
				resolve(false);
			});
	});
}

async function getVideoInfoFromTab(tabId: number): Promise<VideoInfo | null> {
	const firstAttempt = await tryGetVideoInfoFromTab(tabId);
	if (firstAttempt?.videoId) {
		return firstAttempt;
	}

	try {
		await chrome.tabs.reload(tabId);
		await waitForTabLoadComplete(tabId);
	} catch {
		return firstAttempt;
	}

	return await tryGetVideoInfoFromTab(tabId);
}

onMessage(CollapseMessageType.COLLAPSE_TABS, async () => {
	return await handleCollapseTabs();
});

onMessage(CollapseMessageType.GET_LISTS, async () => {
	const lists = await getVideoLists();
	return { lists };
});

onMessage(CollapseMessageType.OPEN_VIDEO, async (message) => {
	await handleOpenVideo(message.listId, message.videoId);
});

onMessage(CollapseMessageType.DELETE_VIDEO, async (message) => {
	await handleDeleteVideo(message.listId, message.videoId);
});

onMessage(CollapseMessageType.DELETE_LIST, async (message) => {
	await handleDeleteList(message.listId);
});

onMessage(CollapseMessageType.RENAME_LIST, async (message) => {
	await handleRenameList(message.listId, message.name);
});

onMessage(CollapseMessageType.MERGE_LISTS, async (message) => {
	return await handleMergeLists(message.targetId, message.sourceId);
});

onMessage(CollapseMessageType.ADD_TO_LIST, async (message) => {
	return await handleAddToList(message.listId);
});

async function extractVideosFromTabs(youtubeTabs: chrome.tabs.Tab[]) {
	const videos: VideoInfo[] = [];
	const tabIds: number[] = [];
	const infoResults = await Promise.all(
		youtubeTabs.map((tab: chrome.tabs.Tab) =>
			getVideoInfoFromTab(tab.id as number).then((info) => ({ tab, info })),
		),
	);
	for (const { tab, info } of infoResults) {
		if (info && info.videoId) {
			videos.push({
				videoId: info.videoId,
				url: info.url,
				title: info.title,
				channelName: info.channelName,
				thumbnailUrl: info.thumbnailUrl,
				currentTime: info.currentTime,
				duration: info.duration,
				playlistId: info.playlistId || null,
				playlistIndex: info.playlistIndex || null,
				addedAt: Date.now(),
			});
			if (tab.id !== undefined) tabIds.push(tab.id);
		}
	}
	return { extractedVideos: videos, extractedTabIds: tabIds };
}

async function handleCollapseTabs() {
	const tabs = await chrome.tabs.query({
		highlighted: true,
		currentWindow: true,
	});

	const youtubeTabs = tabs.filter((tab) =>
		YOUTUBE_VIDEO_PATTERN.test(tab.url || ""),
	);
	const listTabs = tabs
		.map((tab) => ({
			tabId: tab.id,
			listId: getCollapsedListIdFromTabUrl(tab.url || ""),
		}))
		.filter((entry) => Boolean(entry.listId));

	if (youtubeTabs.length === 0 && listTabs.length === 0) {
		return {
			success: false,
			error: "No YouTube video or collapsed list tabs selected",
		};
	}

	const lists = await getVideoLists();
	const selectedListIds = Array.from(
		new Set(listTabs.map((entry) => entry.listId)),
	);

	const videos = [];
	for (const selectedListId of selectedListIds) {
		const existingList = lists.find((l) => l.id === selectedListId);
		if (existingList) {
			videos.push(...existingList.videos);
		}
	}

	const tabsToClose = [];
	const { extractedVideos, extractedTabIds } =
		await extractVideosFromTabs(youtubeTabs);
	videos.push(...extractedVideos);
	tabsToClose.push(...extractedTabIds);

	tabsToClose.push(...listTabs.map((entry) => entry.tabId));

	const uniqueVideos = dedupeVideosByNewest(videos);

	if (uniqueVideos.length === 0) {
		return {
			success: false,
			error: "Could not get videos from selected tabs or lists",
		};
	}

	const now = new Date();
	const dateStr = now.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

	const list = {
		id: crypto.randomUUID(),
		name: dateStr,
		createdAt: Date.now(),
		videos: uniqueVideos,
	};

	const updatedLists = lists.filter((l) => !selectedListIds.includes(l.id));
	updatedLists.push(list);
	await saveVideoLists(updatedLists);

	await chrome.tabs.create({
		url: chrome.runtime.getURL(`collapsed.html?listId=${list.id}`),
	});

	if (tabsToClose.length > 0) {
		const uniqueTabIds = Array.from(new Set(tabsToClose)).filter(
			(id) => id !== undefined,
		) as number[];
		await chrome.tabs.remove(uniqueTabIds);
	}

	return { success: true, listId: list.id, count: uniqueVideos.length };
}

async function closeCollapsedTabsForList(listId: string) {
	const allTabs = await chrome.tabs.query({});
	const targetUrl = `collapsed.html?listId=${listId}`;
	for (const tab of allTabs) {
		if (tab.url?.includes(targetUrl) && tab.id !== undefined) {
			await chrome.tabs.remove(tab.id);
		}
	}
}

async function autoDeleteIfEmpty(lists: VideoList[], listId: string) {
	const list = lists.find((l) => l.id === listId);
	if (list && list.videos.length === 0) {
		const updated = lists.filter((l) => l.id !== listId);
		await saveVideoLists(updated);
		await closeCollapsedTabsForList(listId);
		return true;
	}
	return false;
}

async function handleOpenVideo(listId: string, videoId: string) {
	const lists = await getVideoLists();
	const list = lists.find((l) => l.id === listId);
	if (!list) return { success: false };

	const video = list.videos.find((v) => v.videoId === videoId);
	if (!video) return { success: false };

	const timestamp = Math.floor(video.currentTime);
	let url = `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}${timestamp > 0 ? `&t=${timestamp}s` : ""}`;
	if (video.playlistId) {
		url += `&list=${encodeURIComponent(video.playlistId)}`;
		if (video.playlistIndex) {
			url += `&index=${encodeURIComponent(video.playlistIndex)}`;
		}
	}

	list.videos = list.videos.filter((v) => v.videoId !== videoId);
	await saveVideoLists(lists);
	await autoDeleteIfEmpty(lists, listId);

	await chrome.tabs.create({ url });

	return { success: true };
}

async function handleDeleteVideo(listId: string, videoId: string) {
	const lists = await getVideoLists();
	const list = lists.find((l) => l.id === listId);
	if (!list) return { success: false };

	list.videos = list.videos.filter((v) => v.videoId !== videoId);
	await saveVideoLists(lists);
	await autoDeleteIfEmpty(lists, listId);

	return { success: true };
}

async function handleDeleteList(listId: string) {
	let lists = await getVideoLists();
	lists = lists.filter((l) => l.id !== listId);
	await saveVideoLists(lists);

	return { success: true };
}

async function handleRenameList(listId: string, name: string) {
	const lists = await getVideoLists();
	const list = lists.find((l) => l.id === listId);
	if (!list) return { success: false };

	list.name = name;
	await saveVideoLists(lists);

	return { success: true };
}

async function handleMergeLists(targetId: string, sourceId: string) {
	const lists = await getVideoLists();
	const target = lists.find((l) => l.id === targetId);
	const source = lists.find((l) => l.id === sourceId);
	if (!target || !source) return { success: false };

	// Merge videos, dedup by videoId keeping the one with later addedAt
	target.videos = dedupeVideosByNewest([...target.videos, ...source.videos]);

	// Remove source list
	const updatedLists = lists.filter((l) => l.id !== sourceId);
	await saveVideoLists(updatedLists);

	return { success: true };
}

async function handleAddToList(listId: string | null) {
	const tabs = await chrome.tabs.query({
		highlighted: true,
		currentWindow: true,
	});

	const youtubeTabs = tabs.filter((tab) =>
		YOUTUBE_VIDEO_PATTERN.test(tab.url || ""),
	);

	if (youtubeTabs.length === 0) {
		return { success: false, error: "No YouTube video tabs selected" };
	}

	const lists = await getVideoLists();
	const list = lists.find((l) => l.id === listId);
	if (!list) return { success: false, error: "List not found" };

	const { extractedVideos: videos, extractedTabIds: tabsToClose } =
		await extractVideosFromTabs(youtubeTabs);

	if (videos.length === 0) {
		return { success: false, error: "Could not get info from any tabs" };
	}

	// Add videos, dedup by videoId keeping newer
	list.videos = dedupeVideosByNewest([...list.videos, ...videos]);

	await saveVideoLists(lists);

	if (tabsToClose.length > 0) {
		await chrome.tabs.remove(tabsToClose);
	}

	return { success: true, listId: list.id, count: videos.length };
}

// Keyboard shortcut: Ctrl+Shift+Y adds current tab to most recent list
chrome.commands.onCommand.addListener(async (command) => {
	if (command !== "add-to-recent-list") return;

	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true,
	});
	if (!tab || !YOUTUBE_VIDEO_PATTERN.test(tab.url || "")) return;

	const lists = await getVideoLists();
	let targetList = getMostRecentList(lists);
	if (!targetList) {
		targetList = {
			id: crypto.randomUUID(),
			name: new Date().toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			}),
			createdAt: Date.now(),
			videos: [],
		};
		lists.push(targetList);
	}

	const { extractedVideos, extractedTabIds } = await extractVideosFromTabs([
		tab,
	]);
	if (extractedVideos.length === 0) return;

	targetList.videos = dedupeVideosByNewest([
		...targetList.videos,
		...extractedVideos,
	]);
	await saveVideoLists(lists);

	await chrome.tabs.remove(extractedTabIds);
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info) => {
	const { menuItemId, linkUrl, selectionText } = info;

	// Resolve URL from link or from selected text that looks like a YouTube URL
	let videoUrl = linkUrl || null;
	if (!videoUrl && selectionText) {
		const trimmed = selectionText.trim();
		if (YOUTUBE_VIDEO_PATTERN.test(trimmed)) {
			videoUrl = trimmed;
		}
	}
	if (!videoUrl) return;

	if (menuItemId === "collapse-add-recent") {
		await addVideoFromUrl(videoUrl, null);
	} else if (
		typeof menuItemId === "string" &&
		menuItemId.startsWith("collapse-add-list-")
	) {
		const listId = menuItemId.slice("collapse-add-list-".length);
		await addVideoFromUrl(videoUrl, listId);
	}
});

// Build context menus on install/startup and keep them in sync
chrome.runtime.onInstalled.addListener(rebuildContextMenus);
chrome.runtime.onStartup.addListener(rebuildContextMenus);
chrome.storage.onChanged.addListener((changes) => {
	if (changes.videoLists) {
		rebuildContextMenus();
	}
});

console.log("[Collapse] Background service worker initialized");
