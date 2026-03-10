---
title: pa (Page API)
---

# pa module (v0.3.x)

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

- `breaks?: boolean` (default `true`): Controls line-break handling while parsing markdown. When `true`, single newlines become `<br>`; when `false`, markdown uses stricter paragraph rules.
- `linkTarget?: string` (default `"_blank"`): Applied to every rendered `<a href="...">` as its `target` attribute. Use `"_self"` to open links in the current tab.
- `linkRel?: string` (default `"noreferrer noopener"`): Applied to every rendered link as its `rel` attribute. This is useful for security when links open in a new tab.
- `linkReferrerPolicy?: string` (default `"no-referrer"`): Applied to every rendered link as `referrerpolicy`, controlling whether browser referrer information is sent on navigation.

```js
const html = pa.renderMarkdown("See [docs](https://orangishcat.github.io/page-proxy/docs)");
document.querySelector("#help")?.insertAdjacentHTML("beforeend", html);
```

## `moveNode(node, position = -1, parent = node.parentElement, options)`

Moves `node` to the `position`th child of `parent`.

- If `position` is greater than child count, node is moved to the end.
- If `position` is below `0`, it is treated as `position` places from the end (`-1` is last, `-2` is second last).
- `options.pasteLocation` can be `"child"` (default), `"before"`, or `"after"`.
- `options.copy` clones the node before inserting it instead of moving the original.

```js
const list = document.querySelector(".todo-list");
const item = list?.querySelector(".todo-item");
if (list && item) {
  pa.moveNode(item, 0, list); // move to first child
  pa.moveNode(item, -1, list); // move to last child
  pa.moveNode(item, -1, item, { pasteLocation: "after", copy: true }); // duplicate after itself
}
```
