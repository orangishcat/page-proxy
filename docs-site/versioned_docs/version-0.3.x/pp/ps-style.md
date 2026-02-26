---
title: ps (Style API)
---

# ps module (v0.2.x)

`applyStyle(elements, values)` applies CSS style properties on all target elements in a list.

```ts
ps.applyStyle(Array.from(document.querySelectorAll(".target")), {
    color: "#fff",
    background: "#111",
});
```

For single element:

```ts
ps.applyStyle([document.querySelector(".target")], {
    color: "#fff",
    background: "#111",
});
```

Don't forget to wrap the element in a list!

The function safely ignores elements that do not expose a `style` property.

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
