import { describe, expect, test } from "bun:test";
import {
  buildRobotsTxt,
  buildSitemapXml,
  createAbsoluteUrl,
  createTitle,
  indexedPaths,
} from "../../src/lib/seo";

describe("seo helpers", () => {
  test("builds canonical site urls", () => {
    expect(createAbsoluteUrl("/")).toBe("https://page-proxy.orangishcat.dev/");
    expect(createAbsoluteUrl("/install")).toBe("https://page-proxy.orangishcat.dev/install");
  });

  test("formats page titles consistently", () => {
    expect(createTitle()).toBe("Page Proxy");
    expect(createTitle("Install")).toBe("Install | Page Proxy");
  });

  test("generates a sitemap with each indexed path", () => {
    const sitemap = buildSitemapXml(indexedPaths);

    expect(sitemap).toContain("<urlset");
    expect(sitemap).toContain("<loc>https://page-proxy.orangishcat.dev/</loc>");
    expect(sitemap).toContain("<loc>https://page-proxy.orangishcat.dev/install</loc>");
  });

  test("generates robots.txt with a sitemap declaration", () => {
    expect(buildRobotsTxt()).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://page-proxy.orangishcat.dev/sitemap.xml",
    );
  });
});
