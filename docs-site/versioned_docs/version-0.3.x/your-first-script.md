---
title: Your first script
---

# Your first script

When navigating to a tab that Page Proxy has access to, opening the sidepanel should greet you with a tool panel and code editor, which contains code like this:

## Hello World

```ts
import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";

// ==Page Proxy==
// @title Page Proxy
// @website https://website.com/*
// @description
// @author
// @grant
// ==/Page Proxy==

// ==Selectors==
// ==/Selectors==

pa.notification("Hello world!");
```

The script runs on the active tab, and will only appear on websites that match the `@website` glob. Switching to a different tab loads a different script.

Running the code should log an in-page notification saying "Hello world"!

You can pass multiple values too. For example

```js
pa.notification("Hello", { page: location.href });
```

And the notification will have an object viewer.

## Next Steps

Familiarize yourself with [extension usage](./extension-usage/) and the [API](./pp/overview)!

Most importantly, start using the [Record tool](./extension-usage/record-tool).
