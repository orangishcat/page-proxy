import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

import { buildPpBrowserBundle, defaultPpBrowserBundleOutputFile } from "../scripts/build-browser-bundle.mjs";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  }

  delete (globalThis as typeof globalThis & Record<string, unknown>).pa;
  delete (globalThis as typeof globalThis & Record<string, unknown>).pn;
  delete (globalThis as typeof globalThis & Record<string, unknown>).pq;
  delete (globalThis as typeof globalThis & Record<string, unknown>).ps;
  delete (globalThis as typeof globalThis & Record<string, unknown>).pt;
  delete (globalThis as typeof globalThis & Record<string, unknown>).pv;
  delete (globalThis as typeof globalThis & Record<string, unknown>).pp;
});

describe("buildPpBrowserBundle", () => {
  test("publishes the runtime bundle to the web static asset path", () => {
    expect(defaultPpBrowserBundleOutputFile).toBe(
      path.resolve(import.meta.dir, "../../../web/static/pp/pp.min.js"),
    );
  });

  test("builds a browser bundle that exposes PP globals on globalThis", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "page-proxy-pp-bundle-"));
    tempDirs.push(tempDir);

    const outputFile = path.join(tempDir, "pp.min.js");
    await buildPpBrowserBundle({ outfile: outputFile });

    const builtCode = readFileSync(outputFile, "utf8");
    expect(builtCode.length).toBeGreaterThan(0);

    await import(pathToFileURL(outputFile).href);

    const target = globalThis as typeof globalThis & Record<string, unknown>;
    expect(target.pa).toBeTruthy();
    expect(target.pn).toBeTruthy();
    expect(target.pq).toBeTruthy();
    expect(target.ps).toBeTruthy();
    expect(target.pt).toBeTruthy();
    expect(target.pv).toBeTruthy();
    expect(target.pp).toBe((target.pa as { pp?: unknown }).pp);
  });
});
