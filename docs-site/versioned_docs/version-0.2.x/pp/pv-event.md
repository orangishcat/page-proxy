---
title: pv (Event API)
---

# pv module (v0.2.x)

`pv` handles DOM creation events.

```js
import { pv } from "@page-proxy/pp";
```

## `onElementCreated(func, targetNode, observerOptions)`

Creates an `ElementCreatedObserver` (a child class of the built-in JavaScript `MutationObserver`) and starts it immediately.

Defaults:

- `targetNode` (optional): `document.body || document.documentElement`
- `observerOptions` (optional): `{ childList: true, subtree: true }`

What it does:

- watches for added nodes
- invokes `func` for each added element plus its descendant elements
- runs an immediate first pass on the target subtree

```js
const observer = pv.onElementCreated((el) => {
    if (el instanceof HTMLElement && el.matches("[data-toast]")) {
        const text = el.textContent ? el.textContent.trim() : "";
        console.log("Toast:", text);
    }
});
```

`ElementCreatedObserver` also provides:

- `runOnTargetNode()` to manually re-scan current target subtree

```js
observer.runOnTargetNode();
observer.disconnect();
```

For notifications, use `pa.notification(...)`.
