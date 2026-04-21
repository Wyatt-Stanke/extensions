/** Show an element. */
export function show(element: HTMLElement, display = "block") {
	element.style.display = display;
}

/** Hide an element. */
export function hide(element: HTMLElement) {
	element.style.display = "none";
}

/** Bind a checkbox to chrome.storage.local with automatic persistence. */
export async function bindToggle(
	input: HTMLInputElement,
	storageKey: string,
	opts?: {
		defaultValue?: boolean;
		onChange?: (checked: boolean) => void;
	},
): Promise<void> {
	const defaultVal = opts?.defaultValue ?? true;
	const result = await chrome.storage.local.get({ [storageKey]: defaultVal });
	input.checked = result[storageKey];
	input.addEventListener("change", async () => {
		await chrome.storage.local.set({ [storageKey]: input.checked });
		opts?.onChange?.(input.checked);
	});
}
