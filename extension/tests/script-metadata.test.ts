import { describe, expect, test } from "bun:test";
import {
  buildWebsiteMetadataListing,
  extractWebsiteMetadataGlobs,
  normalizeScriptMetadataWebsites,
  parseScriptMetadata,
} from "../src/lib/utils/script-metadata";

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

  test("parses website continuation lines under a single @website key", () => {
    const metadata = parseScriptMetadata(`// ==Page Proxy==\n// @title My Script\n// @website https://example.com/*\n// https://other.example.com/*\n// https://another.example.com/*\n// @description First line\n// ==/Page Proxy==`);

    expect(metadata.website).toBe("https://example.com/*");
    expect(metadata.websites).toEqual([
      "https://example.com/*",
      "https://other.example.com/*",
      "https://another.example.com/*",
    ]);
  });

  test("normalizes multiple @website keys into one key with newline-separated values", () => {
    const script = `// ==Page Proxy==\n// @title My Script\n// @website https://example.com/*\n// @website https://other.example.com/*\n// @website https://another.example.com/*\n// @description Desc\n// ==/Page Proxy==\n\nconsole.log("hello");`;
    const normalized = normalizeScriptMetadataWebsites(script);

    expect(normalized).toContain(
      "// @website https://example.com/*\n// https://other.example.com/*\n// https://another.example.com/*",
    );
    expect((normalized.match(/\/\/\s*@website/g) ?? []).length).toBe(1);

    const metadata = parseScriptMetadata(normalized);
    expect(metadata.websites).toEqual([
      "https://example.com/*",
      "https://other.example.com/*",
      "https://another.example.com/*",
    ]);
  });

  test("extracts all website globs from mixed metadata website entries", () => {
    const websites = extractWebsiteMetadataGlobs(
      `// ==Page Proxy==\n// @title My Script\n// @website https://example.com/*\n// https://other.example.com/*\n// @website https://another.example.com/*\n// @description Desc\n// ==/Page Proxy==`,
    );

    expect(websites).toEqual([
      "https://example.com/*",
      "https://other.example.com/*",
      "https://another.example.com/*",
    ]);
  });

  test("builds website listing from multi-website values with single-value fallback", () => {
    expect(
      buildWebsiteMetadataListing(["https://example.com/*", "https://other.example.com/*"], "https://fallback.example/*"),
    ).toBe("https://example.com/*\nhttps://other.example.com/*");

    expect(buildWebsiteMetadataListing([], "https://fallback.example/*")).toBe("https://fallback.example/*");
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
