---
title: Your first script
---

# Your first script

This quick example runs a basic "Hello World" script with Page Proxy.

## Hello World

```ts
import * as pv from "@page-proxy/pp/pp-event";

// Imports, metadata, etc...

pv.notification("Hello World");
```

When this script runs, Page Proxy logs the message and shows an in-page notification.

`console.log` works too, but there isn't an in-page notification. You'll have to open the browser console, which is too much work for a lazy person like me.

You can pass multiple values too! For example
```js
pv.notification("Hello", { page: location.href });
```
And it will have an object viewer.
