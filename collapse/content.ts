import { CollapseMessageType } from "./messaging";

// Listens for requests from the bridge script to gather video info from the page DOM
window.addEventListener("message", (event) => {
	if (event.data?.type !== CollapseMessageType.COLLAPSE_GET_VIDEO_INFO) return;

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
	const playlistId = url.searchParams.get("list") || null;
	const playlistIndex = url.searchParams.get("index") || null;

	window.postMessage(
		{
			type: CollapseMessageType.COLLAPSE_VIDEO_INFO,
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
				playlistId,
				playlistIndex,
			},
		},
		"*",
	);
});

console.log("[Collapse] Content script initialized");
