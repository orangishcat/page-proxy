# Page Proxy

[![Figma](https://img.shields.io/badge/Figma-page--proxy-F24E1E?logo=figma&logoColor=white)](https://www.figma.com/file/1E8P0X0wBphOq6kbXWMhbW/page-proxy--)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev/)
[![WXT](https://img.shields.io/badge/WXT-0.20-111111)](https://wxt.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.3+-fbf0df?logo=bun&logoColor=000000)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Restyle and reskin webpages with a powerful set of developer tools.

Page Proxy is an all-in-one userscript manager and creator with custom GUI tools
and an API covering common use cases to convert page interactions to
userscripts, making the process more beginner-friendly and less tedious.

[Longer description](https://orangishcat.github.io/page-proxy/docs/purpose)

## Usage instructions

- [Installation](https://orangishcat.github.io/page-proxy/install)
- [Documentation](https://orangishcat.github.io/page-proxy/docs)
- There's a help button in the extension which contains known issues and usage
  tips.
- Back up your scripts often! The extension is still very unstable.

## Supported browsers

- Tested on Chrome, Brave, Firefox
- Use other Chromium or Firefox-based browsers at your own risk

## Features

### Select tool

Click any element on the page to inspect it in the sidepanel. The tool shows the
element's tag, id, class, selector path, and bounding box. From there you can:

- Navigate up to the parent element.
- Copy the element's selector as a `pp` API call or as a plain CSS selector.
- Apply a style to the element via a popup.
- Click, copy, cut, paste, or delete the element directly from the panel.
- Follow the DevTools-selected element when the browser DevTools panel is open.

### Record tool

Record a timeline of interactions on the active tab, then convert them to code
without writing anything by hand:

1. Start recording — the tool captures events as a scrollable timeline.
2. Select the events you want (click, drag-select, or select all).
3. Open the review popup — your selection is converted to editable code.
4. Save the result back to the code editor.

### Code editor

A [Monaco](https://microsoft.github.io/monaco-editor/)-powered editor for
writing and running userscripts. Powered by tools that save to the editor, and
also the `pp` scripting API.

### `pp` scripting API

Scripts import from the `pp` library, which provides six modules covering usage
patterns commonly found in userscripts:

- `pa`: Page-level helpers: in-page notifications with object viewer, markdown
  rendering, node movement
- `pn`: Network: `fetch` wrapper with optional response caching and method
  helpers (`get`, `post`, etc.)
- `pq`: DOM querying: reusable selector builders, match helpers
  (`innerTextMatches`, `bboxMatches`, etc.), parent traversal
- `ps`: Style helpers: `applyStyle` for inline styles, `injectCSS` for deduped
  stylesheet injection
- `pt`: Script-scoped storage: `getItem`/`setItem` backed by local storage,
  scoped per script
- `pv`: Events: DOM mutation observers, key-combo listeners (`onKeyPressed`),
  `pressKey`, `sleep`, `awaitAnimation`

### Other

- Layer custom CSS and JavaScript on top of any website without touching its
  source.
- Selectors tool: view, highlight matches for, and edit all active selectors
  from a single panel. Selector definitions are parsed directly from editor
  content and displayed in the tool window for convenience.
- Create tool (currently coming soon): insert new elements into the page from
  the sidepanel.
- Export tool: export the current script as a Page Proxy script, Tampermonkey
  userscript, or CSS-only stylesheet from the sidepanel.

View the [documentation](https://orangishcat.github.io/page-proxy/docs/) to
learn more.

## Local Development

### Prerequisites

- Node.js `22+`
- Bun `1.3.3+`

### Install Dependencies

```bash
bun install
```

### Start Apps

Run each target in a separate terminal:

```bash
bun run web:dev
bun run extension:dev
bun run docs:dev
```

Useful local endpoints/outputs:

- Web app: `http://localhost:5173`
- Docs site: `http://localhost:3288`
- Extension dev output: `extension/.output`
    - Change the browser by setting the `--browser` argument in
      `extension/package.json`.
    - Load the build outputs unpacked, either via Chromium-based browsers'
      `Load unpacked` feature or Firefox's `Install temporary add-on`.
        - Note: Addons installed via Firefox's `Install temporary add-on` will
          be deleted after the browser is closed.r
- Hosted PP userscript runtime: `web/static/pp/pp.min.js`
    - Rebuild it with `bun run pp:build-runtime`.
    - This file is deployed with the static web app and used by Tampermonkey
      exports via `@require`.

### Checks

```bash
bun run web:check
bun run extension:check
bun run web:lint
bun run extension:lint
```

## License

This project is licensed under the [Apache 2.0 License](LICENSE.md). You must
retain attribution when redistributing or modifying this code. This software is
provided "as is", without warranty of any kind. Use at your own risk.
