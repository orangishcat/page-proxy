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

## `moveNode(node, position = -1, parent = node.parentElement)`

Moves `node` to the `position`th child of `parent`.

- If `position` is greater than child count, node is moved to the end.
- If `position` is below `0`, it is treated as `position` places from the end (`-1` is last, `-2` is second last).

```js
const list = document.querySelector(".todo-list");
const item = list?.querySelector(".todo-item");
if (list && item) {
  pa.moveNode(item, 0, list); // move to first child
  pa.moveNode(item, -1, list); // move to last child
}
```
