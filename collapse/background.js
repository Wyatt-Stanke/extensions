const YOUTUBE_VIDEO_PATTERN = /youtube\.com\/watch\?.*v=/;

function getCollapsedListIdFromTabUrl(urlString) {
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

function dedupeVideosByNewest(videos) {
    const byId = new Map();

    for (const video of videos) {
        const existing = byId.get(video.videoId);
        if (!existing || (video.addedAt || 0) > (existing.addedAt || 0)) {
            byId.set(video.videoId, video);
        }
    }

    return Array.from(byId.values());
}

async function getVideoLists() {
    const result = await chrome.storage.local.get("videoLists");
    return result.videoLists || [];
}

async function saveVideoLists(lists) {
    await chrome.storage.local.set({ videoLists: lists });
}

function getMostRecentList(lists) {
    if (lists.length === 0) return null;
    return lists.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
}

function extractVideoIdFromUrl(urlString) {
    try {
        const url = new URL(urlString);
        return url.searchParams.get("v") || null;
    } catch {
        return null;
    }
}

async function addVideoFromUrl(videoUrl, listId) {
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

    list.videos.push({
        videoId,
        url: videoUrl,
        title: videoId,
        channelName: "",
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        currentTime: 0,
        duration: 0,
        addedAt: Date.now(),
    });

    await saveVideoLists(lists);
    return { success: true, listId: list.id };
}

async function rebuildContextMenus() {
    await chrome.contextMenus.removeAll();

    const targetUrlPatterns = ["*://*.youtube.com/watch*"];
    const lists = await getVideoLists();
    const sorted = [...lists].sort((a, b) => b.createdAt - a.createdAt);
    const recent = sorted[0] || null;

    // 1. Simple button: add to most recent list
    chrome.contextMenus.create({
        id: "collapse-add-recent",
        title: recent
            ? `Collapse to "${recent.name}"`
            : "Collapse (no lists yet)",
        contexts: ["link"],
        targetUrlPatterns,
        enabled: Boolean(recent),
    });

    // 2. Submenu: pick a specific list
    chrome.contextMenus.create({
        id: "collapse-add-to",
        title: "Collapse to…",
        contexts: ["link"],
        targetUrlPatterns,
    });

    if (lists.length === 0) {
        chrome.contextMenus.create({
            id: "collapse-add-no-lists",
            parentId: "collapse-add-to",
            title: "No lists yet \u2014 create one first",
            contexts: ["link"],
            targetUrlPatterns,
            enabled: false,
        });
    } else {
        for (const list of sorted) {
            const count = list.videos.length;
            chrome.contextMenus.create({
                id: `collapse-add-list-${list.id}`,
                parentId: "collapse-add-to",
                title: `${list.name} (${count} video${count !== 1 ? "s" : ""})`,
                contexts: ["link"],
                targetUrlPatterns,
            });
        }
    }
}

async function tryGetVideoInfoFromTab(tabId) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, {
            type: "GET_VIDEO_INFO",
        });
        return response?.data || null;
    } catch {
        return null;
    }
}

