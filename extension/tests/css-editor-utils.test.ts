import { describe, expect, test } from "bun:test";
import {
  buildInjectCssSnippet,
  parseCssDeclarations,
  removeCssDeclaration,
  upsertCssDeclaration,
} from "../src/entrypoints/select-tool.content/css-inspector/css-editor-utils";

describe("parseCssDeclarations", () => {
  test("parses a single declaration", () => {
    expect(parseCssDeclarations("color: red;")).toEqual([{ key: "color", value: "red", order: 0 }]);
  });

  test("parses multiple declarations", () => {
    expect(parseCssDeclarations("color: red;\nmargin: 0;")).toEqual([
      { key: "color", value: "red", order: 0 },
      { key: "margin", value: "0", order: 1 },
    ]);
  });

  test("lowercases property keys", () => {
    expect(parseCssDeclarations("COLOR: red;")).toEqual([{ key: "color", value: "red", order: 0 }]);
  });

  test("handles !important values", () => {
    expect(parseCssDeclarations("display: none !important;")).toEqual([
      { key: "display", value: "none !important", order: 0 },
    ]);
  });

  test("returns empty array for empty input", () => {
    expect(parseCssDeclarations("")).toEqual([]);
  });

  test("skips lines that are not valid declarations", () => {
    expect(parseCssDeclarations("color: red;\n\nmargin: 0;")).toEqual([
      { key: "color", value: "red", order: 0 },
      { key: "margin", value: "0", order: 1 },
    ]);
  });
});

describe("upsertCssDeclaration", () => {
  test("adds a new property to empty declarations", () => {
    expect(upsertCssDeclaration("", "color", "red")).toBe("color: red;");
  });

  test("adds a new property to existing declarations", () => {
    expect(upsertCssDeclaration("color: red;", "margin", "0")).toBe("color: red;\nmargin: 0;");
  });

  test("updates an existing property", () => {
    expect(upsertCssDeclaration("color: red;\nmargin: 0;", "color", "blue")).toBe("color: blue;\nmargin: 0;");
  });

  test("removes a property when value is empty string", () => {
    expect(upsertCssDeclaration("color: red;\nmargin: 0;", "color", "")).toBe("margin: 0;");
  });

  test("removes a property when value is whitespace only", () => {
    expect(upsertCssDeclaration("color: red;", "color", "   ")).toBe("");
  });

  test("is case-insensitive for property keys", () => {
    expect(upsertCssDeclaration("color: red;", "COLOR", "blue")).toBe("color: blue;");
  });
});

describe("removeCssDeclaration", () => {
  test("removes an existing property", () => {
    expect(removeCssDeclaration("color: red;\nmargin: 0;", "color")).toBe("margin: 0;");
  });

  test("returns unchanged string when property is not found", () => {
    expect(removeCssDeclaration("color: red;", "margin")).toBe("color: red;");
  });

  test("returns empty string when removing the only property", () => {
    expect(removeCssDeclaration("color: red;", "color")).toBe("");
  });

  test("is case-insensitive for property keys", () => {
    expect(removeCssDeclaration("color: red;", "COLOR")).toBe("");
  });
});

describe("buildInjectCssSnippet", () => {
  test("doubles selector backslashes before embedding CSS in a template literal", () => {
    const selector =
      "div.pb-\\[calc\\(var\\(--sidebar-section-margin-top\\)-var\\(--sidebar-section-first-margin-top\\)\\)\\]";

    expect(buildInjectCssSnippet(selector, "")).toBe(`ps.injectCSS(\`
div.pb-\\\\[calc\\\\(var\\\\(--sidebar-section-margin-top\\\\)-var\\\\(--sidebar-section-first-margin-top\\\\)\\\\)\\\\]
{
  
}
\`);`);
  });

  test("doubles declaration backslashes before embedding CSS in a template literal", () => {
    expect(buildInjectCssSnippet(".icon", "content: \"\\2192\";")).toBe(`ps.injectCSS(\`
.icon
{
  content: "\\\\2192";
}
\`);`);
  });
});
