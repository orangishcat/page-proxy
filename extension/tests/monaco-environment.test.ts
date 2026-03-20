import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const environmentSource = readFileSync(
  join(import.meta.dir, "../src/lib/code-editor/environment.ts"),
  "utf8",
);
const wxtConfigSource = readFileSync(
  join(import.meta.dir, "../wxt.config.ts"),
  "utf8",
);

describe("monaco worker environment", () => {
  test("uses inline workers for page contexts and extension URLs for extension pages", () => {
    expect(environmentSource).toContain("?worker&inline");
    expect(environmentSource).toContain("?worker&url");
    expect(environmentSource).toContain("location.protocol");
    expect(environmentSource).toContain("chrome.runtime.getURL");
    expect(environmentSource).not.toContain('from "wxt/browser"');
  });

  test("exposes Monaco worker assets as web accessible resources", () => {
    expect(wxtConfigSource).toContain('resources: ["assets/*.worker-*.js"]');
  });
});
