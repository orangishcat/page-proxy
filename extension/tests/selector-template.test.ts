import { describe, expect, test } from "bun:test";

import { buildSelectorTemplateCode } from "../src/entrypoints/select-tool.content/popup/selector";

describe("buildSelectorTemplateCode", () => {
  test("omits selector names and keeps matches discoverable", () => {
    const code = buildSelectorTemplateCode(".card");

    expect(code).toContain('baseSelector": ".card"');
    expect(code).toContain('"matches": e => true');
    expect(code).not.toContain("Style 1");
    expect(code).not.toContain('"name"');
  });
});
