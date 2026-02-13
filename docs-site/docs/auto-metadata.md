---
title: Auto metadata
---

# Auto-generated metadata

When you create a new script, Page Proxy generates this template:

```js
import * as pq from "@page-proxy/pp/pp-query";
import * as ps from "@page-proxy/pp/pp-style";
import * as pv from "@page-proxy/pp/pp-event";

// ==Page Proxy==
// @title Page Proxy
// @website http://currentwebsite.domain/*
// @description
// @author
// ==/Page Proxy==

// ==Selectors==
// ==/Selectors==
```

I will often omit the metadata in code examples, but they are required.

## What each metadata line does

### `// ==Page Proxy==` and `// ==/Page Proxy==`

- These mark the start and end of the metadata block.
- The editor validates this block before running or saving.

### `@title`

- Required field.
- Script display name shown in the UI.
- Used to generate the exported file name.

Example:

```js
// @title Highlight premium cards
```

### `@website`

- Required field.
- Website glob used to decide where the script applies.
- Must match the active tab URL when saving.
- If left blank, Page Proxy auto-fills it from the current page when possible.

Example:

```js
// @website https://example.com/*
```

### `@description`

- Required field.
- Human-readable summary shown in metadata/export views.
- Can be empty text, but the field line must exist.

Example:

```js
// @description Adds a badge to newly loaded cards.
```

### `@author`

- Optional field.
- Shown in metadata/export views.

Example:

```js
// @author Jane Doe
```

### `@credits`

- Optional field.
- Used for attribution (libraries, snippets, contributors).
- If empty, it may be hidden in parts of the UI.

Example:

```js
// @credits Inspired by internal design-system selectors.
```

## Metadata parsing rules

- Each metadata line must use `// @key value` (a colon like `@key: value` is also accepted).
- Required fields are `@title`, `@website`, and `@description`.
- Optional fields are `@author` and `@credits`.
- Duplicate supported fields (for example two `@website` lines) are invalid.
- Unknown metadata keys are ignored.

## About `// ==Selectors==`

- This block is separate from metadata, but also required by the editor.
- Place selector definitions between:
  - `// ==Selectors==`
  - `// ==/Selectors==`
