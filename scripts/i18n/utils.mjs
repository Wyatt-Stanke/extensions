/**
 * Shared i18n utilities used by validate, badge, and translate scripts.
 *
 * Repo layout assumptions:
 *   <repo>/_locales/<locale>/messages.json   (Chrome i18n source of truth)
 *   <repo>/i18n-status/<locale>.json         (sidecar: per-key status; NOT shipped)
 *
 * The source locale is 'en'. It has no status file — English is canonical.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const SOURCE_LOCALE = "en";

export const VALID_STATUSES = new Set([
	"reviewed",
	"ai-draft",
	"outdated",
	"missing",
]);

/** List folders in root that have a `_locales/en/messages.json` file. */
export function listExtensions() {
	return fs
		.readdirSync(REPO_ROOT)
		.filter((name) => {
			if (name.startsWith(".") || name === "node_modules") return false;
			const p = path.join(
				REPO_ROOT,
				name,
				"_locales",
				SOURCE_LOCALE,
				"messages.json",
			);
			return fs.existsSync(p);
		})
		.sort();
}

/** Get path to an extension's _locales folder */
export function getLocalesDir(ext) {
	return path.join(REPO_ROOT, ext, "_locales");
}

/** Get path to an extension's i18n-status folder */
export function getStatusDir(ext) {
	return path.join(REPO_ROOT, ext, "i18n-status");
}

export function listLocales(ext) {
	const dir = getLocalesDir(ext);
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir)
		.filter((d) => fs.statSync(path.join(dir, d)).isDirectory())
		.sort();
}

export function messagesPath(ext, locale) {
	return path.join(getLocalesDir(ext), locale, "messages.json");
}

export function statusPath(ext, locale) {
	return path.join(getStatusDir(ext), `${locale}.json`);
}

export function loadMessages(ext, locale) {
	const p = messagesPath(ext, locale);
	if (!fs.existsSync(p)) return null;
	return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function loadStatus(ext, locale) {
	const p = statusPath(ext, locale);
	if (!fs.existsSync(p)) return {};
	return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function saveMessages(ext, locale, data) {
	const p = messagesPath(ext, locale);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, `${JSON.stringify(data, null, "\t")}\n`);
}

export function saveStatus(ext, locale, data) {
	fs.mkdirSync(getStatusDir(ext), { recursive: true });
	// Sort keys so diffs stay clean
	const sorted = {};
	for (const k of Object.keys(data).sort()) sorted[k] = data[k];
	fs.writeFileSync(
		statusPath(ext, locale),
		`${JSON.stringify(sorted, null, "\t")}\n`,
	);
}

/**
 * Hash the canonical form of a source message. If this changes, any
 * translation of that key should be treated as outdated regardless of
 * its stored status.
 */
export function hashMessage(msg) {
	const canonical = JSON.stringify({
		message: msg.message,
		placeholders: msg.placeholders || null,
	});
	return crypto
		.createHash("sha256")
		.update(canonical)
		.digest("hex")
		.slice(0, 12);
}

/** Extract $TOKEN$ placeholders from a message string, normalized and sorted. */
export function extractTokens(str) {
	return (str.match(/\$[A-Za-z0-9_]+\$/g) || [])
		.map((s) => s.toUpperCase())
		.sort();
}

/** Extract HTML tags from a message string, normalized and sorted. */
export function extractTags(str) {
	return (str.match(/<\/?[a-z][^>]*>/gi) || [])
		.map((t) => t.toLowerCase().replace(/\s+/g, " "))
		.sort();
}

/**
 * Returns the effective status of a single key:
 *   'missing'   — key absent in target
 *   'outdated'  — source hash differs from the one recorded at draft/review time
 *   'ai-draft'  — key present but not yet reviewed (or no status recorded)
 *   'reviewed'  — key marked reviewed AND source hash matches
 */
export function keyStatus(key, sourceEntry, targetMessages, statusData) {
	if (!targetMessages[key]) return "missing";
	const rec = statusData[key];
	const currentHash = hashMessage(sourceEntry);
	if (!rec) return "ai-draft";
	if (rec.source_hash !== currentHash) return "outdated";
	if (!VALID_STATUSES.has(rec.status)) return "ai-draft";
	return rec.status;
}

/** Aggregate per-key statuses for a locale. */
export function summarize(ext, locale, source) {
	if (locale === SOURCE_LOCALE) {
		const total = Object.keys(source).length;
		return {
			ext,
			locale,
			total,
			reviewed: total,
			aiDraft: 0,
			outdated: 0,
			missing: 0,
			isSource: true,
		};
	}
	const target = loadMessages(ext, locale) || {};
	const status = loadStatus(ext, locale);
	const counts = { reviewed: 0, "ai-draft": 0, outdated: 0, missing: 0 };
	for (const key of Object.keys(source)) {
		const st = keyStatus(key, source[key], target, status);
		counts[st] = (counts[st] || 0) + 1;
	}
	return {
		ext,
		locale,
		total: Object.keys(source).length,
		reviewed: counts.reviewed,
		aiDraft: counts["ai-draft"],
		outdated: counts.outdated,
		missing: counts.missing,
		isSource: false,
	};
}
