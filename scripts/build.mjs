import esbuild from "esbuild";

const shared = {
    bundle: true,
    platform: "browser",
    treeShaking: true,
    logLevel: "info",
};

const css = [
    { src: "apclassroom/popup.css", out: "apclassroom/dist/popup.css" },
    { src: "collapse/popup.css", out: "collapse/dist/popup.css" },
    { src: "collapse/collapsed.css", out: "collapse/dist/collapsed.css" },
];

const entryPoints = [
    { src: "collapse/popup.ts", out: "collapse/dist/popup.js", globalName: "CollapsePopup" },
    { src: "collapse/collapsed.ts", out: "collapse/dist/collapsed.js", globalName: "CollapseList" },
    { src: "collapse/background.ts", out: "collapse/dist/background.js" },
    { src: "collapse/content.ts", out: "collapse/dist/content.js" },
    { src: "collapse/bridge.ts", out: "collapse/dist/bridge.js" },

    { src: "apclassroom/popup.ts", out: "apclassroom/dist/popup.js", globalName: "APClassroomPopup" },
    { src: "apclassroom/background.ts", out: "apclassroom/dist/background.js" },
    { src: "apclassroom/content.ts", out: "apclassroom/dist/content.js" },
    { src: "apclassroom/bridge.ts", out: "apclassroom/dist/bridge.js" },
];

await Promise.all([
    ...entryPoints.map(({ src, out, globalName }) => {
        const options = {
            ...shared,
            entryPoints: [src],
            outfile: out,
        };
        if (globalName) {
            options.format = "iife";
            options.globalName = globalName;
        }
        return esbuild.build(options);
    }),
    ...css.map(({ src, out }) =>
        esbuild.build({ ...shared, entryPoints: [src], outfile: out }),
    ),
]);
