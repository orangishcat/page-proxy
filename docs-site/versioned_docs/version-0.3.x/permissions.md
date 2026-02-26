---
title: Permissions
---

# Permissions

Page Proxy permissions are declared in script metadata with `@grant`.

Permissions are requested from the extension Help tool. Until granted, the related behavior stays disabled.

## Grant values

### `run-on-page-load` {#grant-run-on-page-load}

- Enables running a script automatically when a matching page finishes loading.
- Without this grant, scripts do not auto-run on page load.
- When the grant is present, the Help tool requests permission before enabling page-load execution.
- Allowed grants are saved in script tool state (per website glob).

Example:

```js
// ==Page Proxy==
// @title Example script
// @website https://example.com/*
// @description Demo
// @grant run-on-page-load
// ==/Page Proxy==
```

