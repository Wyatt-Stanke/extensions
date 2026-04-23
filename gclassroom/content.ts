import { switchUserInUrl } from "../shared/classroom-url";

type Config = {
	enabled: boolean;
	prefixKey: string;
};

let config: Config = { enabled: false, prefixKey: "u" };
let pendingPrefix = false;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function isInputFocused() {
	const active = document.activeElement;
	if (!active) return false;
	if (
		active.tagName === "INPUT" ||
		active.tagName === "TEXTAREA" ||
		active.tagName === "SELECT"
	) {
		return true;
	}
	if ((active as HTMLElement).isContentEditable) {
		return true;
	}
	return false;
}

function clearPending() {
	pendingPrefix = false;
	if (pendingTimer) {
		clearTimeout(pendingTimer);
		pendingTimer = null;
	}
}

function handleKeydown(e: KeyboardEvent) {
	if (!config.enabled) return;
	if (isInputFocused()) return;

	if (
		!pendingPrefix &&
		e.key === config.prefixKey &&
		!e.ctrlKey &&
		!e.metaKey &&
		!e.altKey
	) {
		pendingPrefix = true;
		e.preventDefault();
		e.stopPropagation();

		pendingTimer = setTimeout(clearPending, 1500);
		return;
	}

	if (pendingPrefix) {
		if (e.key >= "0" && e.key <= "9") {
			const userIndex = parseInt(e.key, 10);
			const newUrl = switchUserInUrl(location.href, userIndex);
			if (newUrl !== location.href) {
				location.href = newUrl;
			}
			clearPending();
			e.preventDefault();
			e.stopPropagation();
		} else if (e.key === "Escape") {
			clearPending();
			e.preventDefault();
			e.stopPropagation();
		} else {
			// Some other key cancelled the operation
			clearPending();
		}
	}
}

async function loadConfig() {
	const storage = await chrome.storage.local.get([
		"keyboardShortcuts.enabled",
		"keyboardShortcuts.prefixKey",
	]);
	config.enabled = storage["keyboardShortcuts.enabled"] ?? false;
	config.prefixKey = storage["keyboardShortcuts.prefixKey"] || "u";
}

chrome.storage.onChanged.addListener((changes) => {
	if (changes["keyboardShortcuts.enabled"]) {
		config.enabled = changes["keyboardShortcuts.enabled"].newValue ?? false;
	}
	if (changes["keyboardShortcuts.prefixKey"]) {
		config.prefixKey = changes["keyboardShortcuts.prefixKey"].newValue || "u";
	}
});

loadConfig();
// Use capture phase to intercept before React/Classroom logic gets it
document.addEventListener("keydown", handleKeydown, true);
