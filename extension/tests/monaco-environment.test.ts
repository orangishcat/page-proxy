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
  test("resolves worker assets through extension runtime URLs for page contexts", () => {
    expect(environmentSource).toContain("?worker&url");
    expect(environmentSource).toContain("chrome.runtime.getURL");
    expect(environmentSource).not.toContain("?worker\";");
    expect(environmentSource).not.toContain('from "wxt/browser"');
    expect(environmentSource).not.toContain("new tsWorker()");
    expect(environmentSource).not.toContain("new editorWorker()");
  });

  test("exposes Monaco worker assets as web accessible resources", () => {
    expect(wxtConfigSource).toContain('resources: ["assets/*.worker-*.js"]');
  });
});
