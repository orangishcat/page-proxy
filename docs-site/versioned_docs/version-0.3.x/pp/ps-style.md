---
title: ps (Style API)
---

# ps module (v0.3.x)

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

New in v0.3.5: `applyStyle(...)` now preserves `!important` values, and it throws when a target element does not expose a `style` property.

## `injectCSS(styleText, options?)`

Injects CSS into `document.head` and avoids duplicate inserts for the same content.

New in v0.3.5: pass `{ priority: "normal" | "high" | "xhigh" }` to control how aggressively injected styles win conflicts.

- `normal`: CSS is injected as is.
- `high` (default): CSS is rewritten so that every rule applied has `!important` appended to it.
- `xhigh`: Uses `pq.selector` internally to set the `style` property of the element directly with `!important`. Not as performant, but wins almost all conflicts.

```ts
const inserted = ps.injectCSS(
    `
  .target {
    border: 0.1em solid #59C2FF;
    border-radius: 0.5em;
  }
`,
    {
        priority: "xhigh",
    },
);

if (!inserted) {
    console.log("Style already exists or could not be injected.");
}
```

`injectCSS` returns:

- `true` when CSS is inserted
- `false` when the input is empty, `head` is unavailable, or matching CSS already exists at the same or higher priority