async function waitForTabLoadComplete(tabId, timeoutMs = 10000) {
    return await new Promise((resolve) => {
        let resolved = false;

        const cleanup = () => {
            if (resolved) return;
            resolved = true;
            chrome.tabs.onUpdated.removeListener(onUpdated);
            clearTimeout(timeout);
        };

        const onUpdated = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === "complete") {
                cleanup();
                resolve(true);
            }
        };

        const timeout = setTimeout(() => {
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

async function getVideoInfoFromTab(tabId) {
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "COLLAPSE_TABS") {
        handleCollapseTabs().then(sendResponse);
        return true;
    }

    if (message.type === "GET_LISTS") {
        getVideoLists().then((lists) => sendResponse({ lists }));
        return true;
    }

    if (message.type === "OPEN_VIDEO") {
        handleOpenVideo(message.listId, message.videoId).then(sendResponse);
        return true;
    }

    if (message.type === "DELETE_VIDEO") {
        handleDeleteVideo(message.listId, message.videoId).then(sendResponse);
        return true;
    }

    if (message.type === "DELETE_LIST") {
        handleDeleteList(message.listId).then(sendResponse);
        return true;
    }

    if (message.type === "RENAME_LIST") {
        handleRenameList(message.listId, message.name).then(sendResponse);
        return true;
    }

    if (message.type === "MERGE_LISTS") {
        handleMergeLists(message.targetId, message.sourceId).then(sendResponse);
        return true;
    }

    if (message.type === "ADD_TO_LIST") {
        handleAddToList(message.listId).then(sendResponse);
        return true;
    }
});

async function handleCollapseTabs() {
    const tabs = await chrome.tabs.query({
        highlighted: true,
        currentWindow: true,
    });

    const youtubeTabs = tabs.filter((tab) => YOUTUBE_VIDEO_PATTERN.test(tab.url));
    const listTabs = tabs
        .map((tab) => ({
            tabId: tab.id,
            listId: getCollapsedListIdFromTabUrl(tab.url),
        }))
        .filter((entry) => Boolean(entry.listId));

    if (youtubeTabs.length === 0 && listTabs.length === 0) {
        return {
            success: false,
            error: "No YouTube video or collapsed list tabs selected",
        };
    }

    const lists = await getVideoLists();
    const selectedListIds = Array.from(new Set(listTabs.map((entry) => entry.listId)));

    const videos = [];
    for (const selectedListId of selectedListIds) {
        const existingList = lists.find((l) => l.id === selectedListId);
        if (existingList) {
            videos.push(...existingList.videos);
        }
    }

    const tabsToClose = [];
    for (const tab of youtubeTabs) {
        const info = await getVideoInfoFromTab(tab.id);
        if (info && info.videoId) {
            videos.push({
                videoId: info.videoId,
                url: info.url,
                title: info.title,
                channelName: info.channelName,
                thumbnailUrl: info.thumbnailUrl,
                currentTime: info.currentTime,
                duration: info.duration,
                addedAt: Date.now(),
            });
            tabsToClose.push(tab.id);
        }
    }

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
        name: `Collapsed — ${dateStr}`,
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
        const uniqueTabIds = Array.from(new Set(tabsToClose));
        await chrome.tabs.remove(uniqueTabIds);
    }

    return { success: true, listId: list.id, count: uniqueVideos.length };
}

async function closeCollapsedTabsForList(listId) {
    const allTabs = await chrome.tabs.query({});
    const targetUrl = `collapsed.html?listId=${listId}`;
    for (const tab of allTabs) {
        if (tab.url?.includes(targetUrl)) {
            await chrome.tabs.remove(tab.id);
        }
    }
}

async function autoDeleteIfEmpty(lists, listId) {
    const list = lists.find((l) => l.id === listId);
    if (list && list.videos.length === 0) {
        const updated = lists.filter((l) => l.id !== listId);
        await saveVideoLists(updated);
        await closeCollapsedTabsForList(listId);
        return true;
    }
    return false;
}

