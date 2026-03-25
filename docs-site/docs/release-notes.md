---
title: Release notes
---

# Release notes (v0.3.x)

## New in v0.3.5

- Improved record-to-code review controls:
  - Converter steps can now switch generated selectors between `waitUntilMatch()` and `onElementMatches(...)`.
  - Parent traversal steps now support selector re-selection in addition to count-based traversal.
- Improved sidepanel script handling:
  - The editor toolbar now lets you choose between multiple saved scripts that match the current tab.
  - Blank scripts are auto-numbered, and saving now blocks duplicate script titles.
  - Script-scoped `pt` storage and `pn` cache state now follow the saved script instead of being dropped on rename.
- Expanded `ps` styling controls:
  - `ps.injectCSS(...)` now accepts a `priority` option with `normal`, `high`, and `xhigh` modes.
  - `ps.applyStyle(...)` now preserves `!important` declarations in inline style values.
- Refined the marketing site:
  - The landing page now includes refreshed demos and downloadable example scripts.

## New in v0.3.4

- Improved GitHub Actions release workflow:
  - Version is now read automatically from the root `package.json` rather than requiring a manual input.
  - Version normalisation is more robust and no longer crashes on unexpected formats.
- Removed unused clipboard utilities from the Select tool content script.

## New in v0.3.3

- Improved Monaco editor reliability in Firefox:
  - The sidepanel editor now uses URL-based workers when running in Firefox, matching the strategy already used for popup editors and fixing worker-load failures in the Firefox sidepanel context.

## New in v0.3.2

- Improved Monaco editor reliability in the extension UI:
  - Monaco now uses inline workers consistently, which avoids worker loading failures in extension-hosted editors.
- Reduced production extension build exposure:
  - Production builds no longer ship sourcemaps, while local development keeps them enabled.
- Expanded Share tool documentation:
  - New in v0.3.2: `pp-script` export saves the current editor contents as a `.js` file using a snake-case version of the script title as the filename.

## New in v0.3.1

- Improved Monaco editor reliability across extension contexts:
  - Popup editors now choose the correct worker strategy for page-hosted popups versus extension pages.
  - Monaco worker assets are exposed explicitly so Chrome and Firefox can load selector, CSS inspector, and record-review editors more reliably.
- Improved Firefox compatibility in `@page-proxy/pp`:
  - `ElementCreatedObserver` now wraps `MutationObserver` instead of subclassing it directly.
  - The observer still exposes `observe`, `disconnect`, `takeRecords`, and `runOnTargetNode()`.
- Refined the web and docs experience:
  - The landing page demo and install flow were refreshed.
  - Documentation images now use AVIF assets for smaller downloads.

## New in v0.3.0

- Added a record-to-code workflow:
  - The Record tool now captures a selectable timeline for the active tab.
  - Selected recording chains can be converted into editable code in a dedicated review popup before saving back to the editor.
  - Follow-up fixes now keep the review step aligned with your earlier step edits instead of regenerating from stale code.
- Expanded element editing from the Select and Selectors tools:
  - The Select tool now exposes click, copy, cut, paste, delete, and apply-style actions for the selected element.
  - The Selectors tool now parses selector definitions from the editor content and can reopen entries directly for editing.
- Improved selector and CSS authoring:
  - Selector previews, specificity feedback, and in-place selector editing were refined.
  - CSS/JS parsing now uses dedicated parser utilities instead of fragile regex-only handling.
  - CSS inspector snippet insertion now escapes backslashes correctly when generating `ps.injectCSS(...)` code.
- Improved editor and sidepanel feedback:
  - Tool and editor errors now flow through a shared status message system.
  - Logging is standardized through `loglevel`, and more flows are covered by unit tests.
- Expanded `@page-proxy/pp` runtime helpers:
  - `pv` now includes `sleep`, `awaitAnimation`, and `awaitMicrotask`.
  - `pa.moveNode` now supports before/after insertion and optional copy behavior.

## New in v0.2.2

- Added new APIs in `@page-proxy/pp`:
  - `pa.moveNode` to move an existing node relative to a target node.
  - `pv.pressKey` to dispatch keyboard interactions programmatically.
- Improved editor safety and persistence behavior:
  - Prevents saving over unsaved script edits.
  - Uses script-name storage keys instead of website-based keys.
- Improved Selectors tool feedback:
  - Hovering selector entries now highlights matching elements on the page.
- Fixed reliability issues:
  - Async errors are surfaced instead of being silently swallowed.
  - Input-registration issues around key handling were corrected.

## New in v0.2.1

- Added Select tool integration with browser DevTools selection:
  - Detects when DevTools is open for the active tab.
  - Supports following the currently selected element from DevTools.
  - Supports parent traversal from the DevTools-backed selection.
- Improved selector popup and CSS inspector flow:
  - Split explicit `Selector` and `CSS` entry actions from the Select tool.
  - Improved key handling for preview controls (`z` and `x`) in CSS inspector.
  - Refactored popup internals for more reliable save/insert behavior.
- Updated Help tool delivery:
  - Help content is now fetched from `extension/HELP.md` in the GitHub repo.
  - Markdown content is rendered and sanitized before display.
- Fixed multiple stability issues:
  - Sourcemap configuration issue in extension build output.
  - Sidepanel bottom-banner overlap/visibility issue.
  - General link, lint/type, and integration reliability fixes.

## New in v0.2.0

- New `pp` entrypoint modules: `pa` (page API), `pn` (network API), and `pt` (storage API).
- Metadata now supports `@grant`, with `run-on-page-load` permission flow.
- Selector popup now includes CSS inspector mode with selector-part inspection, computed-style editing, and live preview controls.
