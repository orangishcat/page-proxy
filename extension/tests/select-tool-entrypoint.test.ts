import { describe, expect, test } from "bun:test";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const selectToolEntrypointPath = resolve(import.meta.dir, "../src/entrypoints/select-tool.content/index.ts");

describe("select tool content-script entrypoint", () => {
  test("lives at the WXT-discoverable select-tool.content root", async () => {
    const result = await access(selectToolEntrypointPath, constants.F_OK);

    expect(result).toBeNull();
  });
});
