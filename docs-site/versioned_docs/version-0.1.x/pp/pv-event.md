---
title: pv (Event API)
---

# pv module (v0.1.x)

`pv` handles DOM creation events and Page Proxy notifications.

```js
import * as pv from "@page-proxy/pp/pp-event";
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

## `notification(...values)`

Shows an in-page notification and logs values to the console.

Notification behavior:

- rich viewer for objects and elements
- close button support
- auto-dismiss after ~4.2s
- auto-dismiss pauses while any details viewer is open
- keeps at most 4 notifications on screen

```js
pv.notification("User synced", { id: "u_42", plan: "pro" });
pv.notification("Primary button", document.querySelector(".btn-primary"));
```

## API object

`createApi()` returns `{ notification }` and `pp` is the instantiated alias.

```js
const api = pv.createApi();
api.notification("hello");
pv.pp.notification("hello from pp");
```
