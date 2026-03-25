import { describe, expect, test } from "bun:test";
import { createLandingExampleScript } from "../../src/lib/components/landing/landing-example-script";

describe("createLandingExampleScript", () => {
  test("builds curated landing example data from script metadata", () => {
    const result = createLandingExampleScript({
      id: "steam-redesign",
      fileName: "steam-redesign.js",
      content:
        "// ==Page Proxy==\n// @title Steam redesign\n// @website https://store.steampowered.com/*\n// @description Restyles the storefront\n// ==/Page Proxy==",
      category: "Storefront",
      cardDescription: "A more polished storefront layout.",
    });

    expect(result.id).toBe("steam-redesign");
    expect(result.title).toBe("Steam redesign");
    expect(result.website).toBe("https://store.steampowered.com/*");
    expect(result.description).toBe("Restyles the storefront");
    expect(result.category).toBe("Storefront");
    expect(result.cardDescription).toBe("A more polished storefront layout.");
    expect(result.downloadName).toBe("steam-redesign.js");
  });
});
