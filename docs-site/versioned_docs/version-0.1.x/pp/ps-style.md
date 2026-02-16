---
title: ps (Style API)
---

# ps module (v0.1.x)

`applyStyle(elements, values)` applies CSS style properties on each target element.

```ts
ps.applyStyle(Array.from(document.querySelectorAll(".target")), {
    color: "#fff",
    background: "#111",
});
```

It safely ignores elements that do not expose a `style` property.

## `injectCSS(styleText)`

Injects CSS into `document.head` and avoids duplicate inserts for the same content.

```ts
const inserted = ps.injectCSS(`
  .target {
    border: 0.1em solid #59C2FF;
    border-radius: 0.5em;
  }
`);

if (!inserted) {
    console.log("Style already exists or could not be injected.");
}
```

`injectCSS` returns:

- `true` when CSS is inserted
- `false` when the input is empty, `head` is unavailable, or matching CSS already exists
