---
title: pa (Page API)
---

# pa module (v0.2.x)

`pa` exposes page-level helpers.

```js
import { pa } from "@page-proxy/pp";
```

## `notification(...values)`

Shows an in-page notification and logs values to the console.

Notification behavior:

- Rich object/element viewer
- Close button support
- Auto-dismiss after ~4.2s
- Auto-dismiss pauses while any details viewer is open
- Keeps at most 4 notifications on screen

```js
pa.notification("User synced", { id: "u_42", plan: "pro" });
pa.notification("Primary button", document.querySelector(".btn-primary"));
```

## API alias

`pa.pp` is the same API object used by the legacy global `pp` alias.

```js
pa.pp.notification("hello from pp");
```
