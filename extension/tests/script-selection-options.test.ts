import { describe, expect, test } from "bun:test";

const { shouldShowScriptDropdown } = await import("../src/entrypoints/sidepanel/tools/code-editor/state");

describe("script selection options", () => {
  test("shows the script dropdown when at least one script option is available", () => {
    expect(shouldShowScriptDropdown([])).toBe(false);
    expect(
      shouldShowScriptDropdown([{ scriptName: "Page Proxy", websiteGlob: "https://docs.example.com/*" }]),
    ).toBe(true);
    expect(
      shouldShowScriptDropdown([
        { scriptName: "Page Proxy", websiteGlob: "https://docs.example.com/*" },
        { scriptName: "Page Proxy 2", websiteGlob: "https://docs.example.com/reference/*" },
      ]),
    ).toBe(true);
  });
});
