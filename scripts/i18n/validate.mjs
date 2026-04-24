#!/usr/bin/env node
import {
	extractTags,
	extractTokens,
	keyStatus,
	listExtensions,
	listLocales,
	loadMessages,
	loadStatus,
	SOURCE_LOCALE,
} from "./utils.mjs";

const errors = [];
const warnings = [];

for (const ext of listExtensions()) {
	const source = loadMessages(ext, SOURCE_LOCALE);
	if (!source) {
		errors.push(`FATAL: source locale '${SOURCE_LOCALE}' not found for ${ext}`);
		continue;
	}

	for (const [key, entry] of Object.entries(source)) {
		if (typeof entry !== "object" || entry === null) {
			errors.push(`[${ext}/${SOURCE_LOCALE}] '${key}': entry is not an object`);
			continue;
		}
		if (typeof entry.message !== "string" || !entry.message) {
			errors.push(
				`[${ext}/${SOURCE_LOCALE}] '${key}': missing or empty "message" field`,
			);
			continue;
		}
		const usedTokens = extractTokens(entry.message);
		const declaredTokens = entry.placeholders
			? Object.keys(entry.placeholders)
					.map((k) => `$${k.toUpperCase()}$`)
					.sort()
			: [];
		for (const tok of usedTokens) {
			if (!declaredTokens.includes(tok)) {
				errors.push(
					`[${ext}/${SOURCE_LOCALE}] '${key}': token ${tok} used but not declared in placeholders`,
				);
			}
		}
		for (const tok of declaredTokens) {
			if (!usedTokens.includes(tok)) {
				warnings.push(
					`[${ext}/${SOURCE_LOCALE}] '${key}': placeholder ${tok} declared but never used`,
				);
			}
		}
	}

	for (const locale of listLocales(ext)) {
		if (locale === SOURCE_LOCALE) continue;

		const target = loadMessages(ext, locale);
		if (!target) {
			errors.push(`[${ext}/${locale}] messages.json not found`);
			continue;
		}
		const status = loadStatus(ext, locale);

		for (const key of Object.keys(source)) {
			if (!(key in target))
				errors.push(`[${ext}/${locale}] missing key: ${key}`);
		}
		for (const key of Object.keys(target)) {
			if (!(key in source))
				errors.push(
					`[${ext}/${locale}] extra key not in ${SOURCE_LOCALE}: ${key}`,
				);
		}

		for (const key of Object.keys(source)) {
			const srcEntry = source[key];
			const tgtEntry = target[key];
			if (!tgtEntry) continue;

			if (typeof tgtEntry.message !== "string" || !tgtEntry.message.trim()) {
				errors.push(
					`[${ext}/${locale}] '${key}': empty or missing translation`,
				);
				continue;
			}
			if (
				tgtEntry.message === srcEntry.message &&
				srcEntry.message.length > 3
			) {
				warnings.push(
					`[${ext}/${locale}] '${key}': translation identical to source (likely untranslated)`,
				);
			}

			const srcTokens = extractTokens(srcEntry.message);
			const tgtTokens = extractTokens(tgtEntry.message);
			if (JSON.stringify(srcTokens) !== JSON.stringify(tgtTokens)) {
				errors.push(
					`[${ext}/${locale}] '${key}': placeholder tokens differ — src=[${srcTokens.join(",")}] tgt=[${tgtTokens.join(",")}]`,
				);
			}

			const srcTags = extractTags(srcEntry.message);
			const tgtTags = extractTags(tgtEntry.message);
			if (JSON.stringify(srcTags) !== JSON.stringify(tgtTags)) {
				errors.push(
					`[${ext}/${locale}] '${key}': HTML tags differ — src=[${srcTags.join(",")}] tgt=[${tgtTags.join(",")}]`,
				);
			}

			const srcPh = srcEntry.placeholders
				? Object.keys(srcEntry.placeholders).sort()
				: [];
			const tgtPh = tgtEntry.placeholders
				? Object.keys(tgtEntry.placeholders).sort()
				: [];
			if (JSON.stringify(srcPh) !== JSON.stringify(tgtPh)) {
				errors.push(
					`[${ext}/${locale}] '${key}': placeholders object keys differ — src=[${srcPh}] tgt=[${tgtPh}]`,
				);
			}

			const st = keyStatus(key, srcEntry, target, status);
			if (st === "outdated") {
				warnings.push(
					`[${ext}/${locale}] '${key}': source changed since last review/draft — needs retranslation`,
				);
			}
		}

		for (const key of Object.keys(status)) {
			if (!(key in source)) {
				warnings.push(
					`[${ext}/${locale}] orphaned status entry for removed key: ${key}`,
				);
			}
		}

		for (const [key, rec] of Object.entries(status)) {
			if (!rec || typeof rec !== "object") {
				errors.push(
					`[${ext}/${locale}] status entry for '${key}' is not an object`,
				);
				continue;
			}
			if (!["reviewed", "ai-draft"].includes(rec.status)) {
				errors.push(
					`[${ext}/${locale}] status entry for '${key}' has invalid status '${rec.status}'`,
				);
			}
			if (typeof rec.source_hash !== "string" || rec.source_hash.length === 0) {
				errors.push(
					`[${ext}/${locale}] status entry for '${key}' missing source_hash`,
				);
			}
		}
	}
}

if (warnings.length) {
	console.error("Warnings:");
	for (const w of warnings) console.error(`  ⚠ ${w}`);
	console.error("");
}

if (errors.length) {
	console.error("Errors:");
	for (const e of errors) console.error(`  ✗ ${e}`);
	console.error(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
	process.exit(1);
}

console.log(`✓ i18n OK — ${warnings.length} warning(s)`);
