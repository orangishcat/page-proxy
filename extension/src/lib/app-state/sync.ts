import { browser } from "wxt/browser";
import log from "../logger";
import { appState } from "./state.svelte";
import { setApplyingRemoteSync } from "./state.svelte";
import { RecordPanelEntrySchema, ScriptStorageEntrySchema, SessionOpenTabsSchema } from "./schema";

let isRegistered = false;
const logger = log.getLogger("app-state-sync");

const handleScriptStorageChange = (key: string, newValue: unknown) => {
  const scriptName = key.slice("pageproxy:".length);
  if (!scriptName || scriptName === "show-help-button" || scriptName === "disable-all-grants") {
    logger.debug("ignore script storage key", { key });
    return;
  }

  const parsed = ScriptStorageEntrySchema.safeParse(newValue);
  if (parsed.success) {
    appState.scriptsByName[scriptName] = parsed.data;
    logger.debug("sync script storage entry", { scriptName });
    return;
  }

  delete appState.scriptsByName[scriptName];
  logger.debug("remove invalid script storage entry", { scriptName });
};

const handleRecordPanelChange = (key: string, newValue: unknown) => {
  const tabId = key.slice("sidepanel:recordPanel:".length);
  const parsed = RecordPanelEntrySchema.safeParse(newValue);
  if (parsed.success) {
    appState.recordPanelsByTabId[tabId] = parsed.data;
    logger.debug("sync record panel entry", { tabId });
    return;
  }

  delete appState.recordPanelsByTabId[tabId];
  logger.debug("remove invalid record panel entry", { tabId });
};

const handleSessionSelectionChange = (key: string, newValue: unknown) => {
  const hostname = key.slice("sidepanel:".length).trim().toLowerCase();
  if (!hostname || hostname === "openTabs".toLowerCase()) {
    logger.debug("ignore session sidepanel key", { key });
    return;
  }

  if (typeof newValue === "string" && newValue.trim().length > 0) {
    appState.session.selectedScriptByHostname[hostname] = newValue.trim();
    logger.debug("sync selected script override", { hostname });
    return;
  }

  delete appState.session.selectedScriptByHostname[hostname];
  logger.debug("remove selected script override", { hostname });
};

const handleChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: chrome.storage.AreaName) => {
  setApplyingRemoteSync(true);
  try {
    logger.debug("storage changed", { areaName, keys: Object.keys(changes) });
    for (const [key, change] of Object.entries(changes)) {
      if (areaName === "local") {
        if (key === "pageproxy:show-help-button") {
          if (typeof change.newValue === "boolean") {
            appState.settings.showHelpButton = change.newValue;
            logger.debug("sync showHelpButton", { value: change.newValue });
          }
          continue;
        }

        if (key === "pageproxy:disable-all-grants") {
          if (typeof change.newValue === "boolean") {
            appState.settings.disableAllGrants = change.newValue;
            logger.debug("sync disableAllGrants", { value: change.newValue });
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
          logger.debug("sync toolPanelHeightPx", { value: appState.sidepanel.toolPanelHeightPx });
          continue;
        }

        if (key === "sidepanel:helpBannerDismissed") {
          appState.sidepanel.helpBannerDismissed = change.newValue === true;
          logger.debug("sync helpBannerDismissed", { value: appState.sidepanel.helpBannerDismissed });
          continue;
        }

        if (key === "sidepanel:userscriptReloadBannerDismissed") {
          appState.sidepanel.userscriptReloadBannerDismissed = change.newValue === true;
          logger.debug("sync userscriptReloadBannerDismissed", {
            value: appState.sidepanel.userscriptReloadBannerDismissed,
          });
          continue;
        }

        if (key.startsWith("sidepanel:recordPanel:")) {
          handleRecordPanelChange(key, change.newValue);
          continue;
        }
        logger.debug("ignore local storage key", { key });
        continue;
      }

      if (areaName === "session") {
        if (key === "sidepanel:openTabs") {
          appState.session.openTabsByTabId = SessionOpenTabsSchema.safeParse(change.newValue).success
            ? SessionOpenTabsSchema.parse(change.newValue)
            : {};
          logger.debug("sync openTabs", { count: Object.keys(appState.session.openTabsByTabId).length });
          continue;
        }

        if (key.startsWith("sidepanel:")) {
          handleSessionSelectionChange(key, change.newValue);
          continue;
        }
        logger.debug("ignore session storage key", { key });
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