async function handleOpenVideo(listId, videoId) {
    const lists = await getVideoLists();
    const list = lists.find((l) => l.id === listId);
    if (!list) return { success: false };

    const video = list.videos.find((v) => v.videoId === videoId);
    if (!video) return { success: false };

    const timestamp = Math.floor(video.currentTime);
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}${timestamp > 0 ? `&t=${timestamp}s` : ""}`;

    list.videos = list.videos.filter((v) => v.videoId !== videoId);
    await saveVideoLists(lists);
    await autoDeleteIfEmpty(lists, listId);

    await chrome.tabs.create({ url });

    return { success: true };
}

async function handleDeleteVideo(listId, videoId) {
    const lists = await getVideoLists();
    const list = lists.find((l) => l.id === listId);
    if (!list) return { success: false };

    list.videos = list.videos.filter((v) => v.videoId !== videoId);
    await saveVideoLists(lists);
    await autoDeleteIfEmpty(lists, listId);

    return { success: true };
}

async function handleDeleteList(listId) {
    let lists = await getVideoLists();
    lists = lists.filter((l) => l.id !== listId);
    await saveVideoLists(lists);

    return { success: true };
}

async function handleRenameList(listId, name) {
    const lists = await getVideoLists();
    const list = lists.find((l) => l.id === listId);
    if (!list) return { success: false };

    list.name = name;
    await saveVideoLists(lists);

    return { success: true };
}

async function handleMergeLists(targetId, sourceId) {
    const lists = await getVideoLists();
    const target = lists.find((l) => l.id === targetId);
    const source = lists.find((l) => l.id === sourceId);
    if (!target || !source) return { success: false };

    // Merge videos, dedup by videoId keeping the one with later addedAt
    const existingIds = new Map(target.videos.map((v) => [v.videoId, v]));
    for (const video of source.videos) {
        const existing = existingIds.get(video.videoId);
        if (!existing || video.addedAt > existing.addedAt) {
            if (existing) {
                target.videos = target.videos.filter(
                    (v) => v.videoId !== video.videoId,
                );
            }
            target.videos.push(video);
        }
    }

    // Remove source list
    const updatedLists = lists.filter((l) => l.id !== sourceId);
    await saveVideoLists(updatedLists);

    return { success: true };
}

async function handleAddToList(listId) {
    const tabs = await chrome.tabs.query({
        highlighted: true,
        currentWindow: true,
    });

    const youtubeTabs = tabs.filter((tab) => YOUTUBE_VIDEO_PATTERN.test(tab.url));

    if (youtubeTabs.length === 0) {
        return { success: false, error: "No YouTube video tabs selected" };
    }

    const lists = await getVideoLists();
    const list = lists.find((l) => l.id === listId);
    if (!list) return { success: false, error: "List not found" };

    const videos = [];
    const tabsToClose = [];
    for (const tab of youtubeTabs) {
        const info = await getVideoInfoFromTab(tab.id);
        if (info && info.videoId) {
            videos.push({
                videoId: info.videoId,
                url: info.url,
                title: info.title,
                channelName: info.channelName,
                thumbnailUrl: info.thumbnailUrl,
                currentTime: info.currentTime,
                duration: info.duration,
                addedAt: Date.now(),
            });
            tabsToClose.push(tab.id);
        }
    }

    if (videos.length === 0) {
        return { success: false, error: "Could not get info from any tabs" };
    }

    // Add videos, dedup by videoId keeping newer
    const existingIds = new Map(list.videos.map((v) => [v.videoId, v]));
    for (const video of videos) {
        const existing = existingIds.get(video.videoId);
        if (!existing) {
            list.videos.push(video);
        } else if (video.addedAt > existing.addedAt) {
            list.videos = list.videos.filter((v) => v.videoId !== video.videoId);
            list.videos.push(video);
        }
    }

    await saveVideoLists(lists);

    if (tabsToClose.length > 0) {
        await chrome.tabs.remove(tabsToClose);
    }

    return { success: true, listId: list.id, count: videos.length };
}

// Keyboard shortcut: Ctrl+Alt+C adds current tab to most recent list
chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "add-to-recent-list") return;

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
    });
    if (!tab || !YOUTUBE_VIDEO_PATTERN.test(tab.url)) return;

    const lists = await getVideoLists();
    const targetList = getMostRecentList(lists);
    if (!targetList) return;

    const info = await getVideoInfoFromTab(tab.id);
    if (!info?.videoId) return;

    if (!targetList.videos.some((v) => v.videoId === info.videoId)) {
        targetList.videos.push({
            videoId: info.videoId,
            url: info.url,
            title: info.title,
            channelName: info.channelName,
            thumbnailUrl: info.thumbnailUrl,
            currentTime: info.currentTime,
            duration: info.duration,
            addedAt: Date.now(),
        });
        await saveVideoLists(lists);
    }

    await chrome.tabs.remove(tab.id);
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info) => {
    const { menuItemId, linkUrl } = info;
    if (!linkUrl) return;

    if (menuItemId === "collapse-add-recent") {
        await addVideoFromUrl(linkUrl, null);
    } else if (
        typeof menuItemId === "string" &&
        menuItemId.startsWith("collapse-add-list-")
    ) {
        const listId = menuItemId.slice("collapse-add-list-".length);
        await addVideoFromUrl(linkUrl, listId);
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
