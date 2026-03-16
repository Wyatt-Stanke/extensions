# Plan: Collapse — YouTube Tab Manager Extension

## TL;DR
A Manifest V3 Chrome extension that lets users select multiple YouTube tabs (via Ctrl/Shift+click), collapse them into a single extension page showing a persistent list of videos with saved watch progress. Supports multiple named lists, merging lists, and reopening videos at saved timestamps. Follows existing workspace conventions (folder structure, release-please, icon generation).

## Data Model

```
VideoList {
  id: string (crypto.randomUUID)
  name: string (default: "Collapsed — {date}")
  createdAt: number (Date.now)
  videos: Video[]
}

Video {
  videoId: string
  url: string
  title: string
  channelName: string
  thumbnailUrl: string (https://i.ytimg.com/vi/{id}/mqdefault.jpg)
  currentTime: number (seconds)
  duration: number (seconds)
  addedAt: number (Date.now)
}
```

**Storage**: `chrome.storage.local` key `"videoLists"` → array of VideoList objects.

## Architecture

### Communication Flow
```
YouTube tab content.js (MAIN world)
  ↓ reads video element currentTime, duration
  ↓ reads page title, channel name
  ↓ postMessage
bridge.js (ISOLATED world)
  ↓ chrome.runtime.sendMessage
background.js (service worker)
  ↓ chrome.storage.local
  ↓ chrome.tabs.create (collapsed.html)
collapsed.js (extension page)
  ↓ reads/writes chrome.storage.local directly
```

### Collapse Flow
1. User highlights YouTube tabs (Ctrl/Shift+click in Chrome tab bar)
2. Clicks extension popup → "Collapse N tabs" button
3. Popup sends `COLLAPSE_TABS` message to background
4. Background queries `chrome.tabs.query({ highlighted: true, currentWindow: true })`, filters to YouTube video URLs (`/watch\?.*v=`)
5. For each YouTube tab, sends `GET_VIDEO_INFO` message via `chrome.tabs.sendMessage` to content script
6. Content script reads `<video>` element for `currentTime` and `duration`, reads page DOM for title and channel
7. Background creates a new `VideoList`, saves to `chrome.storage.local`
8. Background opens `collapsed.html?listId={id}` tab
9. Background closes original YouTube tabs

### Merge Flow
1. In collapsed.html, user clicks "Merge" button → shown a dropdown/modal of other lists
2. Selects a list to merge into current
3. Videos from source list are appended to current list (deduped by videoId)
4. Source list is deleted from storage
5. If a collapsed.html tab for the source list is open, close it

### Open Video Flow
1. User clicks a video row in collapsed.html
2. Video is removed from the current list in storage
3. New tab opens: `https://www.youtube.com/watch?v={videoId}&t={Math.floor(currentTime)}s`
4. Collapsed page UI updates reactively

## Steps

### Phase 1: Scaffold & Manifest (no dependencies)
1. Create folder `collapse/` at workspace root
2. Create `collapse/manifest.json` — MV3, permissions: `tabs`, `storage`; host_permissions: `https://www.youtube.com/*`; service_worker: `background.js`; content_scripts matching `https://www.youtube.com/*` with `content.js` (MAIN world) and `bridge.js` (ISOLATED world); `chrome_url_overrides` not used — instead use `web_accessible_resources` or just `chrome-extension://` page
3. Create `collapse/info.json` with extensionId placeholder (empty string, filled after first publish)
4. Create `collapse/version.txt` with `1.0.0`
5. Create `collapse/CHANGELOG.md` — initial entry
6. Create `collapse/icon.svg` — a simple collapse/compress icon

### Phase 2: Content Script + Bridge (*depends on Phase 1*)
7. Create `collapse/content.js` — Runs in MAIN world on YouTube. Listens for `COLLAPSE_GET_VIDEO_INFO` postMessage. Reads video element (`document.querySelector("video")`) for `currentTime` and `duration`. Reads page title from `document.title` or `h1.ytd-watch-metadata yt-formatted-string`. Reads channel name from `ytd-channel-name yt-formatted-string a`. Extracts `videoId` from `URL.searchParams.get("v")`. Posts back `COLLAPSE_VIDEO_INFO` with all data.
8. Create `collapse/bridge.js` — Runs in ISOLATED world. Bridges between content.js (postMessage) and background.js (chrome.runtime). Listens for `GET_VIDEO_INFO` from runtime → posts `COLLAPSE_GET_VIDEO_INFO` to window. Listens for `COLLAPSE_VIDEO_INFO` from window → responds to background via sendResponse.

### Phase 3: Background Service Worker (*depends on Phase 2*)
9. Create `collapse/background.js` — Service worker. Handles messages:
   - `COLLAPSE_TABS`: Queries highlighted tabs, filters YouTube video URLs, sends `GET_VIDEO_INFO` to each, creates VideoList, saves to storage, opens collapsed.html tab, closes source tabs.
   - `OPEN_VIDEO`: Opens YouTube tab with timestamp, removes video from list in storage.
   - `DELETE_VIDEO`: Removes a video from a list.
   - `MERGE_LISTS`: Merges source list into target list, deletes source.
   - `DELETE_LIST`: Deletes an entire list.
   - `RENAME_LIST`: Renames a list.
   - `GET_LISTS`: Returns all lists from storage.

