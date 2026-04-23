import { applyI18n } from "../shared/i18n";
import { displayVersion } from "../shared/popup-version";
import { getById } from "../shared/typed-getters";
import { bindToggle } from "../shared/ui";

document.addEventListener("DOMContentLoaded", async () => {
	applyI18n();
	displayVersion();

	// Default User Switch elements
	const userSwitchEnabled = getById<HTMLInputElement>("userSwitchEnabled");
	const userSwitchBody = getById<HTMLDivElement>("userSwitchBody");
	const userSwitchIndex = getById<HTMLInputElement>("userSwitchIndex");

	// Keyboard Shortcuts elements
	const shortcutsEnabled = getById<HTMLInputElement>("shortcutsEnabled");
	const shortcutsBody = getById<HTMLDivElement>("shortcutsBody");
	const shortcutsPrefix = getById<HTMLInputElement>("shortcutsPrefix");
	const demoPrefix = getById<HTMLSpanElement>("demoPrefix");

	// Bind toggles to storage
	await bindToggle(userSwitchEnabled, "userSwitch.enabled");
	await bindToggle(shortcutsEnabled, "keyboardShortcuts.enabled");

	// Handle body visibility
	const syncBodyVisibility = () => {
		userSwitchBody.classList.toggle("visible", userSwitchEnabled.checked);
		shortcutsBody.classList.toggle("visible", shortcutsEnabled.checked);
	};
	userSwitchEnabled.addEventListener("change", syncBodyVisibility);
	shortcutsEnabled.addEventListener("change", syncBodyVisibility);
	syncBodyVisibility();

	// Load initial values for inputs
	const storage = await chrome.storage.local.get([
		"userSwitch.userIndex",
		"keyboardShortcuts.prefixKey",
	]);

	if (storage["userSwitch.userIndex"] !== undefined) {
		userSwitchIndex.value = storage["userSwitch.userIndex"].toString();
	}

	if (storage["keyboardShortcuts.prefixKey"]) {
		shortcutsPrefix.value = storage["keyboardShortcuts.prefixKey"];
		demoPrefix.textContent = storage["keyboardShortcuts.prefixKey"];
	}

	// Save functions
	userSwitchIndex.addEventListener("change", async () => {
		let val = parseInt(userSwitchIndex.value, 10);
		if (isNaN(val) || val < 0) val = 0;
		if (val > 9) val = 9;
		userSwitchIndex.value = val.toString();
		await chrome.storage.local.set({ "userSwitch.userIndex": val });
	});

	shortcutsPrefix.addEventListener("input", async () => {
		let val = shortcutsPrefix.value.toLowerCase().replace(/[^a-z0-9]/g, "");
		if (val.length === 0) val = "u"; // default fallback
		if (val.length > 1) val = val[0];

		shortcutsPrefix.value = val;
		demoPrefix.textContent = val;
		await chrome.storage.local.set({ "keyboardShortcuts.prefixKey": val });
	});
});
