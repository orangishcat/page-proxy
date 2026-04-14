import { describe, expect, test } from "bun:test";
import { buildSelectedScriptStorageKey } from "../../src/entrypoints/sidepanel/tools/script-selection-session";
import { toStorageKey } from "../../src/lib/stored-tool-state";

describe("unified app-state compatibility", () => {
  test("keeps script storage one key per script", () => {
    expect(toStorageKey("Docs Script")).toBe("pageproxy:Docs Script");
  });

  test("keeps hostname override in session key", () => {
    expect(buildSelectedScriptStorageKey("Docs.Example.com")).toBe("sidepanel:docs.example.com");
  });

  test("does not introduce persisted root blob", () => {
    const keys = [
      "pageproxy:show-help-button",
      "pageproxy:disable-all-grants",
      "pageproxy:Docs Script",
      "sidepanel:toolPanelHeightPx",
      "sidepanel:recordPanel:12",
      "sidepanel:helpBannerDismissed",
      "sidepanel:userscriptReloadBannerDismissed",
      "sidepanel:openTabs",
      "sidepanel:docs.example.com",
    ];

    expect(keys.includes("pageproxy:app-state")).toBe(false);
    expect(keys.includes("sidepanel:tabs")).toBe(false);
  });
});
