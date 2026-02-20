---
title: pq (Query API)
---

# pq module (next)

`pq` provides query builders and reusable DOM matching helpers.

```js
import { pq } from "@page-proxy/pp";
```

## `pq.selector(definition)`

Builds reusable selector logic.

`definition` parameters:

- `name`
  Metadata label exposed on `selector.definition`.
- `baseSelector` (optional)
  Optional CSS prefilter. Trimmed; blank values fall back to `"*"`.
- `matches(element)`
  Required predicate that decides whether an element matches.
- `postMap(element)` (optional)
  Optional transform for matched elements returned from `query`, `queryAll`, and `onElementMatches`.

```js
const premiumCards = pq.selector({
    name: "premium-cards",
    baseSelector: ".card",
    matches: (el) => pq.innerTextMatches(el, /premium/i),
});

const first = premiumCards.query();
const all = premiumCards.queryAll();
const observer = premiumCards.onElementMatches((el) => {
    console.log("New premium card:", el);
});
```

### Available methods:

#### `definition`

Exposes the same object passed into `pq.selector(definition)`.
Useful for reading selector metadata/configuration at runtime.

```js
console.log(premiumCards.definition.name); // "premium-cards"
console.log(premiumCards.definition.baseSelector); // ".card"
```

#### `matches(el)`

Tests one element against your selector rules.

- checks `baseSelector` first (unless it resolves to `"*"`)
- runs your `matches(el)` predicate
- returns `true` or `false`

```js
var candidate = document.querySelector(".card");
if (candidate && premiumCards.matches(candidate)) {
    console.log("Candidate is a match");
}
```

#### `query()`

Returns the first current match from the document, or `null` when none match.

```js
var firstMatch = premiumCards.query();
console.log("First match:", firstMatch);
```

#### `queryAll()`

Returns all current matches as an array.

```js
var allMatches = premiumCards.queryAll();
console.log("Total matches:", allMatches.length);
```

#### `onElementMatches(func, targetNode, observerOptions)`

Starts observing DOM insertions and runs `func` for matches.

- returns an `ElementCreatedObserver` (built on `MutationObserver`)
- runs once on the current subtree immediately
- continues for future added nodes
- default options:
    - `targetNode`: `document.body || document.documentElement`
    - `observerOptions`: `{ childList: true, subtree: true }`

```js
var observer = premiumCards.onElementMatches(
    function (value) {
        console.log("Observed match:", value);
    },
    document.body,
    { childList: true, subtree: true },
);

observer.disconnect();
```

## Match helpers

Supported helpers:

- `tagMatches`: exact tag equality after `trim().toLowerCase()`
- `selectorMatches`: native `Element.matches` wrapper
- `innerTextMatches`: uses only direct text nodes (not descendant text); regex matchers remove `g` before testing
- `bboxMatches`: compares left/top/right/bottom in page coordinates; default tolerance `75`
- `propMatches` / `propContains` / `propExists`: read special keys (`tag`, `id`, `class`, `name`, `innerText`, `bbox`) plus regular attributes

```js
pq.tagMatches(el, "button");
pq.selectorMatches(el, ".cta.primary");
pq.innerTextMatches(el, "Upgrade");
pq.bboxMatches(el, { x: 100, y: 220, width: 280, height: 48 }, 25);
pq.propContains(el, "class", "featured");
```

## Parent traversal

`traverseParents(el, matcher, options?)` walks from `el.parentElement` upward and returns the first match (or `null`).

```js
const sectionId = pq.traverseParents(button, (parent) => parent.matches("section"), {
    postMap: (parent) => parent.id,
});
```
