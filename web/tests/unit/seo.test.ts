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
    expect(createAbsoluteUrl("/")).toBe("https://orangishcat.github.io/page-proxy/");
    expect(createAbsoluteUrl("/install")).toBe("https://orangishcat.github.io/page-proxy/install");
  });

  test("formats page titles consistently", () => {
    expect(createTitle()).toBe("Page Proxy");
    expect(createTitle("Install")).toBe("Install | Page Proxy");
  });

  test("generates a sitemap with each indexed path", () => {
    const sitemap = buildSitemapXml(indexedPaths);

    expect(sitemap).toContain("<urlset");
    expect(sitemap).toContain("<loc>https://orangishcat.github.io/page-proxy/</loc>");
    expect(sitemap).toContain("<loc>https://orangishcat.github.io/page-proxy/install</loc>");
  });

  test("generates robots.txt with a sitemap declaration", () => {
    expect(buildRobotsTxt()).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://orangishcat.github.io/page-proxy/sitemap.xml",
    );
  });
});
