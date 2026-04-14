import { browser } from "wxt/browser";
import { appState } from "./state.svelte";
import { setApplyingRemoteSync } from "./state.svelte";
import { RecordPanelEntrySchema, ScriptStorageEntrySchema, SessionOpenTabsSchema } from "./schema";

let isRegistered = false;

const handleScriptStorageChange = (key: string, newValue: unknown) => {
  const scriptName = key.slice("pageproxy:".length);
  if (!scriptName || scriptName === "show-help-button" || scriptName === "disable-all-grants") {
    return;
  }

  const parsed = ScriptStorageEntrySchema.safeParse(newValue);
  if (parsed.success) {
    appState.scriptsByName[scriptName] = parsed.data;
    return;
  }

  delete appState.scriptsByName[scriptName];
};

const handleRecordPanelChange = (key: string, newValue: unknown) => {
  const tabId = key.slice("sidepanel:recordPanel:".length);
  const parsed = RecordPanelEntrySchema.safeParse(newValue);
  if (parsed.success) {
    appState.recordPanelsByTabId[tabId] = parsed.data;
    return;
  }

  delete appState.recordPanelsByTabId[tabId];
};

const handleSessionSelectionChange = (key: string, newValue: unknown) => {
  const hostname = key.slice("sidepanel:".length).trim().toLowerCase();
  if (!hostname || hostname === "openTabs".toLowerCase()) {
    return;
  }

  if (typeof newValue === "string" && newValue.trim().length > 0) {
    appState.session.selectedScriptByHostname[hostname] = newValue.trim();
    return;
  }

  delete appState.session.selectedScriptByHostname[hostname];
};

const handleChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: chrome.storage.AreaName) => {
  setApplyingRemoteSync(true);
  try {
    for (const [key, change] of Object.entries(changes)) {
      if (areaName === "local") {
        if (key === "pageproxy:show-help-button") {
          if (typeof change.newValue === "boolean") {
            appState.settings.showHelpButton = change.newValue;
          }
          continue;
        }

        if (key === "pageproxy:disable-all-grants") {
          if (typeof change.newValue === "boolean") {
            appState.settings.disableAllGrants = change.newValue;
          }
          continue;
        }

        if (key.startsWith("pageproxy:")) {
          handleScriptStorageChange(key, change.newValue);
          continue;
        }

        if (key === "sidepanel:toolPanelHeightPx") {
          appState.sidepanel.toolPanelHeightPx =
            typeof change.newValue === "number" && Number.isFinite(change.newValue) && change.newValue > 0
              ? change.newValue
              : undefined;
          continue;
        }

        if (key === "sidepanel:helpBannerDismissed") {
          appState.sidepanel.helpBannerDismissed = change.newValue === true;
          continue;
        }

        if (key === "sidepanel:userscriptReloadBannerDismissed") {
          appState.sidepanel.userscriptReloadBannerDismissed = change.newValue === true;
          continue;
        }

        if (key.startsWith("sidepanel:recordPanel:")) {
          handleRecordPanelChange(key, change.newValue);
        }
        continue;
      }

      if (areaName === "session") {
        if (key === "sidepanel:openTabs") {
          appState.session.openTabsByTabId = SessionOpenTabsSchema.safeParse(change.newValue).success
            ? SessionOpenTabsSchema.parse(change.newValue)
            : {};
          continue;
        }

        if (key.startsWith("sidepanel:")) {
          handleSessionSelectionChange(key, change.newValue);
        }
      }
    }
  } finally {
    setApplyingRemoteSync(false);
  }
};

export const registerAppStateSync = () => {
  if (isRegistered) {
    return;
  }

  browser.storage.onChanged.addListener(handleChange);
  isRegistered = true;
};
