---
title: pv (Event API)
---

# pv module

## `pv.onElementCreated(func, targetNode?, observerOptions?)`

Creates and starts a `MutationObserver` that:

- watches for added nodes,
- invokes `func` for each new element and its descendants,
- immediately runs once on the existing `targetNode` subtree.

Returns an `ElementCreatedObserver` instance.

## `ElementCreatedObserver`

Subclass of `MutationObserver` with:

- `runOnTargetNode()`

This re-runs the handler on the target node tree as if those elements were newly created.

## `pv.notification(...values)`

Shows a Page Proxy notification in-page and logs to console.

Behavior includes:

- object/array viewer rendering,
- element previews in the viewer,
- auto-dismiss (paused when a viewer details block is open),
- manual close button.

## `pv.createApi()` and `pv.pp`

`createApi()` returns the page API object currently exposing:

- `notification`

`pp` is the instantiated result of `createApi()`.
