import {
	ApMessageType,
	type ApState,
	onMessage,
	sendMessage,
} from "./messaging";

let currentState: ApState = {
	initialized: false,
	videoId: null,
	blocking: [],
};

// Listen for state updates from the MAIN world content script
window.addEventListener("message", (event) => {
	if (event.data?.type === ApMessageType.AP_TOOLS_STATE) {
		currentState = event.data.state;

		// Send to background script for badge update
		sendMessage({
			type: ApMessageType.STATE_UPDATE,
			state: currentState,
		}).catch(() => {
			// Background might not be ready yet
		});
	}
});

// Listen for state requests from popup
onMessage(ApMessageType.GET_STATE, (_message) => {
	// Request fresh state from content script
	window.postMessage({ type: ApMessageType.AP_TOOLS_GET_STATE }, "*");

	// Return current cached state immediately
	return { state: currentState };
});

// Listen for click requests from popup
onMessage(ApMessageType.CLICK_BUTTON, (_message) => {
	window.postMessage({ type: ApMessageType.CLICK_BUTTON }, "*");
});

// Listen for overlay visibility changes from popup
onMessage(ApMessageType.SET_OVERLAY_VISIBLE, (message) => {
	window.postMessage(
		{ type: ApMessageType.SET_OVERLAY_VISIBLE, visible: message.visible },
		"*",
	);
});

// Send initial overlay visibility to content script
chrome.storage.local.get({ showOverlay: true }, (result) => {
	window.postMessage(
		{ type: ApMessageType.SET_OVERLAY_VISIBLE, visible: result.showOverlay },
		"*",
	);
});

// Send locale strings to the MAIN world (chrome.i18n is unavailable there)
const _localeKeys = [
	"btnWaiting",
	"btnSending",
	"btnMarkComplete",
	"btnStartPlaying",
	"btnBlockingReset",
	"alertNoDuration",
	"alertFailed",
	"alertError",
	"successReloading",
] as const;
const _localeStrings: Record<string, string> = {};
for (const key of _localeKeys) {
	_localeStrings[key] = chrome.i18n.getMessage(key);
}
window.postMessage(
	{ type: ApMessageType.AP_TOOLS_LOCALE_STRINGS, strings: _localeStrings },
	"*",
);

// Request initial state
setTimeout(() => {
	window.postMessage({ type: ApMessageType.AP_TOOLS_GET_STATE }, "*");
}, 100);

console.log("[AP Tools] Bridge script initialized");
