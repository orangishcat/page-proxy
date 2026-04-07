import { describe, expect, test } from "bun:test";
import { parseCssSelectorParts } from "../src/entrypoints/select-tool.content/css-inspector/css-inspector";

describe("parseCssSelectorParts", () => {
  test("returns empty array for empty selector", () => {
    expect(parseCssSelectorParts("")).toEqual([]);
    expect(parseCssSelectorParts("   ")).toEqual([]);
  });

  test("parses a type selector", () => {
    const parts = parseCssSelectorParts("div");
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("tag");
    expect(parts[0].text).toBe("div");
    expect(parts[0].key).toBe("tag");
    expect(parts[0].value).toBe("div");
  });

  test("parses a class selector", () => {
    const parts = parseCssSelectorParts(".foo");
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("class");
    expect(parts[0].text).toBe(".foo");
    expect(parts[0].key).toBe("class");
    expect(parts[0].value).toBe("foo");
  });

  test("parses an id selector", () => {
    const parts = parseCssSelectorParts("#bar");
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("id");
    expect(parts[0].text).toBe("#bar");
    expect(parts[0].key).toBe("id");
    expect(parts[0].value).toBe("bar");
  });

  test("parses an attribute selector with a value", () => {
    const parts = parseCssSelectorParts("[data-id='123']");
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("attribute");
    expect(parts[0].key).toBe("data-id");
    expect(parts[0].value).toBe("123");
  });

  test("parses an attribute selector without a value", () => {
    const parts = parseCssSelectorParts("[disabled]");
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("attribute");
    expect(parts[0].key).toBe("disabled");
    expect(parts[0].value).toBeNull();
  });

  test("parses a pseudo-class selector", () => {
    const parts = parseCssSelectorParts(":hover");
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("pseudo");
    expect(parts[0].text).toBe(":hover");
  });

  test("parses a pseudo-element selector", () => {
    const parts = parseCssSelectorParts("::before");
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("pseudo");
    expect(parts[0].text).toBe("::before");
  });

  test("parses a descendant combinator (space)", () => {
    const parts = parseCssSelectorParts("div span");
    const types = parts.map((p) => p.type);
    expect(types).toContain("tag");
    expect(types).toContain("descendant");
  });

  test("parses a child combinator (>)", () => {
    const parts = parseCssSelectorParts("div > span");
    const combinator = parts.find((p) => p.type === "combinator");
    expect(combinator?.text).toBe(">");
  });

  test("parses a comma-separated selector group", () => {
    const parts = parseCssSelectorParts("div, span");
    const groupPart = parts.find((p) => p.type === "group");
    expect(groupPart).toBeDefined();
    const tags = parts.filter((p) => p.type === "tag");
    expect(tags).toHaveLength(2);
  });

  test("parses compound selector (tag + class)", () => {
    const parts = parseCssSelectorParts("div.foo");
    const tag = parts.find((p) => p.type === "tag");
    const cls = parts.find((p) => p.type === "class");
    expect(tag?.text).toBe("div");
    expect(cls?.text).toBe(".foo");
  });

  test("assigns unique string ids to each part", () => {
    const parts = parseCssSelectorParts("div .foo #bar");
    const ids = parts.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("populates startOffset and endOffset", () => {
    const selector = "div.foo";
    const parts = parseCssSelectorParts(selector);
    for (const part of parts) {
      expect(part.startOffset).toBeGreaterThanOrEqual(0);
      expect(part.endOffset).toBeGreaterThan(part.startOffset);
      expect(part.endOffset).toBeLessThanOrEqual(selector.length);
    }
  });

  test("produces a description for each part", () => {
    const parts = parseCssSelectorParts("div.foo:hover");
    for (const part of parts) {
      expect(typeof part.description).toBe("string");
      expect(part.description.length).toBeGreaterThan(0);
    }
  });
});
