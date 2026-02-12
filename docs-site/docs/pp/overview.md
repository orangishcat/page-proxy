---
title: pp Library Overview
---

# pp Library Overview

The library is split into three modules:

```ts
import * as pq from "@/lib/pp/pp-query";
import * as ps from "@/lib/pp/pp-style";
import * as pv from "@/lib/pp/pp-event";
```

- `pq`: query, matching, and DOM traversal helpers.
- `ps`: style helpers.
- `pv`: events and page notifications.

## Runtime notes

- APIs run in webpage context.
- `pq.selector` supports `baseSelector`, `matches`, and optional `postMap` to transform matched elements.
- `pv.onElementCreated` observes future DOM nodes and also runs immediately on the current target tree.
