import { ApMessageType } from "./messaging";
import { showToast } from "../shared/toast";

// ---------------------------------------------------------------------------
// Locale helper (MAIN world — chrome.i18n is not available here)
// English defaults used until the bridge sends the real locale strings.
// Falls back to the key name itself if a key is missing.
// ---------------------------------------------------------------------------
let _strings: Record<string, string> = {
	btnWaiting: "Waiting...",
	btnSending: "Sending...",
	btnMarkComplete: "Mark Complete",
	btnStartPlaying: "Start playing a video...",
	btnBlockingReset: "Blocking $1 — Reset",
	alertNoDuration:
		"Could not get video duration. Make sure the video is loaded.",
	alertFailed: "Failed: $1",
	alertError: "Error: $1",
	successReloading: "Video marked complete. Reloading...",
};

function msg(key: string, ...subs: string[]): string {
	let m = _strings[key] ?? key;
	for (let i = 0; i < subs.length; i++) {
		m = m.replace(`$${i + 1}`, subs[i]);
	}
	return m;
}
// ---------------------------------------------------------------------------

const state = {
	videoId: null as string | null,
	duration: null as number | null,
	blocking: [] as string[],
	capturedHeaders: {} as Record<string, string>,
	capturedBody: null as unknown,
	initialized: true,
};

// Send state updates to the bridge script
function broadcastState() {
	window.postMessage(
		{
			type: ApMessageType.AP_TOOLS_STATE,
			state: {
				initialized: state.initialized,
				videoId: state.videoId,
				blocking: state.blocking,
			},
		},
		"*",
	);
}

let overlayVisible = true;

// Listen for state requests from bridge
window.addEventListener("message", (event) => {
	if (event.data?.type === ApMessageType.AP_TOOLS_GET_STATE) {
		broadcastState();
	}
	if (event.data?.type === ApMessageType.AP_TOOLS_LOCALE_STRINGS) {
		_strings = { ..._strings, ...event.data.strings };
		updateButton();
	}
	if (event.data?.type === ApMessageType.CLICK_BUTTON) {
		handleClick();
	}
	if (event.data?.type === ApMessageType.SET_OVERLAY_VISIBLE) {
		overlayVisible = event.data.visible;
		const btn = document.getElementById("ap-tools-btn");
		if (btn) {
			btn.style.display = overlayVisible ? "flex" : "none";
		}
	}
});

// Intercept XMLHttpRequest
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;
const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

interface CustomXMLHttpRequest extends XMLHttpRequest {
	_url?: string;
	_method?: string;
	_headers?: Record<string, string>;
}

XMLHttpRequest.prototype.open = function (
	this: CustomXMLHttpRequest,
	method: string,
	url: string | URL,
	...rest: unknown[]
) {
	this._url = url.toString();
	this._method = method;
	this._headers = {};
	// @ts-expect-error
	return originalOpen.call(this, method, url, ...rest);
};

XMLHttpRequest.prototype.setRequestHeader = function (
	this: CustomXMLHttpRequest,
	name: string,
	value: string,
) {
	if (this._headers) {
		this._headers[name] = value;
	}
	return originalSetRequestHeader.call(this, name, value);
};

XMLHttpRequest.prototype.send = function (
	this: CustomXMLHttpRequest,
	body?: Document | XMLHttpRequestBodyInit | null,
) {
	if (this._url?.includes("/videos/") && this._url.includes("/progress")) {
		const match = this._url.match(/\/videos\/(\d+)\/progress/);

		if (match && state.blocking.includes(match[1])) {
			console.log("[AP Tools] Blocked progress request for video:", match[1]);
			Object.defineProperty(this, "status", { value: 200 });
			Object.defineProperty(this, "readyState", { value: 4 });
			Object.defineProperty(this, "responseText", { value: "{}" });
			setTimeout(() => {
				this.onreadystatechange?.(new Event("readystatechange"));
				this.onload?.(new ProgressEvent("load"));
			}, 10);
			return;
		}

		if (match) {
			state.capturedHeaders = { ...this._headers };
			try {
				state.capturedBody = typeof body === "string" ? JSON.parse(body) : body;
			} catch (_e) {
				state.capturedBody = body;
			}
			console.log("[AP Tools] Captured headers:", state.capturedHeaders);
			console.log("[AP Tools] Captured body structure:", state.capturedBody);

			if (!state.videoId) {
				state.videoId = match[1];
				console.log("[AP Tools] Found video ID:", state.videoId);
				updateButton();
				broadcastState();
			}
		}
	}
	return originalSend.call(this, body);
};

