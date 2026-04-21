import esbuild from "esbuild";

const shared = {
	bundle: true,
	platform: "browser",
	format: "iife",
	treeShaking: true,
	logLevel: "info",
};

const jsShared = {
	...shared,
	jsx: "transform",
	jsxFactory: "jsx",
	jsxFragment: "Fragment",
	loader: {
		".html": "text",
		".css": "text",
	},
};

const css = [
	{ src: "apclassroom/popup.css", out: "apclassroom/dist/popup.css" },
	{ src: "collapse/popup.css", out: "collapse/dist/popup.css" },
	{ src: "collapse/collapsed.css", out: "collapse/dist/collapsed.css" },
];

const entryPoints = [
	{
		src: "collapse/popup.tsx",
		out: "collapse/dist/popup.js",
		globalName: "CollapsePopup",
	},
	{
		src: "collapse/collapsed.ts",
		out: "collapse/dist/collapsed.js",
		globalName: "CollapseList",
	},
	{ src: "collapse/background.ts", out: "collapse/dist/background.js" },
	{ src: "collapse/content.ts", out: "collapse/dist/content.js" },
	{ src: "collapse/bridge.ts", out: "collapse/dist/bridge.js" },

	{
		src: "apclassroom/popup.ts",
		out: "apclassroom/dist/popup.js",
		globalName: "APClassroomPopup",
	},
	{ src: "apclassroom/background.ts", out: "apclassroom/dist/background.js" },
	{ src: "apclassroom/content.ts", out: "apclassroom/dist/content.js" },
	{ src: "apclassroom/bridge.ts", out: "apclassroom/dist/bridge.js" },
];

for (const { src, out, globalName } of entryPoints) {
	const options = {
		...jsShared,
		entryPoints: [src],
		outfile: out,
	};
	if (globalName) {
		options.format = "iife";
		options.globalName = globalName;
	}
	await esbuild.build(options);
}

for (const { src, out } of css) {
	await esbuild.build({ ...shared, entryPoints: [src], outfile: out });
}
