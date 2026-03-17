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

await Promise.all([
    esbuild.build({
        ...shared,
        entryPoints: ["collapse/popup.js"],
        outfile: "collapse/dist/popup.js",
        format: "iife",
        globalName: "CollapsePopup",
    }),
    esbuild.build({
        ...shared,
        entryPoints: ["apclassroom/popup.js"],
        outfile: "apclassroom/dist/popup.js",
        format: "iife",
        globalName: "APClassroomPopup",
    }),
    ...css.map(({ src, out }) =>
        esbuild.build({ ...shared, entryPoints: [src], outfile: out }),
    ),
]);
