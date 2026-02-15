# Page Proxy

[![Figma](https://img.shields.io/badge/Figma-page--proxy-F24E1E?logo=figma&logoColor=white)](https://www.figma.com/file/1E8P0X0wBphOq6kbXWMhbW/page-proxy--)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev/)
[![WXT](https://img.shields.io/badge/WXT-0.20-111111)](https://wxt.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.3+-fbf0df?logo=bun&logoColor=000000)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Restyle and reskin webpages with a powerful set of developer tools.

Page Proxy is a browser extension that allows you to proxy any website and apply custom CSS and JavaScript to it,
with a JS API and UI-based tools that assist with UI/UX design.

## Troubleshooting
- There's a help button (<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWNpcmNsZS1xdWVzdGlvbi1tYXJrLWljb24gbHVjaWRlLWNpcmNsZS1xdWVzdGlvbi1tYXJrIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwYXRoIGQ9Ik05LjA5IDlhMyAzIDAgMCAxIDUuODMgMWMwIDItMyAzLTMgMyIvPjxwYXRoIGQ9Ik0xMiAxN2guMDEiLz48L3N2Zz4=">) in the extension.

## Supported browsers

- Tested on Chrome, Brave, Firefox
- **Edge doesn't work, please do not use Edge**
- Use other Chromium or Firefox-based browsers at your own risk

## Features

- Proxy websites and layer custom CSS/JavaScript on top.
- Build edits with UI tools and a scripting API (`@page-proxy/pp`).

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
- Extension dev output: `extension/.output/chrome-mv3-dev` (load as unpacked in Chrome)

### Checks

```bash
bun run web:check
bun run extension:check
bun run web:lint
bun run extension:lint
```
