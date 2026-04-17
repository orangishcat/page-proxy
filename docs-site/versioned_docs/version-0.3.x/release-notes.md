---
title: Release notes
---

# Release notes (v0.3.x)

## New in v0.3.9

- Added script metadata version support:
    - New blank scripts now include an explicit `@version` field in the Page
      Proxy metadata block.
    - Userscript exports now keep the script version and fall back to the
      default script version when the field is left blank.
- Added a dedicated Settings tool in the sidepanel:
    - The toolbar now has a Settings entry with shortcut `Shift + 4`.
    - Settings can show or hide the Help tool button and disable declared grants
      for individual saved scripts.
- Refactored extension storage to be more maintainable:
    - Sidepanel settings, selected scripts, record panels, and stored script
      state now flow through the unified app-state storage system.
    - Recent storage fixes address script selection, banner persistence, and
      grant-related edge cases.
- Fixed DevTools-follow selection sync:
    - DevTools element following now evaluates the selected element more
      reliably and keeps the sidepanel selection in sync.

## New in v0.3.8

- Improved export controls:
    - Added a **Minify** toggle for `pp-script`, Tampermonkey, and CSS
      stylesheet exports.
    - Exported Page Proxy scripts keep their metadata and selector blocks while
      minifying runnable code.
    - CSS stylesheet minification now uses `css-tree`.
- Added a global grant safety toggle in the code editor:
    - The toolbar now includes **Disable all grants**.
    - When enabled, declared grants such as `run-on-page-load` are ignored until
      the toggle is turned off again.
- Refined editor and extension UI polish:
    - The editor toolbar now focuses on script selection without repeating the
      active website glob.
    - Export tool layout and extension styling were cleaned up.
- Internal refactors split large Select tool, selector popup, notification, and
  landing demo modules into smaller focused files.

## New in v0.3.7

- Tampermonkey and CSS stylesheet export options are now enabled!
    - View the
      [docs](https://orangishcat.github.io/page-proxy/docs/extension-usage/export-tool#export-formats)
      for more information
- pq.selector's name and matches field are now both optional.
    - No more writing `matches: e => true` everywhere, and also no more having
      to rename a selector twice (once for the variable name, once for the
      `name` field).
- Undo button in the Select tool, which removes the last entry from the
  recording tool and selects the element selected in the previous recording
  step.
- Fixed a bug where navigating to the review step in the recording popup would
  cause an infinite loop, freezing the browser.
- Updated docs and fixed small bugs, as usual

## New in v0.3.6

- Improved sidepanel script switching:
    - The script-title dropdown now stays available as soon as the current tab
      has a matching saved script.
    - The dropdown includes a **New script** action that creates a fresh
      tab-matched script without overwriting existing saved scripts.
- Refined landing page starter scripts:
    - Replaced the older Schoology demo with a general-purpose **Make links not
      draggable** example.
    - Landing example metadata now preserves multiline descriptions, so longer
      example summaries render correctly.
- Simplified CI workflow signal:
    - Push workflows now run only for `main`.
    - The checks workflow no longer cancels in-progress runs in a way that
      counts as a failure.

## New in v0.3.5

- Improved record-to-code review controls:
    - Converter steps can now switch generated selectors between
      `waitUntilMatch()` and `onElementMatches(...)`.
    - Parent traversal steps now support selector re-selection in addition to
      count-based traversal.
- Improved sidepanel script handling:
    - The editor toolbar now lets you choose between multiple saved scripts that
      match the current tab.
    - Blank scripts are auto-numbered, and saving now blocks duplicate script
      titles.
    - Script-scoped `pt` storage and `pn` cache state now follow the saved
      script instead of being dropped on rename.
- Expanded `ps` styling controls:
    - `ps.injectCSS(...)` now accepts a `priority` option with `normal`, `high`,
      and `xhigh` modes.
    - `ps.applyStyle(...)` now preserves `!important` declarations in inline
      style values.
- Refined the marketing site:
    - The landing page now includes refreshed demos and downloadable example
      scripts.

## New in v0.3.4

- Improved GitHub Actions release workflow:
    - Version is now read automatically from the root `package.json` rather than
      requiring a manual input.
    - Version normalisation is more robust and no longer crashes on unexpected
      formats.
- Removed unused clipboard utilities and unnecessary clipboard permissions from
  the Select tool content script.

## New in v0.3.3

- Improved Monaco editor reliability in Firefox:
    - The sidepanel editor now uses URL-based workers when running in Firefox,
      matching the strategy already used for popup editors and fixing
      worker-load failures in the Firefox sidepanel context.

## New in v0.3.2

- Improved Monaco editor reliability in the extension UI:
    - Monaco now uses inline workers consistently, which avoids worker loading
      failures in extension-hosted editors.
- Reduced production extension build exposure:
    - Production builds no longer ship sourcemaps, while local development keeps
      them enabled.
- Expanded Export tool documentation:
    - New in v0.3.2: `pp-script` export saves the current editor contents as a
      `.js` file using a snake-case version of the script title as the filename.

## New in v0.3.1

- Improved Monaco editor reliability across extension contexts:
    - Popup editors now choose the correct worker strategy for page-hosted
      popups versus extension pages.
    - Monaco worker assets are exposed explicitly so Chrome and Firefox can load
      selector, CSS inspector, and record-review editors more reliably.
- Improved Firefox compatibility in `@page-proxy/pp`:
    - `ElementCreatedObserver` now wraps `MutationObserver` instead of
      subclassing it directly.
    - The observer still exposes `observe`, `disconnect`, `takeRecords`, and
      `runOnTargetNode()`.
- Refined the web and docs experience:
    - The landing page demo and install flow were refreshed.
    - Documentation images now use AVIF assets for smaller downloads.

## New in v0.3.0

- Added a record-to-code workflow:
    - The Record tool now captures a selectable timeline for the active tab.
    - Selected recording chains can be converted into editable code in a
      dedicated review popup before saving back to the editor.
    - Follow-up fixes now keep the review step aligned with your earlier step
      edits instead of regenerating from stale code.
- Expanded element editing from the Select and Selectors tools:
    - The Select tool now exposes click, copy, cut, paste, delete, and
      apply-style actions for the selected element.
    - The Selectors tool now parses selector definitions from the editor content
      and can reopen entries directly for editing.
- Improved selector and CSS authoring:
    - Selector previews, specificity feedback, and in-place selector editing
      were refined.
    - CSS/JS parsing now uses dedicated parser utilities instead of fragile
      regex-only handling.
    - CSS inspector snippet insertion now escapes backslashes correctly when
      generating `ps.injectCSS(...)` code.
- Improved editor and sidepanel feedback:
    - Tool and editor errors now flow through a shared status message system.
    - Logging is standardized through `loglevel`, and more flows are covered by
      unit tests.
- Expanded `@page-proxy/pp` runtime helpers:
    - `pv` now includes `sleep`, `awaitAnimation`, and `awaitMicrotask`.
    - `pa.moveNode` now supports before/after insertion and optional copy
      behavior.
