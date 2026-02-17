# Page Proxy

[![Figma](https://img.shields.io/badge/Figma-page--proxy-F24E1E?logo=figma&logoColor=white)](https://www.figma.com/file/1E8P0X0wBphOq6kbXWMhbW/page-proxy--)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev/)
[![WXT](https://img.shields.io/badge/WXT-0.20-111111)](https://wxt.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.3+-fbf0df?logo=bun&logoColor=000000)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Restyle and reskin webpages with a powerful set of developer tools.

Page Proxy is an all-in-one userscript manager and creator with custom tools for userscript design, so you can spend more time designing instead of converting your ideas to code.

[Wait, but I don't get it. What problem is this trying to solve?](https://orangishcat.github.io/page-proxy/docs/purpose)

## Usage instructions

- [Installation](https://orangishcat.github.io/page-proxy/install)
- [Documentation](https://orangishcat.github.io/page-proxy/docs)
- There's a help button in the extension which contains known issues and usage tips.

## Supported browsers

- Tested on Chrome, Brave, Firefox
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
