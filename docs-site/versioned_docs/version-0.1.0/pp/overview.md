---
title: pp Library Overview
---

# pp Library Overview (v0.1.0)

`pp` scripting is grouped into:

- `pq`: DOM querying and matching.
- `ps`: style application helpers (`applyStyle`, `injectCSS`).
- `pv`: mutation observers and in-page notifications.

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

Use this version for scripts targeting `v0.1.0` runtime behavior.
