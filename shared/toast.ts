export type ToastType = "success" | "error" | "info";

const CONTAINER_ID = "ext-toast-container";

function getOrCreateContainer(): HTMLElement {
	let container = document.getElementById(CONTAINER_ID);
	if (!container) {
		container = document.createElement("div");
		container.id = CONTAINER_ID;
		container.style.cssText = [
			"position:fixed",
			"bottom:20px",
			"right:20px",
			"z-index:2147483647",
			"display:flex",
			"flex-direction:column",
			"gap:8px",
			"pointer-events:none",
		].join(";");
		document.body.appendChild(container);
	}
	return container;
}

const COLORS: Record<ToastType, { bg: string; border: string }> = {
	success: { bg: "rgba(76,175,80,0.93)", border: "#388e3c" },
	error: { bg: "rgba(229,57,53,0.93)", border: "#c62828" },
	info: { bg: "rgba(33,150,243,0.93)", border: "#1565c0" },
};

export function showToast(
	message: string,
	type: ToastType = "info",
	duration = 3500,
): void {
	const container = getOrCreateContainer();
	const { bg, border } = COLORS[type];

	const toast = document.createElement("div");
	toast.setAttribute("role", "alert");
	toast.setAttribute("aria-live", "assertive");
	toast.style.cssText = [
		`background:${bg}`,
		`border:1px solid ${border}`,
		"color:#fff",
		"padding:10px 16px",
		"border-radius:8px",
		"font-size:13px",
		"font-weight:500",
		'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
		"backdrop-filter:blur(8px)",
		"-webkit-backdrop-filter:blur(8px)",
		"box-shadow:0 2px 12px rgba(0,0,0,0.22)",
		"opacity:0",
		"transform:translateY(8px)",
		"transition:opacity 0.2s,transform 0.2s",
		"pointer-events:none",
		"max-width:320px",
		"word-break:break-word",
	].join(";");
	toast.textContent = message;
	container.appendChild(toast);

	// Trigger enter animation on next two frames (guarantees reflow)
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			toast.style.opacity = "1";
			toast.style.transform = "translateY(0)";
		});
	});

	setTimeout(() => {
		toast.style.opacity = "0";
		toast.style.transform = "translateY(8px)";
		setTimeout(() => toast.remove(), 250);
	}, duration);
}
