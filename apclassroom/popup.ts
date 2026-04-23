import { displayVersion } from "../shared/popup-version.js";
import { applyI18n, t } from "../shared/i18n";
import { bindToggle, hide, show } from "../shared/ui";
import { ApMessageType, sendTabMessage } from "./messaging";

document.addEventListener("DOMContentLoaded", async () => {
	applyI18n();
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

	if (overlayToggle) {
		await bindToggle(overlayToggle, "showOverlay", {
			onChange: async (visible) => {
				if (currentTabId) {
					await sendTabMessage<ApMessageType.SET_OVERLAY_VISIBLE>(
						currentTabId,
						{ type: ApMessageType.SET_OVERLAY_VISIBLE, visible },
					);
				}
			},
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
				hide(statusContainer);
				hide(actionSection);
				show(notOnPageEl);
				return;
			}

			currentTabId = tab.id;
			show(statusContainer);
			hide(notOnPageEl);

			const response = await sendTabMessage<ApMessageType.GET_STATE>(tab.id, {
				type: ApMessageType.GET_STATE,
			});

			if (response?.state) {
				const state = response.state;

				if (!state.initialized) {
					statusDot.className = "status-dot inactive";
					statusText.textContent = t("statusNotRunning");
					statusDetail.textContent = "";
					hide(actionSection);
				} else if (state.blocking?.length > 0) {
					const count = state.blocking.length;
					statusDot.className = "status-dot blocking";
					statusText.textContent = t(
						count === 1 ? "statusBlockingSingular" : "statusBlockingPlural",
						[String(count)],
					);
					statusDetail.textContent = t("statusBlockingDetail");
					show(actionSection);
					actionBtn.textContent = t("btnReset");
					actionBtn.className = "btn btn-danger";
					actionBtn.disabled = false;
				} else if (state.videoId) {
					statusDot.className = "status-dot ready";
					statusText.textContent = t("statusReady");
					statusDetail.textContent = t("statusVideoDetected", [state.videoId]);
					show(actionSection);
					actionBtn.textContent = t("btnMarkComplete");
					actionBtn.className = "btn";
					actionBtn.disabled = false;
				} else {
					statusDot.className = "status-dot active";
					statusText.textContent = t("statusMonitoring");
					statusDetail.textContent = t("statusWaitingVideo");
					hide(actionSection);
				}
			} else {
				throw new Error("No response");
			}
		} catch (e) {
			console.log("Error getting state:", e);
			statusDot.className = "status-dot inactive";
			statusText.textContent = t("statusNotRunning");
			statusDetail.textContent = "";
			hide(actionSection);
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
