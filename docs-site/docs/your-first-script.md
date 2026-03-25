---
title: Your first script
---

# Your first script

This quick example runs a basic "Hello World" script with Page Proxy.

## Hello World

```ts
import { pa } from "@page-proxy/pp";

// Imports, metadata, etc...

pa.notification("Hello World");
```

When this script runs, Page Proxy logs the message and shows an in-page notification.

`console.log` works too, but there isn't an in-page notification. You'll have to open the browser console, which is too much work for a lazy person like me.

New in v0.3.5: if multiple saved scripts match the current tab, use the script-title dropdown in the sidepanel editor to choose which one to load. Fresh blank scripts are auto-numbered to avoid name collisions.

You can pass multiple values too! For example

```js
pa.notification("Hello", { page: location.href });
```

And it will have an object viewer.
