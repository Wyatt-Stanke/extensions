export const CLASSROOM_ORIGIN = "https://classroom.google.com";

/**
 * Updates the user index in an existing Classroom URL, or inserts it if missing.
 * Does not modify non-Classroom URLs.
 */
export function switchUserInUrl(url: string, targetUserIndex: number): string {
	try {
		const parsed = new URL(url);
		if (parsed.origin !== CLASSROOM_ORIGIN) {
			return url;
		}

		const path = parsed.pathname;

		// If path matches /u/N/...
		const match = /^\/u\/\d+(\/.*)?$/.exec(path);
		if (match) {
			const rest = match[1] || "/";
			return `${CLASSROOM_ORIGIN}/u/${targetUserIndex}${rest}${parsed.search}${parsed.hash}`;
		}

		// If path is empty or /
		if (path === "" || path === "/") {
			return `${CLASSROOM_ORIGIN}/u/${targetUserIndex}/${parsed.search}${parsed.hash}`;
		}

		// Otherwise insert /u/N before the path
		return `${CLASSROOM_ORIGIN}/u/${targetUserIndex}${path.startsWith("/") ? path : `/${path}`}${parsed.search}${parsed.hash}`;
	} catch (_e) {
		return url;
	}
}
