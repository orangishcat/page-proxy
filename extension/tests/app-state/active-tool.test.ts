import { beforeEach, describe, expect, test } from "bun:test";

import { createDefaultAppState } from "../../src/lib/app-state/defaults";
import { appState, replaceAppState } from "../../src/lib/app-state/state.svelte.ts";
import type { StoredToolState } from "../../src/lib/stored-tool-state";

const buildStoredState = (): StoredToolState => ({
  scriptName: "Page Proxy",
  codeEditor: {
    content: [
      "// ==Page Proxy==",
      "// @title Page Proxy",
      "// @website https://example.com/*",
      "// ==/Page Proxy==",
      "",
      "// ==Selectors==",
      "// ==/Selectors==",
      "",
    ].join("\n"),
  },
  selectorPanel: {
    entries: [],
  },
  permissions: {
    allowedGrants: [],
    enabled: true,
  },
  websiteGlob: "https://example.com/*",
  updatedAt: 1,
  runtimeStorage: {
    pt: {},
    pn: {},
  },
});

describe("active tool state", () => {
  beforeEach(() => {
    replaceAppState(createDefaultAppState());
  });

  test("stores the active tool globally when no active script is selected", async () => {
    const { appStateActions } = await import("../../src/lib/app-state/actions.ts");
    const { appStateSelectors } = await import("../../src/lib/app-state/selectors.ts");

    appState.currentTab.isProtectedPage = true;
    appState.currentTab.activeScriptName = null;

    appStateActions.setActiveTool("selectors");

    expect(appState.sidepanel.activeTool).toBe("selectors");
    expect(appStateSelectors.getActiveTool()).toBe("selectors");
  });

  test("does not write the active tool back into stored scripts", async () => {
    const { appStateActions } = await import("../../src/lib/app-state/actions.ts");
    const { appStateSelectors } = await import("../../src/lib/app-state/selectors.ts");

    appState.scriptsByName["Page Proxy"] = buildStoredState();
    appState.currentTab.activeScriptName = "Page Proxy";

    appStateActions.setActiveTool("record");

    expect(appState.sidepanel.activeTool).toBe("record");
    expect("activeTool" in (appState.scriptsByName["Page Proxy"] ?? {})).toBe(false);
    expect(appStateSelectors.getActiveTool()).toBe("record");
  });
});
