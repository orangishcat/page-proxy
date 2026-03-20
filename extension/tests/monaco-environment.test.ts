import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import wxtConfig from "../wxt.config";
import { resolveMonacoWorkerMode } from "../src/lib/code-editor/worker-strategy";

const environmentSource = readFileSync(
  join(import.meta.dir, "../src/lib/code-editor/environment.ts"),
  "utf8",
);
const wxtConfigSource = readFileSync(
  join(import.meta.dir, "../wxt.config.ts"),
  "utf8",
);

describe("monaco worker environment", () => {
  test("uses extension worker URLs whenever extension runtime APIs are available", () => {
    expect(resolveMonacoWorkerMode({ hasRuntimeGetUrl: true })).toBe("extension-url");
    expect(resolveMonacoWorkerMode({ hasRuntimeGetUrl: false })).toBe("inline");
  });

  test("exposes Monaco worker assets as web accessible resources", () => {
    expect(wxtConfigSource).toContain('resources: ["assets/*.worker-*.js"]');
  });

  test("keeps sourcemaps in development only", async () => {
    const viteConfigFactory = wxtConfig.vite;
    expect(viteConfigFactory).toBeDefined();
    if (!viteConfigFactory) {
      throw new Error("Expected WXT config to define a vite factory.");
    }

    const devViteConfig = await viteConfigFactory({
      mode: "development",
      command: "serve",
      browser: "chrome",
      manifestVersion: 3,
    });
    const prodViteConfig = await viteConfigFactory({
      mode: "production",
      command: "build",
      browser: "chrome",
      manifestVersion: 3,
    });

    expect(devViteConfig.build?.sourcemap).toBe(true);
    expect(prodViteConfig.build?.sourcemap).toBe(false);
  });

  test("does not gate worker selection on the page protocol", () => {
    expect(environmentSource).not.toContain("location.protocol");
  });
});
