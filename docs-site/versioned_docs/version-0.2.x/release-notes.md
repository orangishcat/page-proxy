---
title: Release notes
---

# Release notes (v0.2.x)

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
