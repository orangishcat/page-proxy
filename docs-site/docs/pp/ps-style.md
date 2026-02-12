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
