import { describe, expect, test } from "bun:test";
import { parseScriptMetadata } from "../../src/lib/utils/script-metadata";

describe("parseScriptMetadata", () => {
  test("parses title and website from script metadata", () => {
    const script =
      "// ==Page Proxy==\n// @title Steam redesign\n// @website https://store.steampowered.com\n// ==/Page Proxy==";
    const metadata = parseScriptMetadata(script);
    expect(metadata).not.toBeNull();
    expect(metadata?.title).toBe("Steam redesign");
    expect(metadata?.website).toBe("https://store.steampowered.com");
  });

  test("accepts flexible spacing and colon separators", () => {
    const script =
      "// ==  Page   Proxy  ==\n// @title: Another title\n// @website: https://example.com\n// == / Page Proxy ==";
    const metadata = parseScriptMetadata(script);
    expect(metadata).not.toBeNull();
    expect(metadata?.title).toBe("Another title");
    expect(metadata?.website).toBe("https://example.com");
  });

  test("preserves multiline descriptions", () => {
    const script =
      "// ==Page Proxy==\n// @title Make links not draggable\n// @website *://*/*\n// @description A tiny mouse movement between mouse button down\n// and mouse button up on a button turns it into a drag instead\n// of a click. This sets all links and buttons to not draggable,\n// fixing this issue.\n// ==/Page Proxy==";
    const metadata = parseScriptMetadata(script);
    expect(metadata).not.toBeNull();
    expect(metadata?.description).toBe(
      "A tiny mouse movement between mouse button down\nand mouse button up on a button turns it into a drag instead\nof a click. This sets all links and buttons to not draggable,\nfixing this issue.",
    );
  });

  test("returns null when metadata block is missing", () => {
    const metadata = parseScriptMetadata("// @title Missing wrapper");
    expect(metadata).toBeNull();
  });
});