### Phase 4: Popup UI (*depends on Phase 3*)
10. Create `collapse/popup.html` — Simple popup with: count of highlighted YouTube tabs, "Collapse" button, list of existing collapsed lists (links to open collapsed.html pages).
11. Create `collapse/popup.css` — Styled following apclassroom conventions (system font, 300px width, card-based layout, green/blue/orange status colors).
12. Create `collapse/popup.js` — On load: query highlighted tabs (filter YouTube video URLs), show count. "Collapse" button sends `COLLAPSE_TABS` to background. List section shows existing lists from storage with click-to-open.

### Phase 5: Collapsed Page (*parallel with Phase 4*)
13. Create `collapse/collapsed.html` — Full extension page. Reads `listId` from URL search params. Displays list name (editable), video list, merge button, action buttons.
14. Create `collapse/collapsed.css` — Responsive layout. Video rows: thumbnail (120x68), title, channel, progress bar (currentTime/duration), time text, remove button. Header with list name, merge button.
15. Create `collapse/collapsed.js` — On load: read listId from URL, load list from `chrome.storage.local`. Render video list. Click handlers: open video (sends `OPEN_VIDEO` to background, removes from UI), delete video, rename list, merge modal. Listen for storage changes (`chrome.storage.onChanged`) to update UI reactively when other tabs modify the same list.

### Phase 6: Release & Build Config (*depends on Phase 1*)
16. Update `release-please-config.json` — Add `collapse` package entry following the apclassroom pattern (release-type: simple, component: collapse, extra-files for manifest.json version).

## Relevant Files

### New files to create:
- `collapse/manifest.json` — MV3 manifest with tabs, storage permissions, YouTube host_permissions, content scripts (MAIN + ISOLATED), service worker, extension page
- `collapse/background.js` — Service worker handling all collapse/merge/open/delete operations via chrome.storage.local and chrome.tabs APIs
- `collapse/content.js` — MAIN world script on YouTube, reads `<video>` element for currentTime/duration, DOM for title/channel
- `collapse/bridge.js` — ISOLATED world bridge, same postMessage↔runtime.sendMessage pattern as apclassroom/bridge.js
- `collapse/popup.html` — Browser action popup, same structure as apclassroom/popup.html
- `collapse/popup.js` — Popup logic, queries highlighted YouTube tabs, lists saved lists
- `collapse/popup.css` — Popup styles, following apclassroom/popup.css conventions
- `collapse/collapsed.html` — Extension page for displaying a collapsed video list
- `collapse/collapsed.js` — Collapsed page logic, renders videos, handles open/delete/merge
- `collapse/collapsed.css` — Collapsed page styles, responsive video list layout
- `collapse/icon.svg` — Extension icon (SVG, processed by scripts/generate-icons.mjs)
- `collapse/info.json` — Extension metadata (extensionId placeholder)
- `collapse/version.txt` — Initial version 1.0.0
- `collapse/CHANGELOG.md` — Initial changelog

### Existing files to modify:
- `release-please-config.json` — Add `collapse` package entry following apclassroom pattern

## Verification

1. **Load unpacked**: Load `collapse/` in `chrome://extensions` with Developer mode, verify no manifest errors
2. **Content script injection**: Open a YouTube video, check DevTools console for content script loading (no errors)
3. **Collapse flow**: Open 3+ YouTube video tabs, Ctrl+click to highlight them, click extension → "Collapse" → verify: original tabs close, new collapsed.html tab opens, videos appear with correct titles/thumbnails/progress
4. **Persistence**: Close and reopen Chrome, click extension popup → verify saved lists still appear, click to open collapsed.html → videos still there
5. **Open video**: Click a video in collapsed.html → verify: video removed from list, new YouTube tab opens at correct timestamp (`&t=Ns` in URL)
6. **Multiple lists**: Collapse different sets of tabs → verify multiple lists in popup, each opens its own collapsed.html
7. **Merge**: Open a collapsed.html, click Merge, select another list → verify: videos combined, source list deleted, source tab closed if open
8. **Icon generation**: Run `npm run build` → verify `collapse/icons/` generated with icon16.png, icon32.png, icon48.png, icon128.png
9. **Edge cases**: Test with non-video YouTube pages highlighted (should be skipped), videos that haven't loaded yet (graceful fallback — 0 progress), tabs on other sites mixed in (should be filtered out)

## Decisions
- **Tab selection**: Highlighted tabs (Ctrl/Shift+click) — uses `chrome.tabs.query({ highlighted: true })`
- **Non-video pages**: Skipped — only `/watch?v=` URLs are collapsed
- **Visual style**: Vertical list with thumbnails, not card grid
- **Thumbnail source**: YouTube's `i.ytimg.com/vi/{id}/mqdefault.jpg` (320x180) — no API key needed
- **Timestamp passing**: Via YouTube's `&t=Ns` URL parameter — no content script needed on reopen
- **Deduplication on merge**: By videoId — keeps the version with the later `addedAt` timestamp
- **Storage API**: `chrome.storage.local` (not sync) — video lists can be large, local has 10MB limit vs sync's 100KB
- **No YouTube Data API**: All info extracted from DOM — no API key required, no quota limits
