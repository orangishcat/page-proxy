---
title: pp Library Overview
---

# pp Library Overview (v0.2.x)

`pp` scripting is grouped into:

- `pa`: page-level API helpers (notifications, markdown rendering).
- `pn`: network wrapper around `fetch` with optional local cache.
- `pq`: DOM querying and matching.
- `ps`: style application helpers (`applyStyle`, `injectCSS`).
- `pt`: script-scoped storage helpers.
- `pv`: mutation observers, key-combo listeners, and async timing helpers.

## Quick example

```ts
import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";

const premiumCardSelector = pq.selector({
    name: "premium-card",
    baseSelector: ".card",
    matches: (element) => pq.innerTextMatches(element, /premium/i),
});

const existingCards = premiumCardSelector.queryAll();
ps.applyStyle(existingCards, {
    border: "0.1em solid #59C2FF",
    borderRadius: "0.5em",
});

premiumCardSelector.onElementMatches((card) => {
    ps.applyStyle([card], { outline: "0.1em dashed #FCB253" });
});

pa.notification("Styled premium cards", { count: existingCards.length });
pt.setItem("last-card-count", String(existingCards.length));

const response = await pn.get("/api/cards", { cache: true });
console.log(await response.json());
```

Use this version for scripts targeting `v0.2.x` runtime behavior.
