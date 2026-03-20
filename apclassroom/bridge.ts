import { ApMessageType, ApState, onMessage, sendMessage } from "./messaging";

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
onMessage(ApMessageType.GET_STATE, (message) => {
	// Request fresh state from content script
	window.postMessage({ type: ApMessageType.AP_TOOLS_GET_STATE }, "*");

	// Return current cached state immediately
	return { state: currentState };
});

// Request initial state
setTimeout(() => {
	window.postMessage({ type: ApMessageType.AP_TOOLS_GET_STATE }, "*");
}, 100);

console.log("[AP Tools] Bridge script initialized");
