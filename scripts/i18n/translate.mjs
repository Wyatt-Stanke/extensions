/**
 * translate-i18n.mjs — Fills missing/outdated keys in each target locale
 * using the Claude API. Writes drafts to messages.json and records per-key
 * status (ai-draft + source_hash) in i18n-status/<locale>.json.
 *
 * Usage:
 *   node scripts/translate-i18n.mjs               # all non-source locales
 *   node scripts/translate-i18n.mjs --locale ko   # one locale
 *   node scripts/translate-i18n.mjs --dry-run     # show what would change
 *
 * Requires: npm i @anthropic-ai/sdk   and  ANTHROPIC_API_KEY in env.
 *
 * Design notes:
 *   - English is the source of truth. Keys with status 'reviewed' that still
 *     match the source hash are left ALONE — we never overwrite human work.
 *   - Only 'missing' and 'outdated' keys are sent to the model.
 *   - The existing locale file is included as style/terminology context so
 *     the model keeps vocabulary consistent with previously-approved work.
 *   - Each key's new status is written with the current source_hash, so the
 *     next edit to English automatically flips it back to 'outdated'.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
	hashMessage,
	keyStatus,
	listExtensions,
	listLocales,
	loadMessages,
	loadStatus,
	SOURCE_LOCALE,
	saveMessages,
	saveStatus,
} from "./utils.mjs";

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 4096;

// Extend as you add locales. The descriptive name steers the model toward
// the right regional variant.
const LANGUAGE_NAMES = {
	es: "Spanish (Latin American, neutral)",
	zh_CN: "Simplified Chinese (Mainland China, Mandarin)",
	zh_TW: "Traditional Chinese (Taiwan / Hong Kong)",
	ko: "Korean (South Korea)",
	ja: "Japanese",
	vi: "Vietnamese",
	pt_BR: "Brazilian Portuguese",
	fr: "French (France)",
	de: "German (Germany)",
};

// ─── CLI parsing ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const localeFlag = args.indexOf("--locale");
const onlyLocale = localeFlag !== -1 ? args[localeFlag + 1] : null;

// ─── Claude call ──────────────────────────────────────────────────────────────
async function callClaude(client, ext, locale, needed, existingTarget) {
	const languageName = LANGUAGE_NAMES[locale] || locale;

	// Only show the model keys that ARE reliable (reviewed or drafted against
	// the current source), so it doesn't mimic stale translations.
	const styleContext = {};
	for (const [k, v] of Object.entries(existingTarget)) {
		if (!needed[k]) styleContext[k] = v;
	}

	const prompt = [
		`You are translating UI strings for a Chrome extension.`,
		``,
		`Target language: ${languageName}`,
		``,
		`Rules:`,
		`1. Preserve every placeholder token EXACTLY: $COUNT$, $VIDEO_ID$, $CODE$, $ERR$, etc. Do not translate, rename, or alter them. Keep them in a natural position in the target sentence.`,
		`2. Preserve every HTML tag EXACTLY, including <strong>...</strong>. The content inside tags should be translated; the tags themselves must not change.`,
		`3. Preserve the "placeholders" object unchanged when present.`,
		`4. Prefer natural, native-sounding UI phrasing. This is interface text — clarity and brevity matter more than literal fidelity.`,
		`5. Match the terminology and register of the existing translations below for consistency.`,
		`6. For short button labels, match the register of the target language's OS/browser UI conventions.`,
		``,
		`Existing translations in this locale (style & glossary reference):`,
		`\`\`\`json`,
		JSON.stringify(styleContext, null, 2),
		`\`\`\``,
		``,
		`Translate these English entries. Return ONLY a JSON object mapping each key to its translated entry in Chrome i18n format (with "message" and, when the source has one, the same "placeholders" object). No prose, no markdown fences, no explanation.`,
		``,
		`Source entries to translate:`,
		`\`\`\`json`,
		JSON.stringify(needed, null, 2),
		`\`\`\``,
	].join("\n");

	const response = await client.messages.create({
		model: MODEL,
		max_tokens: MAX_TOKENS,
		messages: [{ role: "user", content: prompt }],
	});

	const text = response.content
		.filter((b) => b.type === "text")
		.map((b) => b.text)
		.join("")
		.trim();

	// Strip markdown fences if the model added them despite instructions
	const jsonText = text
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```\s*$/, "")
		.trim();

	try {
		return JSON.parse(jsonText);
	} catch (err) {
		console.error(`[${ext}/${locale}] failed to parse model output as JSON:`);
		console.error(text);
		throw err;
	}
}

// ─── Per-locale processing ────────────────────────────────────────────────────
async function processLocale(client, ext, locale, source) {
	const target = loadMessages(ext, locale) || {};
	const status = loadStatus(ext, locale);

	// Collect keys needing work
	const needed = {};
	const reasons = {};
	for (const [key, entry] of Object.entries(source)) {
		const st = keyStatus(key, entry, target, status);
		if (st === "missing" || st === "outdated") {
			needed[key] = entry;
			reasons[key] = st;
		}
	}

	const needCount = Object.keys(needed).length;
	if (needCount === 0) {
		console.log(`[${ext}/${locale}] up to date`);
		return;
	}

	console.log(`[${ext}/${locale}] ${needCount} key(s) to translate:`);
	for (const key of Object.keys(needed)) {
		console.log(`    ${reasons[key].padEnd(8)} ${key}`);
	}

	if (dryRun) {
		console.log(`[${ext}/${locale}] --dry-run, skipping API call`);
		return;
	}

	const translations = await callClaude(client, ext, locale, needed, target);

	// Apply translations
	const now = new Date().toISOString().slice(0, 10);
	let applied = 0;
	for (const [key, entry] of Object.entries(translations)) {
		if (!source[key]) {
			console.warn(
				`[${ext}/${locale}] model returned unknown key '${key}', skipping`,
			);
			continue;
		}
		if (!entry || typeof entry.message !== "string") {
			console.warn(
				`[${ext}/${locale}] model returned malformed entry for '${key}', skipping`,
			);
			continue;
		}
		target[key] = entry;
		status[key] = {
			status: "ai-draft",
			model: MODEL,
			updated: now,
			source_hash: hashMessage(source[key]),
		};
		applied++;
	}

	// Garbage-collect keys that no longer exist in source
	let removed = 0;
	for (const key of Object.keys(target)) {
		if (!(key in source)) {
			delete target[key];
			removed++;
		}
	}
	for (const key of Object.keys(status)) {
		if (!(key in source)) {
			delete status[key];
		}
	}

	saveMessages(ext, locale, target);
	saveStatus(ext, locale, status);
	console.log(
		`[${ext}/${locale}] wrote ${applied} key(s)${removed ? `, removed ${removed} orphan(s)` : ""}`,
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
try {
	if (!process.env.ANTHROPIC_API_KEY) {
		console.error("ERROR: set ANTHROPIC_API_KEY in your environment.");
		process.exit(1);
	}

	const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

	for (const ext of listExtensions()) {
		const source = loadMessages(ext, SOURCE_LOCALE);
		if (!source) {
			console.error(
				`FATAL: source locale '${SOURCE_LOCALE}' not found for ${ext}`,
			);
			continue;
		}
		const targets = (onlyLocale ? [onlyLocale] : listLocales(ext)).filter(
			(l) => l !== SOURCE_LOCALE,
		);
		for (const locale of targets) {
			await processLocale(client, ext, locale, source);
		}
	}
} catch (err) {
	console.error(err);
	process.exit(1);
}
