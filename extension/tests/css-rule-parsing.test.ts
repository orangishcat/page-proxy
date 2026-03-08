import { describe, expect, test } from "bun:test";
import {
  buildCssBlock,
  extractCssBlockForSelector,
  extractCssSelectorsFromStyleText,
  parseCssRuleBlocks,
} from "../src/lib/utils/css-rule-parsing";

describe("extractCssSelectorsFromStyleText", () => {
  test("returns a single selector for a simple rule", () => {
    expect(extractCssSelectorsFromStyleText("header { border: none; }")).toEqual(["header"]);
  });

  test("keeps comma-separated selector groups as one entry", () => {
    expect(extractCssSelectorsFromStyleText("#a,.b,#c { display: none; }")).toEqual(["#a,.b,#c"]);
  });

  test("returns one entry per CSS rule, not per individual selector", () => {
    const css = `
#popups-overlay,.overdue-popups-large,#popups-loading {
  display: none;
}
#overdue-submissions h4 {
  margin: 5px 0 !important;
}
header {
  border: none !important;
}`;
    expect(extractCssSelectorsFromStyleText(css)).toEqual([
      "#popups-overlay,.overdue-popups-large,#popups-loading",
      "#overdue-submissions h4",
      "header",
    ]);
  });

  test("skips @-rules", () => {
    const css = `@media (max-width: 600px) { .foo { color: red; } }`;
    expect(extractCssSelectorsFromStyleText(css)).toEqual([".foo"]);
  });

  test("deduplicates identical selector groups", () => {
    expect(extractCssSelectorsFromStyleText("h1 { color: red; } h1 { color: blue; }")).toEqual(["h1"]);
  });

  test("normalizes internal whitespace in selector text", () => {
    expect(extractCssSelectorsFromStyleText("h1   h2 { color: red; }")).toEqual(["h1 h2"]);
  });

  test("returns empty array for empty input", () => {
    expect(extractCssSelectorsFromStyleText("")).toEqual([]);
  });
});

describe("parseCssRuleBlocks", () => {
  test("parses a single rule into selector and declarations", () => {
    expect(parseCssRuleBlocks("header { border: none; }")).toEqual([
      { selector: "header", declarations: "border: none;" },
    ]);
  });

  test("parses multiple rules", () => {
    expect(parseCssRuleBlocks("h1 { color: red; } h2 { color: blue; }")).toEqual([
      { selector: "h1", declarations: "color: red;" },
      { selector: "h2", declarations: "color: blue;" },
    ]);
  });

  test("keeps comma-separated selector group intact as one block", () => {
    expect(parseCssRuleBlocks("#a,.b { display: none; }")).toEqual([
      { selector: "#a,.b", declarations: "display: none;" },
    ]);
  });

  test("records empty declarations as empty string", () => {
    expect(parseCssRuleBlocks("header {}")).toEqual([{ selector: "header", declarations: "" }]);
  });

  test("returns empty array for empty input", () => {
    expect(parseCssRuleBlocks("")).toEqual([]);
  });
});

describe("buildCssBlock", () => {
  test("wraps selector and declarations in braces", () => {
    expect(buildCssBlock("header", "border: none;")).toBe("header {\n  border: none;\n}");
  });

  test("indents each declaration line", () => {
    expect(buildCssBlock("h1", "color: red;\nmargin: 0;")).toBe("h1 {\n  color: red;\n  margin: 0;\n}");
  });

  test("produces selector with empty braces when no declarations", () => {
    expect(buildCssBlock("header", "")).toBe("header {}");
  });
});

describe("extractCssBlockForSelector", () => {
  const code = `ps.injectCSS(\`
#popups-overlay,.overdue-popups-large,#popups-loading {
  display: none;
}
#overdue-submissions h4 {
  margin: 5px 0 !important;
}
header {
  border: none !important;
}
\`);`;

  test("extracts a simple selector's block from ps.injectCSS", () => {
    expect(extractCssBlockForSelector(code, "header")).toBe("header {\n  border: none !important;\n}");
  });

  test("extracts the full comma-grouped selector block", () => {
    expect(extractCssBlockForSelector(code, "#popups-overlay,.overdue-popups-large,#popups-loading")).toBe(
      "#popups-overlay,.overdue-popups-large,#popups-loading {\n  display: none;\n}",
    );
  });

  test("matches selector case-insensitively and ignores extra whitespace", () => {
    expect(extractCssBlockForSelector(code, "HEADER")).toBe("header {\n  border: none !important;\n}");
    expect(extractCssBlockForSelector(code, "  header  ")).toBe("header {\n  border: none !important;\n}");
  });

  test("returns null when selector is not found", () => {
    expect(extractCssBlockForSelector(code, ".missing")).toBeNull();
  });

  test("returns null when code contains no ps.injectCSS call", () => {
    expect(extractCssBlockForSelector("const x = 1;", "header")).toBeNull();
  });

  test("searches across multiple ps.injectCSS calls", () => {
    const multiCode = `
ps.injectCSS(\`h1 { color: red; }\`);
ps.injectCSS(\`h2 { color: blue; }\`);
    `;
    expect(extractCssBlockForSelector(multiCode, "h2")).toBe("h2 {\n  color: blue;\n}");
  });
});
