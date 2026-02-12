---
title: pq (Query API)
---

# pq module

## `pq.element(definition)`

Resolves a single element from an `ElementDefinition`:

```ts
const title = pq.element({
  name: "title",
  selector: "h1",
  bbox: { x: 0, y: 0, width: 100, height: 20 }
});

const result = title.resolve();
```

`resolve()` returns:

- `element: Element | null`
- `error: "empty-selectors" | "invalid-size" | "not-found" | null`

## `pq.selector(definition)`

Creates reusable selector logic:

```ts
const card = pq.selector({
  name: "card",
  baseSelector: ".card",
  matches: (el) => pq.innerTextMatches(el, /Premium/),
});
```

Returned methods:

- `matches(el)`: checks one element.
- `query()`: returns first matching element.
- `queryAll()`: returns all matching elements.
- `onElementMatches(func, targetNode?, observerOptions?)`: runs for existing + future matches.
- `apply()`: currently a no-op placeholder.

## Match helpers

- `pq.tagMatches(el, tag)`
- `pq.selectorMatches(el, selector)`
- `pq.innerTextMatches(el, regexOrString)`
- `pq.bboxMatches(el, box, tolerance?)`
- `pq.propMatches(el, key, value)`
- `pq.propContains(el, key, value)`
- `pq.propExists(el, key)`

## Parent traversal

`pq.traverseParents(el, matcher, options?)`

```ts
const container = pq.traverseParents(button, (p) => p.classList.contains("container"));
```

- Walks upward through parent elements.
- Stops at first match.
- Returns matched parent or `null`.
- `options.postMap` can transform the returned element.
