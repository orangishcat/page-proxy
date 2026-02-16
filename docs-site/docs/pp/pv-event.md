---
title: pv (Event API)
---

# pv module

`pv` contains DOM observer helpers and in-page notification utilities.

```js
import * as pv from "@page-proxy/pp/pp-event";
```

## `pv.onElementCreated(func, targetNode, observerOptions)`

Creates and starts an observer that reacts to DOM insertions.

Defaults:

- `targetNode` (optional): `document.body || document.documentElement`
- `observerOptions` (optional): `{ childList: true, subtree: true }`

Behavior:

- watches only `childList` mutations unless you pass custom options
- for each added node, invokes `func` for the node element and all descendant elements
- runs an initial pass immediately on `targetNode` so existing elements are included

Returns an `ElementCreatedObserver`, which extends the built-in JavaScript `MutationObserver` class.

```js
const observer = pv.onElementCreated(
    (el) => {
        if (el instanceof HTMLElement && el.matches(".toast")) {
            const text = el.textContent ? el.textContent.trim() : "";
            console.log("Toast appeared:", text);
        }
    },
    document.body,
    { childList: true, subtree: true },
);

// Later:
observer.disconnect();
```

## `ElementCreatedObserver`

Adds one helper method:

- `runOnTargetNode()`: runs the original callback over the target node tree again

```js
observer.runOnTargetNode(); // manual re-scan of target subtree
```

## `pv.notification(...values)`

Sends a notification to three places:

- browser console (`console.log(...values)`)
- in-page notification overlay
- optional global sink (`globalThis.__pageProxyNotificationSink__`) when present

In-page notification behavior:

- ensures styles are injected once
- creates or reuses host container (`#__pageProxyNotificationHost`)
- renders rich value viewer for objects, arrays, and elements
- auto-dismisses after ~4.2s
- waits while any notification `<details>` viewer is open
- keeps at most 4 notifications visible

```js
pv.notification("Saved profile", {
    userId: "u_123",
    role: "admin",
    updatedAt: new Date().toISOString(),
});

const cta = document.querySelector("button.primary");
pv.notification("CTA button", cta);
```

## `pv.createApi()` and `pv.pp`

`createApi()` builds the minimal page API object:

- `notification`

`pp` is the instantiated alias:

```js
const api = pv.createApi();
api.notification("from api");

pv.pp.notification("from pv.pp");
```
