---
title: pv (Event API)
---

# pv module (v0.1.x)

## DOM creation observer

`onElementCreated(func, targetNode?, observerOptions?)`

- Starts observing immediately.
- Invokes handler for newly added elements and descendants.
- Executes an initial pass on the target tree.

Returned observer type: `ElementCreatedObserver` with `runOnTargetNode()`.

## Notifications

`notification(...values)` sends in-page notifications with value viewer support.

## API object

- `createApi()`
- `pp = createApi()`