// Create and manage the button
let button: HTMLButtonElement | null = null;

function createButton() {
	if (document.getElementById("ap-tools-btn")) return;

	button = document.createElement("button");
	button.id = "ap-tools-btn";
	const dot = document.createElement("span");
	dot.className = "ap-tools-dot";
	const label = document.createElement("span");
	label.className = "ap-tools-label";
	label.textContent = msg("btnWaiting");
	button.append(dot, label);

	const style = document.createElement("style");
	style.textContent = `
		#ap-tools-btn {
			position: fixed;
			top: 14px;
			right: 14px;
			z-index: 999999;
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 14px;
			border: none;
			border-radius: 20px;
			font-size: 13px;
			font-weight: 600;
			cursor: not-allowed;
			background: rgba(0,0,0,0.65);
			color: rgba(255,255,255,0.55);
			backdrop-filter: blur(8px);
			-webkit-backdrop-filter: blur(8px);
			box-shadow: 0 2px 12px rgba(0,0,0,0.18);
			transition: background 0.2s, color 0.2s, transform 0.15s, box-shadow 0.2s;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			user-select: none;
		}
		#ap-tools-btn:hover:not(:disabled) {
			transform: translateY(-1px);
			box-shadow: 0 4px 16px rgba(0,0,0,0.25);
		}
		#ap-tools-btn:active:not(:disabled) {
			transform: translateY(0);
		}
		.ap-tools-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: #888;
			flex-shrink: 0;
			transition: background 0.2s;
		}
		.ap-tools-label {
			white-space: nowrap;
		}
		#ap-tools-btn.ap-ready {
			background: rgba(76,175,80,0.9);
			color: white;
			cursor: pointer;
		}
		#ap-tools-btn.ap-ready .ap-tools-dot {
			background: #c8e6c9;
		}
		#ap-tools-btn.ap-blocking {
			background: rgba(244,67,54,0.85);
			color: white;
			cursor: pointer;
		}
		#ap-tools-btn.ap-blocking .ap-tools-dot {
			background: #ffcdd2;
		}
		#ap-tools-btn.ap-sending {
			background: rgba(0,0,0,0.65);
			color: rgba(255,255,255,0.7);
			cursor: wait;
		}
		#ap-tools-btn.ap-sending .ap-tools-dot {
			background: #ffc107;
			animation: ap-pulse 1s ease-in-out infinite;
		}
		@keyframes ap-pulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.3; }
		}
	`;
	document.head.appendChild(style);

	button.disabled = true;
	button.onclick = handleClick;
	if (!overlayVisible) {
		button.style.display = "none";
	}
	document.body.appendChild(button);
}

function updateButton() {
	if (!button) {
		button = document.getElementById(
			"ap-tools-btn",
		) as HTMLButtonElement | null;
	}
	if (!button) return;

	const label = button.querySelector(".ap-tools-label");
	if (!label) return;

	if (state.blocking.length > 0) {
		button.className = "ap-blocking";
		label.textContent = msg("btnBlockingReset", String(state.blocking.length));
		button.disabled = false;
	} else if (state.videoId) {
		button.className = "ap-ready";
		label.textContent = msg("btnMarkComplete");
		button.disabled = false;
	} else {
		button.className = "";
		label.textContent = msg("btnStartPlaying");
		button.disabled = true;
	}
}

