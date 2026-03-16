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

    console.log("[Collapse] Content script initialized");
})();
