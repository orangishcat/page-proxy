import { appState } from "./state.svelte";
import type { RecordPanelState } from "../../entrypoints/sidepanel/tools/storage/record-panel";

export const appStateSelectors = {
  getShowHelpButton: () => appState.settings.showHelpButton,
  getDisableAllGrants: () => appState.settings.disableAllGrants,
  getSidepanelState: () => appState.sidepanel,
  getToolPanelHeight: () => appState.sidepanel.toolPanelHeightPx,
  getActiveTool: () => appState.currentTab.activeScriptName ? appState.scriptsByName[appState.currentTab.activeScriptName]?.activeTool ?? "none" : "none",
  getActiveScript: () =>
    appState.currentTab.activeScriptName ? appState.scriptsByName[appState.currentTab.activeScriptName] ?? null : null,
  getStoredToolStates: () => Object.values(appState.scriptsByName),
  getStoredToolState: (scriptName: string) => appState.scriptsByName[scriptName] ?? null,
  getStoredScriptEnabled: (scriptName: string) => appState.scriptsByName[scriptName]?.permissions.enabled ?? true,
  getOpenTabsByTabId: () => appState.session.openTabsByTabId,
  getSelectedScriptByHostnameMap: () => appState.session.selectedScriptByHostname,
  getSelectedScriptForHostname: (hostname: string) =>
    appState.session.selectedScriptByHostname[hostname.trim().toLowerCase()] ?? null,
  getRecordPanelState: (tabId: number): RecordPanelState | null => appState.recordPanelsByTabId[String(tabId)] ?? null,
  getRecordPanelsByTabId: () => appState.recordPanelsByTabId,
  getAvailableScriptOptions: () => appState.currentTab.availableScriptOptions,
  getActiveScriptName: () => appState.currentTab.activeScriptName,
  getDefaultScriptName: () => appState.currentTab.defaultScriptName,
  getActiveWebsiteGlob: () => appState.currentTab.activeWebsiteGlob,
};
