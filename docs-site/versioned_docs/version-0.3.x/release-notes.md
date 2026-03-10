---
title: Release notes
---

# Release notes (v0.3.x)

## New in v0.3.0

- Added a record-to-code workflow:
  - The Record tool now captures a selectable timeline for the active tab.
  - Selected recording chains can be converted into editable code in a dedicated review popup before saving back to the editor.
- Expanded element editing from the Select and Selectors tools:
  - The Select tool now exposes click, copy, cut, paste, delete, and apply-style actions for the selected element.
  - The Selectors tool now parses selector definitions from the editor content and can reopen entries directly for editing.
- Improved selector and CSS authoring:
  - Selector previews, specificity feedback, and in-place selector editing were refined.
  - CSS/JS parsing now uses dedicated parser utilities instead of fragile regex-only handling.
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
