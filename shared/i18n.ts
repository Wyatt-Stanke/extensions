/**
 * Retrieve a localized string from chrome.i18n.
 * @param key - Message key matching a key in _locales/{locale}/messages.json
 * @param substitutions - Values substituted in order for $PLACEHOLDER$ entries
 */
export function t(key: string, substitutions?: string | string[]): string {
	return chrome.i18n.getMessage(key, substitutions) || key;
}

/**
 * Walk `root` and replace the text/HTML of every element that carries one of:
 *   - `data-i18n="key"`      → sets textContent to the translated string
 *   - `data-i18n-html="key"` → sets innerHTML  (use only for trusted extension strings)
 *
 * Call once inside DOMContentLoaded.
 */
export function applyI18n(root: ParentNode = document): void {
	for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
		const key = el.dataset.i18n;
		if (!key) continue;
		const msg = chrome.i18n.getMessage(key);
		if (msg) el.textContent = msg;
	}
	for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-html]")) {
		const key = el.dataset.i18nHtml;
		if (!key) continue;
		const msg = chrome.i18n.getMessage(key);
		if (msg) el.innerHTML = msg;
	}
}