function getVideoDuration() {
	// Check main document first
	const video = document.querySelector("video");
	if (video?.duration && !Number.isNaN(video.duration)) {
		return Math.ceil(video.duration);
	}

	// Check inside iframes (e.g. Wistia player)
	try {
		const iframes = document.querySelectorAll("iframe, wistia-player iframe");
		for (const iframe of iframes) {
			try {
				const iframeVideo = (
					iframe as HTMLIFrameElement
				).contentDocument?.querySelector("video");
				if (iframeVideo?.duration && !Number.isNaN(iframeVideo.duration)) {
					return Math.ceil(iframeVideo.duration);
				}
			} catch (_e) {
				// Cross-origin iframe, skip
			}
		}
	} catch (_e) {
		console.log("[AP Tools] Error searching iframes for video:", _e);
	}

	// Check shadow DOMs (wistia-player is a custom element)
	try {
		const wistiaPlayers = document.querySelectorAll("wistia-player");
		for (const player of wistiaPlayers) {
			const shadowVideo = player.shadowRoot?.querySelector("video");
			if (shadowVideo?.duration && !Number.isNaN(shadowVideo.duration)) {
				return Math.ceil(shadowVideo.duration);
			}
		}
	} catch (e) {
		console.log("[AP Tools] Error searching shadow DOM for video:", e);
	}

	return null;
}

async function handleClick() {
	if (state.blocking.length > 0) {
		state.blocking = [];
		state.videoId = null;
		state.duration = null;
		state.capturedHeaders = {};
		state.capturedBody = null;
		console.log("[AP Tools] Reset - now searching for new video");
		updateButton();
		broadcastState();
		return;
	}

	if (!state.videoId) return;

	const duration = getVideoDuration();
	if (!duration) {
		showToast(msg("alertNoDuration"), "error");
		return;
	}

	const watchedSeconds = Array.from(
		{ length: duration },
		() => Math.floor(Math.random() * 2) + 1,
	);

	const requestBody = {
		...(state.capturedBody || {}),
		watched_seconds: watchedSeconds,
		playhead_position: "1.0000",
	};

	const url = `https://apc-api-production.collegeboard.org/fym/common/videos/${state.videoId}/progress/`;

	const headers = new Headers();

	for (const [name, value] of Object.entries(state.capturedHeaders)) {
		const skipHeaders = [
			"content-length",
			"host",
			"connection",
			"origin",
			"referer",
		];
		if (!skipHeaders.includes(name.toLowerCase())) {
			try {
				headers.set(name, value);
			} catch (e) {
				console.log("[AP Tools] Could not set header:", name, e);
			}
		}
	}

	if (!headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	console.log(
		"[AP Tools] Sending request with headers:",
		Object.fromEntries(headers.entries()),
	);
	console.log("[AP Tools] Request body:", requestBody);

	try {
		if (button) {
			const label = button.querySelector(".ap-tools-label");
			if (label) label.textContent = msg("btnSending");
			button.className = "ap-sending";
			button.disabled = true;
		}

		const response = await fetch(url, {
			method: "POST",
			headers: headers,
			credentials: "include",
			body: JSON.stringify(requestBody),
		});

		if (response.ok) {
			console.log(
				"[AP Tools] Successfully marked video",
				state.videoId,
				"as complete",
			);
			if (!state.blocking.includes(state.videoId)) {
				state.blocking = [...state.blocking, state.videoId];
			}
			updateButton();
			broadcastState();
			const closeBtn = document.querySelector<HTMLElement>(
				'[data-test-id="modal-close-button"]',
			);
			if (closeBtn) {
				closeBtn.click();
				console.log("[AP Tools] Clicked modal close button");
			}
			showToast(msg("successReloading"), "success");
			setTimeout(() => location.reload(), 500);
			return;
		} else {
			const text = await response.text();
			console.error("[AP Tools] Failed:", response.status, text);
			showToast(msg("alertFailed", String(response.status)), "error");
			updateButton();
		}
	} catch (e: unknown) {
		console.error("[AP Tools] Error:", e);
		showToast(msg("alertError", (e as Error).message), "error");
		updateButton();
	}
}

function init() {
	if (document.body) {
		createButton();
		updateButton();
		broadcastState();
	} else {
		document.addEventListener("DOMContentLoaded", () => {
			createButton();
			updateButton();
			broadcastState();
		});
	}
}

let lastUrl = location.href;
new MutationObserver(() => {
	if (location.href !== lastUrl) {
		lastUrl = location.href;
		if (state.blocking.length === 0) {
			state.videoId = null;
			state.duration = null;
			state.capturedHeaders = {};
			state.capturedBody = null;
			updateButton();
			broadcastState();
		}
	}
	if (document.body && !document.getElementById("ap-tools-btn")) {
		createButton();
		updateButton();
	}
}).observe(document, { subtree: true, childList: true });

init();
console.log("[AP Tools] Content script initialized");
