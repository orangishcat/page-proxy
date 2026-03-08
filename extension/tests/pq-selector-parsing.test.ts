import { describe, expect, test } from "bun:test";
import { findPqSelectorDefinitionBlockByName } from "../src/lib/utils/pq-selector-parsing";

describe("findPqSelectorDefinitionBlockByName", () => {
  test("finds a selector declaration by its pq.selector name property", () => {
    const code = `
const overdueWrapper = pq.selector({
  "name": "main div wrapper with id",
  "baseSelector": "#overdue-submissions",
  "matches": e => true,
});

const anotherSelector = pq.selector({
  "name": "secondary selector",
  "baseSelector": ".secondary",
  "matches": e => true,
});
`;

    expect(findPqSelectorDefinitionBlockByName(code, "main div wrapper with id")?.code).toBe(`const overdueWrapper = pq.selector({
  "name": "main div wrapper with id",
  "baseSelector": "#overdue-submissions",
  "matches": e => true,
});`);
  });
});
