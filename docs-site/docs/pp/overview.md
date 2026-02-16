---
title: pp Library Overview
---

# pp Library Overview

The library is split into three modules:

```ts
import * as pq from "@page-proxy/pp/pp-query";
import * as ps from "@page-proxy/pp/pp-style";
import * as pv from "@page-proxy/pp/pp-event";
```

- `pq`: query, matching, and DOM traversal helpers.
- `ps`: style helpers (`applyStyle`, `injectCSS`).
- `pv`: events and page notifications.

## Quick example

```ts
import * as pq from "@page-proxy/pp/pp-query";
import * as ps from "@page-proxy/pp/pp-style";
import * as pv from "@page-proxy/pp/pp-event";

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

pv.notification("Styled premium cards", { count: existingCards.length });
```

## Runtime notes

- APIs run in webpage context.
- `pq.selector` supports `baseSelector`, `matches`, and optional `postMap` to transform matched elements.
- `ps.injectCSS` deduplicates repeated style text and returns whether styles were inserted.
- `pv.onElementCreated` observes future DOM nodes and also runs immediately on the current target tree.
