---
title: Permissions
---

# Permissions

Page Proxy permissions are declared in script metadata with `@grant`.

Permissions are requested from the extension Help tool. Until granted, the related behavior stays disabled.

New in v0.3.8: the code editor toolbar includes a global **Disable all grants** toggle. When enabled, Page Proxy ignores every declared grant until you turn the toggle off again.

New in v0.3.9: the Settings tool also includes per-script grant toggles for
saved scripts. Use them when you want to suppress declared grants for one script
without disabling grants across the whole extension.

## Grant values

### `run-on-page-load` {#grant-run-on-page-load}

- Enables running a script automatically when a matching page finishes loading.
- Without this grant, scripts do not auto-run on page load.
- When the grant is present, the Help tool requests permission before enabling page-load execution.
- Allowed grants are still requested per script, but the global **Disable all grants** toggle can temporarily suppress them across the extension.
- New in v0.3.9: the Settings tool can also suppress declared grants for one saved script at a time.

Example:

```js
// ==Page Proxy==
// @title Example script
// @website https://example.com/*
// @description Demo
// @grant run-on-page-load
// ==/Page Proxy==
```
