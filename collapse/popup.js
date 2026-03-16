import { createIcons, SquaresUnite } from "lucide";

const YOUTUBE_VIDEO_PATTERN = /youtube\.com\/watch\?.*v=/;

function getCollapsedListIdFromUrl(urlString) {
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
    const manifest = chrome.runtime.getManifest();
    document.getElementById("version-display").textContent = manifest.version;

    const tabCountEl = document.getElementById("tab-count");
    const collapseBtn = document.getElementById("collapse-btn");
    const listsSection = document.getElementById("lists-section");
    const listsContainer = document.getElementById("lists-container");

    const tabs = await chrome.tabs.query({
        highlighted: true,
        currentWindow: true,
    });
    const youtubeTabs = tabs.filter((tab) => YOUTUBE_VIDEO_PATTERN.test(tab.url));
    const listTabs = tabs.filter((tab) => Boolean(getCollapsedListIdFromUrl(tab.url)));
    const selectedCount = youtubeTabs.length + listTabs.length;

    tabCountEl.textContent = `${selectedCount} tab${selectedCount !== 1 ? "s" : ""}`;
    collapseBtn.textContent = `Create List from ${selectedCount} Tab${selectedCount !== 1 ? "s" : ""}`;
    collapseBtn.disabled = selectedCount === 0;

    collapseBtn.addEventListener("click", async () => {
        collapseBtn.disabled = true;
        collapseBtn.textContent = "Collapsing...";

        const response = await chrome.runtime.sendMessage({
            type: "COLLAPSE_TABS",
        });

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

    const response = await chrome.runtime.sendMessage({ type: "GET_LISTS" });
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
                addBtn.innerHTML = '<i data-lucide="squares-unite"></i>';
                addBtn.addEventListener("click", async (event) => {
                    event.stopPropagation();
                    addBtn.disabled = true;
                    const result = await chrome.runtime.sendMessage({
                        type: "ADD_TO_LIST",
                        listId: list.id,
                    });
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
