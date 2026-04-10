import { describe, expect, test } from "bun:test";
import { buildDefaultScript } from "../src/lib/default-script";

const defaultScriptConfig = {
  ppImportLines: ['import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";'],
  defineBlockStart: "// ==Selectors==",
  defineBlockEnd: "// ==/Selectors==",
};

describe("buildDefaultScript", () => {
  test("includes a default @version metadata line", () => {
    const script = buildDefaultScript("https://example.com/*", defaultScriptConfig, "My Script");

    expect(script).toContain("// @version 0.1.0");
  });
});
