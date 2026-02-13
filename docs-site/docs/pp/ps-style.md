---
title: ps (Style API)
---

# ps module

## `ps.applyStyle(elements, values)`

Applies style properties to each element:

```ts
const cards = Array.from(document.querySelectorAll(".card"));
ps.applyStyle(cards, {
  border: "0.1em solid #59C2FF",
  borderRadius: "0.75em",
  background: "rgba(89, 194, 255, 0.12)",
});
```

- `elements`: `Element[]`
- `values`: `Record<string, string>`

Only elements exposing a `style` property are modified.

### Example: style matched cards

```ts
import * as pq from "@page-proxy/pp/pp-query";
import * as ps from "@page-proxy/pp/pp-style";

const cards = pq.selector({
  name: "cards",
  baseSelector: ".card",
  matches: () => true,
}).queryAll();

ps.applyStyle(cards, {
  boxShadow: "0 0 0 0.08em rgba(89, 194, 255, 0.6)",
  transition: "box-shadow 180ms ease",
});
```

## `ps.injectCSS(styleText)`

Injects a `<style>` tag into `document.head` and deduplicates by content hash.

Returns:

- `true` when a new style block is inserted
- `false` when `styleText` is empty, no `<head>` exists, or identical CSS was already injected

### Example: inject once and reuse

```ts
import * as ps from "@page-proxy/pp/pp-style";

const injected = ps.injectCSS(`
  .pp-highlight {
    border: 0.1em solid #59C2FF;
    border-radius: 0.5em;
  }
`);

if (injected) {
  console.log("Inserted style rules");
}
```
