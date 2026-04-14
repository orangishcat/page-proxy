import type { RecordPanelState } from "../../entrypoints/sidepanel/tools/storage/record-panel";
import type { StoredToolState } from "../stored-tool-state";
import { appState } from "./state.svelte";

export const appStateActions = {
  setShowHelpButton(value: boolean) {
    appState.settings.showHelpButton = value;
  },
  setDisableAllGrants(value: boolean) {
    appState.settings.disableAllGrants = value;
  },
  setToolPanelHeight(value: number | undefined) {
    appState.sidepanel.toolPanelHeightPx = value;
  },
  dismissBanner(id: "helpBannerDismissed" | "userscriptReloadBannerDismissed") {
    appState.sidepanel[id] = true;
  },
  resetBanner(id: "helpBannerDismissed" | "userscriptReloadBannerDismissed") {
    appState.sidepanel[id] = false;
  },
  upsertStoredToolState(value: StoredToolState) {
    appState.scriptsByName[value.scriptName] = value;
  },
  updateActiveScript(updater: (script: StoredToolState) => StoredToolState) {
    const activeScriptName = appState.currentTab.activeScriptName;
    if (!activeScriptName) {
      throw new Error("No active script selected.");
    }

    const current = appState.scriptsByName[activeScriptName];
    if (!current) {
      throw new Error(`Missing script state for "${activeScriptName}".`);
    }

    const next = updater(current);
    appState.scriptsByName[next.scriptName] = next;
    if (next.scriptName !== activeScriptName) {
      delete appState.scriptsByName[activeScriptName];
    }
    appState.currentTab.activeScriptName = next.scriptName;
  },
  setStoredScriptEnabled(scriptName: string, enabled: boolean) {
    const current = appState.scriptsByName[scriptName];
    if (!current) {
      throw new Error(`No stored script found for "${scriptName}".`);
    }

    appState.scriptsByName[scriptName] = {
      ...current,
      permissions: {
        ...current.permissions,
        enabled,
      },
      updatedAt: Date.now(),
    };
  },
  removeStoredToolState(scriptName: string) {
    delete appState.scriptsByName[scriptName];
  },
  setRecordPanelState(tabId: number, value: RecordPanelState) {
    appState.recordPanelsByTabId[String(tabId)] = value;
  },
  trimRecordPanels(limit = 5) {
    appState.recordPanelsByTabId = Object.fromEntries(
      Object.entries(appState.recordPanelsByTabId)
        .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
        .slice(0, limit),
    );
  },
  setSidePanelOpenForTab(tabId: number, isOpen: boolean) {
    const key = String(tabId);
    if (isOpen) {
      appState.session.openTabsByTabId[key] = true;
      return;
    }

    delete appState.session.openTabsByTabId[key];
  },
  setSelectedScriptForHostname(hostname: string, scriptName: string) {
    appState.session.selectedScriptByHostname[hostname.trim().toLowerCase()] = scriptName.trim();
  },
  clearSelectedScriptForHostname(hostname: string) {
    delete appState.session.selectedScriptByHostname[hostname.trim().toLowerCase()];
  },
};
