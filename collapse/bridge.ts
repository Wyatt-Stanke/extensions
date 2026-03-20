import { CollapseMessageType, onMessage } from "./messaging";

// Bridge between MAIN world content script (postMessage) and background (chrome.runtime)
onMessage(CollapseMessageType.GET_VIDEO_INFO, async (message, sender) => {
	return new Promise((resolve) => {
		window.postMessage(
			{ type: CollapseMessageType.COLLAPSE_GET_VIDEO_INFO },
			"*",
		);

		const handler = (event: MessageEvent) => {
			if (event.data?.type === CollapseMessageType.COLLAPSE_VIDEO_INFO) {
				window.removeEventListener("message", handler);
				resolve({ data: event.data.data });
			}
		};
		window.addEventListener("message", handler);

		// Timeout after 3 seconds if content script doesn't respond
		setTimeout(() => {
			window.removeEventListener("message", handler);
			resolve({ data: null });
		}, 3000);
	});
});

console.log("[Collapse] Bridge script initialized");
