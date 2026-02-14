---
title: pq (Query API)
---

# pq module (v0.1.x)

## Core builders

- `pq.element(definition)` with `resolve()`
- `pq.selector(definition)` with `query()`, `queryAll()`, `matches()`, `onElementMatches()`

`pq.selector` supports:

- `baseSelector` (optional)
- `matches(element)` predicate
- `postMap(element)` transform

## Match helpers

- `tagMatches`
- `selectorMatches`
- `innerTextMatches`
- `bboxMatches`
- `propMatches`
- `propContains`
- `propExists`

## Parent traversal

`traverseParents(el, matcher, options?)` returns first parent match (or `null`).
