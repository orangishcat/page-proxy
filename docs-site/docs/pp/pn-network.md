---
title: pn (Network API)
---

# pn module (next)

`pn` wraps `fetch` and adds optional response caching.

```js
import { pn } from "@page-proxy/pp";
```

## `pn.fetch(input, options)`

Supports standard `fetch` options plus these cache options:

- `cache?: boolean`
- `cacheDuration?: number` (milliseconds, default `86400000`)
- `cacheKey?: string` (default is request URL)
- `requestCache?: RequestCache` (maps to native `fetch` `cache` option)

When `cache: true`:

- Cache keys are saved in local storage with prefix `pp-network-cache:`
- Responses larger than `512KB` are not cached
- `pn` cache and `pt` storage share one combined limit
- At most `50` saved keys are kept per script scope

```js
const response = await pn.fetch("https://api.example.com/items", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ limit: 20 }),
  cache: true,
  cacheDuration: 5 * 60 * 1000,
  cacheKey: "items:list"
});
```

## Method helpers

These call `pn.fetch` with the corresponding HTTP method:

- `pn.get`
- `pn.head`
- `pn.post`
- `pn.put`
- `pn.delete`
- `pn.connect`
- `pn.options`
- `pn.trace`
- `pn.patch`

```js
const response = await pn.get("https://api.example.com/items", { cache: true });
const data = await response.json();
```
