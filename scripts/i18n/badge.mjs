/**
 * generate-i18n-badge.mjs — Generates an SVG status image for the README.
 *
 * Output: <repo>/.github/i18n-status.svg
 *
 * Embed in README.md with:
 *   ![Translation status](.github/i18n-status.svg)
 *
 * The badge shows one row per locale with a stacked progress bar:
 *   green  = reviewed
 *   yellow = ai-draft
 *   red    = outdated (source changed since draft/review)
 *   gray   = missing
 */

import fs from "node:fs";
import path from "node:path";
import {
	listExtensions,
	listLocales,
	loadMessages,
	REPO_ROOT,
	SOURCE_LOCALE,
	summarize,
} from "./utils.mjs";

const rows = [];

for (const ext of listExtensions()) {
	const source = loadMessages(ext, SOURCE_LOCALE);
	if (!source) {
		console.error(
			`FATAL: source locale '${SOURCE_LOCALE}' not found for ${ext}`,
		);
		process.exit(1);
	}

	const locales = listLocales(ext).sort((a, b) => {
		if (a === SOURCE_LOCALE) return -1;
		if (b === SOURCE_LOCALE) return 1;
		return a.localeCompare(b);
	});

	for (const l of locales) {
		rows.push(summarize(ext, l, source));
	}
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const PAD = 20;
const TITLE_H = 28; // Increased header spacing
const LEGEND_H = 22;
const DIVIDER_H = 14;
const ROW_H = 28;
const WIDTH = 620;
const HEIGHT = PAD * 2 + TITLE_H + LEGEND_H + DIVIDER_H + rows.length * ROW_H;

const LOCALE_X = PAD;
const BAR_X = PAD + 155; // Pushed bar further right to accommodate padding
const BAR_W = 240;
const barH = 12; // Extracted to top context
const COUNT_X = BAR_X + BAR_W + 14;
const PCT_X = WIDTH - PAD;

// Find max length for the extension column
const maxExtLen = Math.max(...rows.map((r) => r.ext.length));

// GitHub-dark-compatible colors (also readable on light backgrounds)
const C = {
	text: "var(--text)",
	muted: "var(--muted)",
	border: "var(--border)",
	reviewed: "var(--reviewed)",
	aiDraft: "var(--aiDraft)",
	outdated: "var(--outdated)",
	missing: "var(--missing)",
};

const FONT =
	"-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

const esc = (s) =>
	String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let svg = "";
svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Translation status">\n`;
svg += `<defs>
  <clipPath id="bar-clip">
    <rect x="0" y="0" width="${BAR_W}" height="${barH}" rx="3"/>
  </clipPath>
</defs>\n`;
svg += `<style>
  :root {
    --text: #e6edf3;
    --muted: #7d8590;
    --border: #30363d;
    --reviewed: #3fb950;
    --aiDraft: #d29922;
    --outdated: #f85149;
    --missing: #484f58;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --text: #1F2328;
      --muted: #656d76;
      --border: #d0d7de;
      --reviewed: #1a7f37;
      --aiDraft: #9a6700;
      --outdated: #d1242f;
      --missing: #afb8c1;
    }
  }
</style>\n`;
svg += `  <rect width="${WIDTH}" height="${HEIGHT}" rx="8" fill="transparent"/>\n`;
svg += `  <text x="${PAD}" y="${PAD + 16}" font-family="${FONT}" font-size="15" font-weight="600" fill="${C.text}">Translation Status</text>\n`;

// Legend (right side of title row)
const legendItems = [
	{ label: "reviewed", color: C.reviewed },
	{ label: "ai-draft", color: C.aiDraft },
	{ label: "outdated", color: C.outdated },
	{ label: "missing", color: C.missing },
];
let legendX = PAD;
const legendY = PAD + TITLE_H + 4;
for (const item of legendItems) {
	svg += `  <rect x="${legendX}" y="${legendY - 9}" width="10" height="10" rx="3" fill="${item.color}"/>\n`;
	svg += `  <text x="${legendX + 14}" y="${legendY}" font-family="${FONT}" font-size="11" fill="${C.muted}">${item.label}</text>\n`;
	legendX += 14 + 8 + item.label.length * 6.2 + 10;
}

// Divider
const dividerY = PAD + TITLE_H + LEGEND_H + 4;
svg += `  <line x1="${PAD}" y1="${dividerY}" x2="${WIDTH - PAD}" y2="${dividerY}" stroke="${C.border}" stroke-width="1"/>\n`;

// Rows
rows.forEach((r, i) => {
	const rowTop = dividerY + DIVIDER_H + i * ROW_H;
	const textY = rowTop + 17;
	const barY = rowTop + 7;

	// Locale code (using xml:space="preserve" to enforce mono width)
	svg += `  <text x="${LOCALE_X}" y="${textY}" font-family="${MONO}" font-size="12" font-weight="500" fill="${C.text}" xml:space="preserve">${esc(r.ext).padEnd(maxExtLen, " ")} <tspan fill="${C.muted}">/ </tspan>${esc(r.locale)}</text>\n`;

	// Bar background
	svg += `  <rect x="${BAR_X}" y="${barY}" width="${BAR_W}" height="${barH}" rx="3" fill="${C.missing}"/>\n`;

	if (r.isSource) {
		svg += `  <rect x="${BAR_X}" y="${barY}" width="${BAR_W}" height="${barH}" rx="3" fill="${C.reviewed}"/>\n`;
		svg += `  <text x="${COUNT_X}" y="${textY}" font-family="${MONO}" font-size="11" fill="${C.muted}">${r.total} keys</text>\n`;
		svg += `  <text x="${PCT_X}" y="${textY}" text-anchor="end" font-family="${FONT}" font-size="11" font-weight="600" fill="${C.muted}">source</text>\n`;
	} else {
		svg += `  <g transform="translate(${BAR_X}, ${barY})" clip-path="url(#bar-clip)">\n`;
		let xCur = 0;
		const segs = [
			{ n: r.reviewed, color: C.reviewed },
			{ n: r.aiDraft, color: C.aiDraft },
			{ n: r.outdated, color: C.outdated },
		];
		for (const s of segs) {
			if (s.n <= 0) continue;
			const w = (s.n / r.total) * BAR_W;
			svg += `    <rect x="${xCur.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barH}" fill="${s.color}"/>\n`;
			xCur += w;
		}
		svg += `  </g>\n`;
		const pct = Math.round((r.reviewed / r.total) * 100);
		const countParts = [];
		if (r.reviewed) countParts.push(`${r.reviewed} reviewed`);
		if (r.aiDraft) countParts.push(`${r.aiDraft} ai`);
		if (r.outdated) countParts.push(`${r.outdated} outdated`);
		if (r.missing) countParts.push(`${r.missing} missing`);

		svg += `  <text x="${COUNT_X}" y="${textY}" font-family="${MONO}" font-size="11" fill="${C.muted}">${esc(countParts.join(", "))}</text>\n`;
		svg += `  <text x="${PCT_X}" y="${textY}" text-anchor="end" font-family="${FONT}" font-size="11" font-weight="600" fill="${C.text}">${pct}%</text>\n`;
	}
});

svg += "</svg>\n";

const outDir = path.join(REPO_ROOT, ".github");
const outPath = path.join(outDir, "i18n-status.svg");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, svg);

console.log(
	`✓ wrote ${path.relative(REPO_ROOT, outPath)} (${rows.length} locales across extensions)`,
);
