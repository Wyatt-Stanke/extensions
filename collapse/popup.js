const YOUTUBE_VIDEO_PATTERN = /youtube\.com\/watch\?.*v=/;

document.addEventListener("DOMContentLoaded", async () => {
    // Display version
    const manifest = chrome.runtime.getManifest();
    document.getElementById("version-display").textContent = manifest.version;

    const tabCountEl = document.getElementById("tab-count");
    const collapseBtn = document.getElementById("collapse-btn");
    const listsSection = document.getElementById("lists-section");
    const listsContainer = document.getElementById("lists-container");

    // Count highlighted YouTube tabs
    const tabs = await chrome.tabs.query({
        highlighted: true,
        currentWindow: true,
    });
    const youtubeTabs = tabs.filter((tab) =>
        YOUTUBE_VIDEO_PATTERN.test(tab.url),
    );
    const count = youtubeTabs.length;

    tabCountEl.textContent = count;
    collapseBtn.textContent = `Collapse ${count} Tab${count !== 1 ? "s" : ""}`;
    collapseBtn.disabled = count === 0;

    // Collapse button handler
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
                collapseBtn.textContent = `Collapse ${count} Tab${count !== 1 ? "s" : ""}`;
                collapseBtn.disabled = count === 0;
            }, 2000);
        }
    });

    // Load existing lists
    const response = await chrome.runtime.sendMessage({ type: "GET_LISTS" });
    const lists = response?.lists || [];

    // Show "add to existing list" when tabs are selected and lists exist
    if (count > 0 && lists.length > 0) {
        const addToSection = document.getElementById("add-to-section");
        const addToContainer = document.getElementById("add-to-container");
        addToSection.style.display = "block";
        addToContainer.innerHTML = "";

        for (const list of lists) {
            const item = document.createElement("div");
            item.className = "add-to-item";
            item.addEventListener("click", async () => {
                const items = addToContainer.querySelectorAll(".add-to-item");
                for (const el of items) el.style.pointerEvents = "none";
                item.textContent = "Adding...";

                const res = await chrome.runtime.sendMessage({
                    type: "ADD_TO_LIST",
                    listId: list.id,
                });

                if (res?.success) {
                    window.close();
                } else {
                    item.textContent = res?.error || "Failed";
                    setTimeout(() => {
                        item.textContent = list.name;
                        for (const el of items) el.style.pointerEvents = "";
                    }, 2000);
                }
            });

            const name = document.createElement("span");
            name.className = "add-to-item-name";
            name.textContent = list.name;

            const badge = document.createElement("span");
            badge.className = "list-item-count";
            badge.textContent = `${list.videos.length} video${list.videos.length !== 1 ? "s" : ""}`;

            item.appendChild(name);
            item.appendChild(badge);
            addToContainer.appendChild(item);
        }
    }

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

            const count = document.createElement("span");
            count.className = "list-item-count";
            count.textContent = `${list.videos.length} video${list.videos.length !== 1 ? "s" : ""}`;

            item.appendChild(name);
            item.appendChild(count);
            listsContainer.appendChild(item);
        }
    }
});
