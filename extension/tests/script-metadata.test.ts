import { describe, expect, test } from "bun:test";
import { parseScriptMetadata } from "../src/lib/utils/script-metadata";

describe("extension parseScriptMetadata", () => {
  test("parses required and optional metadata fields", () => {
    const metadata = parseScriptMetadata(`// ==Page Proxy==\n// @title My Script\n// @website https://example.com/*\n// @website https://other.example.com/*\n// @description First line\n// second line\n// @author Tim\n// @credits Team\n// contributor\n// @grant run-on-page-load\n// ==/Page Proxy==`);

    expect(metadata.title).toBe("My Script");
    expect(metadata.website).toBe("https://example.com/*");
    expect(metadata.websites).toEqual(["https://example.com/*", "https://other.example.com/*"]);
    expect(metadata.description).toBe("First line\nsecond line");
    expect(metadata.author).toBe("Tim");
    expect(metadata.credits).toBe("Team\ncontributor");
    expect(metadata.grants).toEqual(["run-on-page-load"]);
  });

  test("throws when metadata block is missing", () => {
    expect(() => parseScriptMetadata("// @title Missing block")).toThrow("Missing Page Proxy metadata block.");
  });

  test("throws on duplicate single-value fields", () => {
    expect(() =>
      parseScriptMetadata(`// ==Page Proxy==\n// @title A\n// @title B\n// @website https://example.com/*\n// @description Desc\n// ==/Page Proxy==`),
    ).toThrow("Duplicate @title metadata field.");
  });

  test("throws when required fields are missing", () => {
    expect(() =>
      parseScriptMetadata(`// ==Page Proxy==\n// @title A\n// @description Desc\n// ==/Page Proxy==`),
    ).toThrow("Invalid Page Proxy metadata block: missing @website.");
  });

  test("throws on invalid continuation lines", () => {
    expect(() =>
      parseScriptMetadata(`// ==Page Proxy==\n// @title A\n// @website https://example.com/*\n// @description Desc\nconst nope = true;\n// ==/Page Proxy==`),
    ).toThrow('Invalid metadata line: "const nope = true;".');
  });
});
