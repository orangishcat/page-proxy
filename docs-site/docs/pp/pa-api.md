---
title: pa (Page API)
---

# pa module (next)

`pa` exposes page-level helpers.

```js
import { pa } from "@page-proxy/pp";
```

## `notification(...values)`

Shows an in-page notification and logs values to the console.

Notification behavior:

- Rich object/element viewer
- Close button support
- Auto-dismiss after ~4.2s
- Auto-dismiss pauses while any details viewer is open
- Keeps at most 4 notifications on screen

```js
pa.notification("User synced", { id: "u_42", plan: "pro" });
pa.notification("Primary button", document.querySelector(".btn-primary"));
```

## `renderMarkdown(content, options)`

Renders markdown to sanitized HTML.

Options:

- `breaks?: boolean` (default `true`)
- `linkTarget?: string` (default `"_blank"`)
- `linkRel?: string` (default `"noreferrer noopener"`)
- `linkReferrerPolicy?: string` (default `"no-referrer"`)

```js
const html = pa.renderMarkdown("See [docs](https://orangishcat.github.io/page-proxy/docs)");
document.querySelector("#help")?.insertAdjacentHTML("beforeend", html);
```
