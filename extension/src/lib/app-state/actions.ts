import type { RecordPanelState } from "../../entrypoints/sidepanel/tools/storage/record-panel";
import type { StoredToolState } from "../stored-tool-state";
import type { EditorApi, ElementEntry, ScriptMetadataState } from "../sidepanel-editor-state";
import { coerceScriptGrantValues } from "../grants";
import log from "../logger";
import { appState } from "./state.svelte";
import type { ToolId } from "../stored-tool-state";
import { appStateSelectors } from "./selectors";

const logger = log.getLogger("app-state-actions");

export const appStateActions = {
  setShowHelpButton(value: boolean) {
    appState.settings.showHelpButton = value;
    logger.debug("set showHelpButton", { value });
  },
  setDisableAllGrants(value: boolean) {
    appState.settings.disableAllGrants = value;
    logger.debug("set disableAllGrants", { value });
  },
  setActiveTool(value: ToolId) {
    const activeScript = appStateSelectors.getActiveScript();
    if (!activeScript) {
      return;
    }

    appState.scriptsByName[activeScript.scriptName] = {
      ...activeScript,
      activeTool: value,
      updatedAt: Date.now(),
      permissions: {
        ...activeScript.permissions,
        allowedGrants: coerceScriptGrantValues(activeScript.permissions.allowedGrants),
      },
    };
    logger.debug("set activeTool", { value });
  },
  setToolPanelHeight(value: number | undefined) {
    appState.sidepanel.toolPanelHeightPx = value;
    logger.debug("set toolPanelHeightPx", { value });
  },
  dismissBanner(
    id:
      | "helpBannerDismissed"
      | "unsupportedBrowserBannerDismissed"
      | "firefoxExperimentalBannerDismissed"
      | "userscriptEnableBannerDismissed"
      | "userscriptReloadBannerDismissed",
  ) {
    appState.sidepanel[id] = true;
    logger.debug("dismiss banner", { id });
  },
  upsertStoredToolState(value: StoredToolState) {
    appState.scriptsByName[value.scriptName] = {
      ...value,
      permissions: {
        ...value.permissions,
        allowedGrants: coerceScriptGrantValues(value.permissions.allowedGrants),
      },
    };
    logger.debug("upsert stored tool state", { scriptName: value.scriptName });
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
    appState.scriptsByName[next.scriptName] = {
      ...next,
      permissions: {
        ...next.permissions,
        allowedGrants: coerceScriptGrantValues(next.permissions.allowedGrants),
      },
    };
    if (next.scriptName !== activeScriptName) {
      delete appState.scriptsByName[activeScriptName];
    }
    appState.currentTab.activeScriptName = next.scriptName;
    logger.debug("update active script", { from: activeScriptName, to: next.scriptName });
  },
  setActiveScriptAllowedGrants(value: StoredToolState["permissions"]["allowedGrants"]) {
    const activeScript = appStateSelectors.getActiveScript();
    if (!activeScript) {
      return;
    }

    appState.scriptsByName[activeScript.scriptName] = {
      ...activeScript,
      permissions: {
        ...activeScript.permissions,
        allowedGrants: coerceScriptGrantValues(value),
      },
      updatedAt: Date.now(),
    };
    logger.debug("set active script allowedGrants", { valueCount: value.length });
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
        allowedGrants: coerceScriptGrantValues(current.permissions.allowedGrants),
        enabled,
      },
      updatedAt: Date.now(),
    };
    logger.debug("set stored script enabled", { scriptName, enabled });
  },
  removeStoredToolState(scriptName: string) {
    delete appState.scriptsByName[scriptName];
    logger.debug("remove stored tool state", { scriptName });
  },
  setRecordPanelState(tabId: number, value: RecordPanelState) {
    appState.recordPanelsByTabId[String(tabId)] = value;
    logger.debug("set record panel state", { tabId });
  },
  removeRecordPanelState(tabId: number) {
    delete appState.recordPanelsByTabId[String(tabId)];
    logger.debug("remove record panel state", { tabId });
  },
  trimRecordPanels(limit = 5) {
    appState.recordPanelsByTabId = Object.fromEntries(
      Object.entries(appState.recordPanelsByTabId)
        .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
        .slice(0, limit),
    );
    logger.debug("trim record panels", { limit });
  },
  setSidePanelOpenForTab(tabId: number, isOpen: boolean) {
    const key = String(tabId);
    if (isOpen) {
      appState.session.openTabsByTabId[key] = true;
      logger.debug("set sidepanel open", { tabId, isOpen });
      return;
    }

    delete appState.session.openTabsByTabId[key];
    logger.debug("set sidepanel open", { tabId, isOpen });
  },
  setSelectedScriptForHostname(hostname: string, scriptName: string) {
    appState.session.selectedScriptByHostname[hostname.trim().toLowerCase()] = scriptName.trim();
    logger.debug("set selected script override", { hostname, scriptName });
  },
  clearSelectedScriptForHostname(hostname: string) {
    delete appState.session.selectedScriptByHostname[hostname.trim().toLowerCase()];
    logger.debug("clear selected script override", { hostname });
  },
  setCurrentTabElementEntries(value: ElementEntry[]) {
    appState.currentTab.elementEntries = value;
    logger.debug("set currentTab.elementEntries", { count: value.length });
  },
  setCurrentTabScriptMetadata(value: ScriptMetadataState) {
    appState.currentTab.scriptMetadata = value;
    logger.debug("set currentTab.scriptMetadata", { title: value.title });
  },
  setCurrentTabEditorApi(value: EditorApi | null) {
    appState.currentTab.editorApi = value;
    logger.debug("set currentTab.editorApi", { isReady: value !== null });
  },
};
