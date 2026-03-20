import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const sizes = [16, 32, 48, 128];

const entries = readdirSync(rootDir, { withFileTypes: true });
for (const entry of entries) {
	if (!entry.isDirectory()) continue;
	const svgPath = join(rootDir, entry.name, "icon.svg");
	try {
		readFileSync(svgPath);
	} catch {
		continue;
	}

	const outDir = join(rootDir, entry.name, "dist", "icons");

	mkdirSync(outDir, { recursive: true });

	const svgBuffer = readFileSync(svgPath);
	await Promise.all(
		sizes.map((size) =>
			sharp(svgBuffer)
				.resize(size, size)
				.png()
				.toFile(join(outDir, `icon${size}.png`)),
		),
	);
	console.log(
		`Generated icons for ${entry.name}: ${sizes.map((s) => `${s}x${s}`).join(", ")}`,
	);
}
