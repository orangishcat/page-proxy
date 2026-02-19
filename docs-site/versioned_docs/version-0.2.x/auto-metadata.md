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
// @grant
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
- Supports multiline values (see below).

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
- Supports multiline values (see below).

Example:

```js
// @credits Inspired by internal design-system selectors.
```

### `@grant`

- Optional field.
- Grants are comma-separated (spaces and commas are both accepted separators).
- Supported values:
  - `run-on-page-load`
- `run-on-page-load` enables page-load execution after permission is granted from the Help tool.

Example:

```js
// @grant run-on-page-load
```

## Multiline metadata example

`@description` and `@credits` support multiline values.

Add continuation lines directly below the metadata key line:

```js
// ==Page Proxy==
// @title Product card tweaks
// @website https://shop.example.com/*
// @description Improve readability for dense product cards.
// Increase spacing between title and pricing rows.
// @author Jane Doe
// @credits UI idea from internal design review.
// Selector strategy adapted from old userscript experiments.
// ==/Page Proxy==
```

## Metadata parsing rules

- Each metadata line must use `// @key value` (a colon like `@key: value` is also accepted).
- Required fields are `@title`, `@website`, and `@description`.
- Optional fields are `@author`, `@credits`, and `@grant`.
- Multiline continuation lines are supported only for `@description` and `@credits`.
- A multiline field continues until the next metadata key (next `// @...` line).
- Duplicate supported fields (for example two `@website` lines) are invalid.
- `@grant` values must be supported grant names.
- Unknown metadata keys are ignored.

## About `// ==Selectors==`

- This block is separate from metadata, but also required by the editor.
- Place selector definitions between:
    - `// ==Selectors==`
    - `// ==/Selectors==`
