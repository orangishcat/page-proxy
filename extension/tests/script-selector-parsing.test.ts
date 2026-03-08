import { describe, expect, test } from "bun:test";
import { extractScriptSelectorEntries } from "../src/lib/utils/script-selector-parsing";

describe("extractScriptSelectorEntries", () => {
  test("parses pq selectors and static ps.injectCSS blocks from editor code", () => {
    const code = `
const overdueWrapper = pq.selector({
  name: "main div wrapper with id",
  baseSelector: "#overdue-submissions",
  matches: (element) =>
    pq.tagMatches(element, "div") &&
    pq.selectorMatches(element, "#overdue-submissions > div") &&
    pq.innerTextMatches(element, /Overdue/i),
});

ps.injectCSS(\`
header, .hero {
  color: red;
}

main {
  color: blue;
}
\`);
`;

    expect(extractScriptSelectorEntries(code)).toEqual([
      {
        name: "main div wrapper with id",
        ruleKeys: [
          "baseSelector: #overdue-submissions",
          "tag: div",
          "selector: #overdue-submissions > div",
          "innerText",
        ],
        rules: [
          "baseSelector: #overdue-submissions",
          "tag: div",
          "selector: #overdue-submissions > div",
          "innerText",
        ],
        mode: "pp-api",
      },
      {
        name: "header, .hero",
        ruleKeys: ["selector: header, .hero"],
        rules: ["selector: header, .hero"],
        mode: "css",
        cssText: "header, .hero {\n  color: red;\n}",
      },
      {
        name: "main",
        ruleKeys: ["selector: main"],
        rules: ["selector: main"],
        mode: "css",
        cssText: "main {\n  color: blue;\n}",
      },
    ]);
  });

  test("ignores dynamic ps.injectCSS expressions", () => {
    const code = `
const color = "red";
ps.injectCSS(\`header { color: \${color}; }\`);
ps.injectCSS("main { color: blue; }");
`;

    expect(extractScriptSelectorEntries(code)).toEqual([
      {
        name: "main",
        ruleKeys: ["selector: main"],
        rules: ["selector: main"],
        mode: "css",
        cssText: "main {\n  color: blue;\n}",
      },
    ]);
  });

  test("skips unparsable CSS blocks while preserving other parsed entries", () => {
    const code = `
const wrapper = pq.selector({
  name: "wrapper",
  baseSelector: "#wrapper",
  matches: (element) => pq.bboxMatches(element, () => true),
});

ps.injectCSS(\`@\`);
`;

    expect(extractScriptSelectorEntries(code)).toEqual([
      {
        name: "wrapper",
        ruleKeys: ["baseSelector: #wrapper", "bbox"],
        rules: ["baseSelector: #wrapper", "bbox"],
        mode: "pp-api",
      },
    ]);
  });

  test("returns an empty list for invalid JavaScript", () => {
    expect(extractScriptSelectorEntries("const x = ")).toEqual([]);
  });
});
