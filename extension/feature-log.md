# feature-log.md

## Sidepanel tools layout + pp namespace (2026-01-11)
- Replaced the sidepanel layout with multi-card tool panels (Select, New element, Styles, Save style, Share) and a dedicated CodeMirror card.
- Added a comment block marker (`// Define elements/styles`) as the insertion target for saved element/style definitions.
- Switched code generation to the `pp` namespace (`pp.element`, `pp.style`) and inserted definitions into the editor while persisting only editor content via extension storage.
- Added parsing of `// pp:element` and `// pp:style` metadata lines to rebuild tool panel state from editor content.
- Disabled sharing actions and kept all persistence local until Appwrite integration is finalized.

## Sidepanel tabbed tools layout (2026-01-11)
- Reworked the sidepanel into two tiled panels: a top tool panel with a shared tab bar and a bottom CodeMirror editor panel.
- Removed panel rounding and outer gaps to mimic stacked window panes; tool content now swaps via tabs instead of separate cards.
- Added tab state and tab buttons (Select, New element, Styles, Save style, Share) to drive which tool content renders.

## Sidepanel Figma layout replication (2026-01-11)
- Matched the sidepanel chrome to the canvas layout: fixed 400x900 viewport, stacked tool/editor panels, no rounding, and drop-shadow panels on #282824 with #222121 outer background.
- Rebuilt the tool top bar to match the Figma geometry (55px height, 15px horizontal padding, 35px square buttons, 14px gaps) with pointer/plus/$0 and share/help actions driving tool switching.
- Positioned tool contents (select/new element/styles/save style/share) using the exact offsets and sizes from the canvas, including style cards, save-style table grid, and publish button.
- Updated typography and CodeMirror styling in `extension/src/styles/app.css` to match Inter/ABeeZee/JetBrains Mono sizes, line heights, and gutter/background colors.

## Sidepanel percent layout + tool components (2026-01-11)
- Converted the sidepanel layout to percentage-based sizing for larger width/height values and set the container to fill the panel without scrollbars.
- Split each tool view into its own Svelte component under `extension/src/entrypoints/sidepanel/tools` and wired them into the main sidepanel.
- Centralized all tool typography through `app.css` utility classes to keep text sizing consistent across the UI.
