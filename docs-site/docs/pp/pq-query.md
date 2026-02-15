---
title: pq (Query API)
---

# pq module

`pq` contains query builders and small matching helpers for finding and filtering DOM elements.

```js
import * as pq from "@page-proxy/pp/pp-query";
```

## `pq.selector(definition)`

Builds reusable selector logic that can query now and observe future matches.

`definition` parameters:

- `name`  
  Human-readable selector name kept on `selector.definition`. It is metadata only and does not affect matching.
- `baseSelector` (optional)  
  Optional CSS prefilter. The value is trimmed; empty/whitespace values are treated as `"*"`.  
  If `baseSelector !== "*"` and `el.matches(baseSelector)` is false, the element is rejected before `matches` runs.
- `matches(element)`  
  Required predicate for final filtering. Called only after `baseSelector` passes.
- `postMap(element)` (optional)  
  Optional mapper applied to matched elements in `query`, `queryAll`, and `onElementMatches`.  
  If omitted, the raw element is returned.

```js
const premiumCard = pq.selector({
  name: "premium-card",
  baseSelector: ".card",
  matches: (el) =>
    pq.innerTextMatches(el, /premium/i) &&
    pq.propContains(el, "class", "featured"),
  postMap: (el) => {
    const heading = el.querySelector("h2");
    const title = heading && heading.textContent ? heading.textContent.trim() : "";
    return {
      element: el,
      id: el.id,
      title,
    };
  },
});

const first = premiumCard.query();
const all = premiumCard.queryAll();

const observer = premiumCard.onElementMatches((value) => {
  console.log("Matched card:", value.id);
});

// Later when no longer needed:
observer.disconnect();
```

Returned methods:

- `definition`: original definition object.
- `matches(el)`: checks one element against `baseSelector` + `matches`.
- `query()`: returns the first matching result or `null`.
- `queryAll()`: returns all matching results.
- `onElementMatches(func, targetNode, observerOptions)`: runs on existing subtree first, then newly-added nodes (via `MutationObserver`). `targetNode` and `observerOptions` are optional.

### Method details

#### `definition`

Exposes the exact object passed to `pq.selector(definition)`.  
This is metadata and configuration, not a lookup result.

```js
console.log(premiumCard.definition.name); // "premium-card"
console.log(premiumCard.definition.baseSelector); // ".card"
```

#### `matches(el)`

Checks one element against selector rules.

- applies `baseSelector` prefilter first (unless it resolves to `"*"`)
- then runs your `matches(el)` predicate
- returns `true` or `false`

```js
var candidate = document.querySelector(".card");
if (candidate && premiumCard.matches(candidate)) {
  console.log("Candidate passed selector rules");
}
```

#### `query()`

Searches candidates from `document.querySelectorAll(baseSelector)` and returns the first match.  
Returns `null` when no element matches.

```js
var firstMatch = premiumCard.query();
if (firstMatch) {
  console.log("First match:", firstMatch);
}
```

#### `queryAll()`

Returns all current matches as an array.  
If no elements match, returns `[]`.

```js
var matches = premiumCard.queryAll();
console.log("Total matches:", matches.length);
```

#### `onElementMatches(func, targetNode, observerOptions)`

Observes DOM creation and calls `func` for matching elements.

- returns an `ElementCreatedObserver` (extends `MutationObserver`)
- runs once immediately on the existing `targetNode` subtree
- then runs for newly-added nodes and their descendants
- defaults:
  - `targetNode`: `document.body || document.documentElement`
  - `observerOptions`: `{ childList: true, subtree: true }`

```js
var observer = premiumCard.onElementMatches(
  function (value) {
    console.log("Matched during observation:", value);
  },
  document.body,
  { childList: true, subtree: true },
);

// stop observing later
observer.disconnect();
```

## Match Helpers

### `pq.tagMatches(el, tag)`

Compares element tag name exactly after normalizing `tag` to `trim().toLowerCase()`.

- empty/whitespace `tag` returns `false`
- comparison is case-insensitive but exact (`button` matches `BUTTON`, not `button-primary`)

```js
pq.tagMatches(button, "button"); // true
pq.tagMatches(button, "BUTTON"); // true
```

### `pq.selectorMatches(el, selector)`

Thin wrapper over `Element.matches(selector)`.

- follows browser CSS selector behavior exactly
- invalid selector strings throw like native `Element.matches`

```js
pq.selectorMatches(link, "a[href^='https://']");
```

### `pq.innerTextMatches(el, regexOrString)`

Matches only text nodes directly owned by `el` (not descendant element text).

- `string` matcher uses `includes` (case-sensitive)
- `RegExp` matcher is recreated with the same source but with `g` removed from flags
- empty resolved text returns `false`

```js
pq.innerTextMatches(el, "Upgrade");
pq.innerTextMatches(el, /upgrade/i);
```

### `pq.bboxMatches(el, box, tolerance = 75)`

Compares element bounding box using page coordinates (`scrollX`/`scrollY` included).  
Checks left, top, right, and bottom deltas against tolerance.

- `box` must have finite numeric `x`, `y`, `width`, and `height`
- `tolerance` must be a finite number `>= 0`
- invalid input returns `false`

```js
pq.bboxMatches(target, { x: 120, y: 340, width: 280, height: 56 });
pq.bboxMatches(target, savedBox, 20);
```

### `pq.propMatches(el, key, value)` / `pq.propContains(el, key, value)` / `pq.propExists(el, key)`

Property helpers support normal attributes and special keys:

- `tag`
- `id`
- `class` (ignores `pp-hover` and `pp-selected`)
- `name` (`name` attribute or `aria-label`)
- `innerText`
- `bbox` (formatted as `"x, y, width, height"`)
- `selector` in `propExists` is always treated as present

```js
pq.propMatches(input, "name", "email");
pq.propContains(card, "class", "featured");
pq.propExists(button, "innerText");
```

## `pq.traverseParents(el, matcher, options?)`

Walks `parentElement` upward and returns the first parent that satisfies `matcher`.

```js
const panelId = pq.traverseParents(
  clickedButton,
  (parent) => parent.classList.contains("settings-panel"),
  { postMap: (parent) => parent.id },
);
```

- search starts from `el.parentElement` (not `el` itself)
- returns `null` when no parent matches
- `options.postMap` transforms the returned value
