import { displayVersion } from "../shared/popup-version.js";
import { ApMessageType, sendTabMessage } from "./messaging";

document.addEventListener("DOMContentLoaded", async () => {
	displayVersion();
	const statusDot = document.getElementById("status-dot");
	const statusText = document.getElementById("status-text");
	const statusDetail = document.getElementById("status-detail");
	const statusContainer = document.getElementById("status-container");
	const notOnPageEl = document.getElementById("not-on-page");
	const actionSection = document.getElementById("action-section");
	const actionBtn = document.getElementById(
		"action-btn",
	) as HTMLButtonElement | null;
	const overlayToggle = document.getElementById(
		"overlay-toggle",
	) as HTMLInputElement | null;

	let currentTabId: number | null = null;

	// Initialize overlay toggle from storage
	if (overlayToggle) {
		const { showOverlay } = await chrome.storage.local.get({
			showOverlay: true,
		});
		overlayToggle.checked = showOverlay;

		overlayToggle.addEventListener("change", async () => {
			const visible = overlayToggle.checked;
			await chrome.storage.local.set({ showOverlay: visible });
			if (currentTabId) {
				await sendTabMessage<ApMessageType.SET_OVERLAY_VISIBLE>(currentTabId, {
					type: ApMessageType.SET_OVERLAY_VISIBLE,
					visible,
				});
			}
		});
	}

	async function updateStatus() {
		if (
			!statusDot ||
			!statusText ||
			!statusDetail ||
			!statusContainer ||
			!notOnPageEl ||
			!actionSection ||
			!actionBtn
		) {
			return;
		}

		try {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (!tab.id || !tab.url?.includes("apclassroom.collegeboard.org")) {
				statusContainer.style.display = "none";
				actionSection.style.display = "none";
				notOnPageEl.style.display = "block";
				return;
			}

			currentTabId = tab.id;
			statusContainer.style.display = "block";
			notOnPageEl.style.display = "none";

			const response = await sendTabMessage<ApMessageType.GET_STATE>(tab.id, {
				type: ApMessageType.GET_STATE,
			});

			if (response?.state) {
				const state = response.state;

				if (!state.initialized) {
					statusDot.className = "status-dot inactive";
					statusText.textContent = "Not Running";
					statusDetail.textContent = "";
					actionSection.style.display = "none";
				} else if (state.blocking?.length > 0) {
					statusDot.className = "status-dot blocking";
					statusText.textContent = `Blocking ${state.blocking.length} video${state.blocking.length !== 1 ? "s" : ""}`;
					statusDetail.textContent = "Progress requests are being intercepted.";
					actionSection.style.display = "block";
					actionBtn.textContent = "Reset";
					actionBtn.className = "btn-action blocking";
					actionBtn.disabled = false;
				} else if (state.videoId) {
					statusDot.className = "status-dot ready";
					statusText.textContent = "Ready";
					statusDetail.textContent = `Video ${state.videoId} detected.`;
					actionSection.style.display = "block";
					actionBtn.textContent = "Mark Complete";
					actionBtn.className = "btn-action";
					actionBtn.disabled = false;
				} else {
					statusDot.className = "status-dot active";
					statusText.textContent = "Monitoring";
					statusDetail.textContent = "Waiting for a video to play...";
					actionSection.style.display = "none";
				}
			} else {
				throw new Error("No response");
			}
		} catch (e) {
			console.log("Error getting state:", e);
			statusDot.className = "status-dot inactive";
			statusText.textContent = "Not Running";
			statusDetail.textContent = "";
			actionSection.style.display = "none";
		}
	}

	if (actionBtn) {
		actionBtn.addEventListener("click", async () => {
			if (!currentTabId) return;
			actionBtn.disabled = true;
			await sendTabMessage<ApMessageType.GET_STATE>(currentTabId, {
				type: ApMessageType.CLICK_BUTTON,
			});
			setTimeout(updateStatus, 300);
		});
	}

	await updateStatus();
	setInterval(updateStatus, 1000);
});
