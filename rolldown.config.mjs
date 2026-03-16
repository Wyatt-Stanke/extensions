import { defineConfig } from "rolldown";

export default defineConfig({
    input: {
        popup: "collapse/popup.js",
    },
    output: {
        dir: "collapse/dist",
        entryFileNames: "[name].js",
        format: "iife",
        name: "CollapsePopup",
    },
    platform: "browser",
    treeshake: true,
});
