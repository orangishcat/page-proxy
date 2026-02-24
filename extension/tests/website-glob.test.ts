import { describe, expect, test } from "bun:test";
import { buildWebsiteGlobForUrl, isAllowedUrl, isRestrictedUrl, matchWebsiteGlob } from "../src/lib/utils/website-glob";

describe("website glob utilities", () => {
  test("isAllowedUrl accepts supported protocols", () => {
    expect(isAllowedUrl("https://example.com")).toBe(true);
    expect(isAllowedUrl("http://example.com")).toBe(true);
    expect(isAllowedUrl("ws://example.com/socket")).toBe(true);
    expect(isAllowedUrl("wss://example.com/socket")).toBe(true);
  });

  test("isAllowedUrl rejects invalid or unsupported protocols", () => {
    expect(isAllowedUrl("ftp://example.com")).toBe(false);
    expect(isAllowedUrl("not-a-url")).toBe(false);
    expect(isAllowedUrl()).toBe(false);
  });

  test("isRestrictedUrl mirrors isAllowedUrl", () => {
    expect(isRestrictedUrl("https://example.com")).toBe(false);
    expect(isRestrictedUrl("file:///tmp/test")).toBe(true);
  });

  test("matchWebsiteGlob trims whitespace", () => {
    expect(matchWebsiteGlob("  https://*.example.com/*  ", " https://a.example.com/path ")).toBe(true);
    expect(matchWebsiteGlob("https://*.example.com/*", "https://example.org/path")).toBe(false);
  });

  test("buildWebsiteGlobForUrl builds origin glob", () => {
    expect(buildWebsiteGlobForUrl("https://example.com/path?q=1")).toBe("https://example.com/*");
    expect(buildWebsiteGlobForUrl("ws://socket.example.com/connect")).toBe("ws://socket.example.com/*");
    expect(buildWebsiteGlobForUrl("file:///tmp/test")).toBe("");
  });
});
