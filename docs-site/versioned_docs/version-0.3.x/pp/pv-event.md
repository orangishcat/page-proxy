---
title: pv (Event API)
---

# pv module (v0.3.x)

`pv` handles DOM creation and keyboard events.

```js
import { pv } from "@page-proxy/pp";
```

## `onElementCreated(func, targetNode, observerOptions)`

Creates an `ElementCreatedObserver` wrapper around the built-in JavaScript `MutationObserver` and starts it immediately.

> New in v0.3.1: `ElementCreatedObserver` now wraps `MutationObserver` instead of subclassing it directly, which preserves the observer API while avoiding Firefox-specific inheritance issues.

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

- `observe(target, options)` to start observing manually
- `disconnect()` to stop observing
- `takeRecords()` to read queued mutation records
- `runOnTargetNode()` to manually re-scan current target subtree

```js
observer.runOnTargetNode();
observer.disconnect();
```

## `onKeyPressed(keys, func, options)`

Runs `func` when a key combo matches.

Options:

- `keyAction?: ("press" | "release")[]` (default `["press"]`)
- `cancel?: boolean` (default `false`, truthy values prevent default browser behavior)

Returns a cleanup function that removes the event listeners.

```js
const stop = pv.onKeyPressed(
    "shift+x",
    () => {
        console.log("Shift+X pressed");
    },
    {
        keyAction: ["press", "release"],
    },
);

// Later:
stop();
```

## `pressKey(keys, options)`

Simulates keyboard events programatically.

Options:

- `keyAction?: ("press" | "release")[]` (default `["press"]`)
- `cancel?: boolean` (default `false`, truthy values call `preventDefault()` on the simulated event)

```js
pv.pressKey("shift+x", {
    keyAction: ["press", "release"],
});
```

## `sleep(ms)`

Returns a Promise that resolves after `ms` milliseconds.

```js
await pv.sleep(250);
```

This is the same as calling:

```js
await new Promise((resolve) => window.setTimeout(resolve, 250));
```

## `awaitAnimation()`

Returns a Promise that resolves on the next animation frame.

```js
await pv.awaitAnimation();
```

This is the same as calling:

```js
await new Promise((resolve) => requestAnimationFrame(() => resolve()));
```

## `awaitMicrotask()`

Returns a Promise that resolves in the next microtask.

```js
await pv.awaitMicrotask();
```

This is the same as calling:

```js
await new Promise((resolve) => queueMicrotask(resolve));
```

Don't forget to await these statements, so that they run on the main thread and become blocking functions.
