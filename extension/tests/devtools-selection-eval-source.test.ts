import { describe, expect, test } from "bun:test";

import { buildSelectionEvalSource } from "../src/entrypoints/devtools/eval-source";

describe("buildSelectionEvalSource", () => {
  test("strips export default after a leading comment block", () => {
    const rawSource = [
      "/**",
      " * comment",
      " */",
      "export default function (selectParent) {",
      "  return { selectParent };",
      "}",
    ].join("\n");

    const result = buildSelectionEvalSource(rawSource, false);

    expect(result).not.toContain("export default");
    expect(result).toContain("function (selectParent) {");
    expect(result).toEndWith(")(false)");
  });
});
