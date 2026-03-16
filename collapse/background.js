const YOUTUBE_VIDEO_PATTERN = /youtube\.com\/watch\?.*v=/;

async function getVideoLists() {
    const result = await chrome.storage.local.get("videoLists");
    return result.videoLists || [];
}

async function saveVideoLists(lists) {
    await chrome.storage.local.set({ videoLists: lists });
}

async function getVideoInfoFromTab(tabId) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, {
            type: "GET_VIDEO_INFO",
        });
        return response?.data || null;
    } catch {
        return null;
    }
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

    if (youtubeTabs.length === 0) {
        return { success: false, error: "No YouTube video tabs selected" };
    }

    const videos = [];
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
        }
    }

    if (videos.length === 0) {
        return { success: false, error: "Could not get info from any tabs" };
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
        videos,
    };

    const lists = await getVideoLists();
    lists.push(list);
    await saveVideoLists(lists);

    await chrome.tabs.create({
        url: chrome.runtime.getURL(`collapsed.html?listId=${list.id}`),
    });

    const tabIds = youtubeTabs.map((t) => t.id);
    await chrome.tabs.remove(tabIds);

    return { success: true, listId: list.id, count: videos.length };
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

    await closeCollapsedTabsForList(sourceId);

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

    const tabIds = youtubeTabs.map((t) => t.id);
    await chrome.tabs.remove(tabIds);

    return { success: true, listId: list.id, count: videos.length };
}

console.log("[Collapse] Background service worker initialized");
