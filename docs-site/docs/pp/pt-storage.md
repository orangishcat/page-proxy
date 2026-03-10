---
title: pt (Storage API)
---

# pt module (v0.3.x)

`pt` provides script-scoped local storage helpers.

```js
import { pt } from "@page-proxy/pp";
```

## `pt.setItem(key, value)`

Stores a string value under a script-scoped key.

```js
pt.setItem("token", "abc123");
```

## `pt.getItem(key)`

Returns the previously saved string value, or `null`.

```js
const token = pt.getItem("token");
```

## Storage limits

- Saved keys are scoped per script.
- Script keys and `pn` network cache keys share one combined quota.
- Maximum: `50` saved keys per script.
- `pn` cache keys use prefix `pp-network-cache:`.
