(function () {
    "use strict";

    // Listens for requests from the bridge script to gather video info from the page DOM
    window.addEventListener("message", (event) => {
        if (event.data?.type !== "COLLAPSE_GET_VIDEO_INFO") return;

        const video = document.querySelector("video");
        const currentTime = video?.currentTime || 0;
        const duration = video?.duration || 0;

        const titleEl =
            document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
            document.querySelector("#title h1 yt-formatted-string");
        const title = titleEl?.textContent?.trim() || document.title;

        const channelEl =
            document.querySelector("ytd-channel-name yt-formatted-string a") ||
            document.querySelector("#channel-name yt-formatted-string a");
        const channelName = channelEl?.textContent?.trim() || "";

        const url = new URL(window.location.href);
        const videoId = url.searchParams.get("v") || "";

        window.postMessage(
            {
                type: "COLLAPSE_VIDEO_INFO",
                data: {
                    videoId,
                    url: window.location.href,
                    title,
                    channelName,
                    thumbnailUrl: videoId
                        ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
                        : "",
                    currentTime,
                    duration,
                },
            },
            "*",
        );
    });

    // Alt+C on hovered YouTube link: add to most recent list
    let hoveredLink = null;

    document.addEventListener(
        "mouseover",
        (e) => {
            const anchor = e.target.closest('a[href*="/watch?"]');
            hoveredLink = anchor || null;
        },
        true,
    );

    document.addEventListener(
        "mouseout",
        (e) => {
            const anchor = e.target.closest('a[href*="/watch?"]');
            if (anchor === hoveredLink) {
                hoveredLink = null;
            }
        },
        true,
    );

    document.addEventListener("keydown", (e) => {
        if (!e.altKey || e.key.toLowerCase() !== "c") return;
        if (!hoveredLink) return;

        e.preventDefault();
        e.stopPropagation();

        const href = hoveredLink.href;
        if (!href) return;

        try {
            const url = new URL(href, window.location.origin);
            if (!url.searchParams.get("v")) return;

            const flashTarget = hoveredLink;
            flashTarget.style.transition = "color 0.15s ease, background-color 0.15s ease";
            flashTarget.style.color = "#3ea6ff";

            window.postMessage({ type: "COLLAPSE_ADD_HOVERED_LINK", url: url.href }, "*");

            const onResult = (event) => {
                if (event.data?.type !== "COLLAPSE_ADD_HOVERED_LINK_RESULT") return;
                window.removeEventListener("message", onResult);

                setTimeout(() => {
                    flashTarget.style.color = "";
                    setTimeout(() => {
                        flashTarget.style.transition = "";
                    }, 150);
                }, 400);
            };
            window.addEventListener("message", onResult);

            // Timeout fallback to reset style
            setTimeout(() => {
                window.removeEventListener("message", onResult);
                flashTarget.style.color = "";
                flashTarget.style.transition = "";
            }, 3000);
        } catch {
            // invalid URL, ignore
        }
    });

    console.log("[Collapse] Content script initialized");
})();
