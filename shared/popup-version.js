export function displayVersion() {
	const version = chrome.runtime.getManifest().version;
	const el = document.getElementById("version-display");
	if (el) {
		el.textContent = version;
	}
}
