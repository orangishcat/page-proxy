import { describe, expect, test } from "bun:test";

import {
  appendSelectorSnippet,
  buildDroppedFilterInsertText,
} from "../src/entrypoints/select-tool.content/popup/selector/selector-popup-dnd";

describe("appendSelectorSnippet", () => {
  test("appends selector fragments without introducing invalid whitespace", () => {
    expect(appendSelectorSnippet(".card", ".active")).toBe(".card.active");
    expect(appendSelectorSnippet(".card", "[data-state='open']")).toBe(".card[data-state='open']");
    expect(appendSelectorSnippet(".card", "button")).toBe(".card button");
  });

  test("formats combinators with surrounding whitespace", () => {
    expect(appendSelectorSnippet(".card", ">")).toBe(".card > ");
    expect(appendSelectorSnippet(".card >", ".label")).toBe(".card > .label");
  });
});

describe("buildDroppedFilterInsertText", () => {
  test("inserts a chained condition when dropped into an existing matches block", () => {
    const documentText = `pq.selector({\n  "matches": () => true,\n});`;
    const insertOffset = documentText.indexOf("});");

    expect(buildDroppedFilterInsertText(documentText, insertOffset, `el.textContent?.includes("Save")`)).toBe(
      `\n    && el.textContent?.includes("Save")`,
    );
  });

  test("keeps dropped code inline when inserted at an arrow body boundary", () => {
    const documentText = `"matches": () => result`;
    const insertOffset = documentText.indexOf("=>");

    expect(buildDroppedFilterInsertText(documentText, insertOffset, "el !== null")).toBe("el !== null");
  });
});
