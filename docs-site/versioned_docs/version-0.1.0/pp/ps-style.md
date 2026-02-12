---
title: ps (Style API)
---

# ps module (v0.1.0)

`applyStyle(elements, values)` applies CSS style properties on each target element.

```ts
ps.applyStyle(Array.from(document.querySelectorAll(".target")), {
  color: "#fff",
  background: "#111",
});
```
