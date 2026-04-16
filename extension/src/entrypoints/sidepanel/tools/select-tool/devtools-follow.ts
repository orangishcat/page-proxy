import { browser } from "wxt/browser";
import log from "@/lib/logger";
import { get } from "svelte/store";

import type {
  DevtoolsSelectionChangedRuntimeMessage,
  DevtoolsSelectionStatusChangedRuntimeMessage,
  DevtoolsSelectionResponseMessage,
} from "@/lib/devtools-selection";
import { isRecord } from "@/lib/utils/type-guards";
import { setToolMessage } from "../tool-errors";
import {
  followDevtoolsSelection,
  setDevtoolsIntegrationDetected,
  setFollowDevtoolsSelection,
  setSelection,
  setSelectModeEnabled,
} from "./state";
import { isRestrictedUrl, readActiveTabContext, runContentSelectionToggle } from "./content-messaging";
import {
  isDevtoolsSelectionChangedMessage,
  isDevtoolsStatusChangedMessage,
  requestDevtoolsSelection,
  requestDevtoolsStatus,
} from "./devtools";
import { isSelectToolMessage } from "./guards";
import { recordSelectedElement, shouldSuppressSelectedElementRecord } from "./recording";

const logger = log.getLogger("select-tool-sidepanel");

const logIgnoredError = (message: string, error: unknown, extra: Record<string, unknown> = {}) => {
  logger.debug(message, { error, ...extra });
};

const isFollowingDevtoolsSelection = () => get(followDevtoolsSelection);

export const applyDevtoolsSelection = (tabId: number, response: DevtoolsSelectionResponseMessage) => {
  if (!response.ok || !response.selection) {
    logger.debug("skip applying devtools selection response", {
      tabId,
      ok: response.ok,
      hasSelection: Boolean(response.selection),
    });
    return false;
  }

  logger.debug("apply devtools selection response", {
    tabId,
    selector: response.selection.info.selector,
    frameId: response.selection.frameId,
    frameUrl: response.selection.frameUrl,
  });
  setSelection(response.selection.info, {
    source: "devtools",
    tabId,
    frameId: response.selection.frameId,
    frameUrl: response.selection.frameUrl,
  });
  setSelectModeEnabled(false);
  setToolMessage(null, "error");
  return true;
};

const syncSelectionFromDevtools = async (tabId: number) => {
  logger.debug("sync devtools selection start", { tabId });
  const response = await requestDevtoolsSelection(tabId, "devtools:selection:get");
  if (!response || !response.ok) {
    logger.debug("sync devtools selection failed", {
      tabId,
      ok: response?.ok ?? null,
      hasSelection: Boolean(response?.selection),
    });
    return false;
  }

  if (!response.selection) {
    logger.debug("sync devtools selection cleared selection", { tabId });
    setSelection(null);
    setSelectModeEnabled(false);
    setToolMessage(null, "error");
    return true;
  }

  return applyDevtoolsSelection(tabId, response);
};

export const trySelectWithDevtools = async (tabId: number) => {
  const devtoolsOpen = await requestDevtoolsStatus(tabId);
  setDevtoolsIntegrationDetected(devtoolsOpen);
  if (!devtoolsOpen || !isFollowingDevtoolsSelection()) {
    return false;
  }

  return syncSelectionFromDevtools(tabId);
};

const refreshDevtoolsIntegrationForActiveTab = () => {
  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext || isRestrictedUrl(tabContext.url)) {
        setDevtoolsIntegrationDetected(false);
        return;
      }

      const devtoolsOpen = await requestDevtoolsStatus(tabContext.tabId);
      setDevtoolsIntegrationDetected(devtoolsOpen);
      if (!devtoolsOpen || !isFollowingDevtoolsSelection()) {
        return;
      }

      try {
        await syncSelectionFromDevtools(tabContext.tabId);
      } catch (error) {
        logIgnoredError("Unable to sync selection from DevTools for active tab.", error, { tabId: tabContext.tabId });
      }
    })
    .catch((error) => {
      setDevtoolsIntegrationDetected(false);
      logIgnoredError("Unable to refresh DevTools integration for active tab.", error);
    });
};

export const applyDevtoolsSelectionChangedMessage = (message: DevtoolsSelectionChangedRuntimeMessage) => {
  logger.debug("apply devtools selection changed message", {
    tabId: message.tabId,
    hasSelection: Boolean(message.selection),
    selector: message.selection?.info.selector ?? null,
    frameId: message.selection?.frameId ?? null,
    frameUrl: message.selection?.frameUrl ?? null,
  });
  setDevtoolsIntegrationDetected(true);

  if (!isFollowingDevtoolsSelection()) {
    logger.debug("skip devtools selection changed message because follow mode is off", {
      tabId: message.tabId,
    });
    return;
  }

  if (!message.selection) {
    logger.debug("clear selection from devtools message", { tabId: message.tabId });
    setSelection(null);
    return;
  }

  logger.debug("apply selection from devtools message", {
    tabId: message.tabId,
    selector: message.selection.info.selector,
    frameId: message.selection.frameId,
    frameUrl: message.selection.frameUrl,
  });
  setSelection(message.selection.info, {
    source: "devtools",
    tabId: message.tabId,
    frameId: message.selection.frameId,
    frameUrl: message.selection.frameUrl,
  });
  setSelectModeEnabled(false);
  recordSelectedElement(message.selection.info);
};
export function toggleFollowDevtoolsSelection() {
  const nextEnabled = !isFollowingDevtoolsSelection();
  logger.debug("toggle follow devtools selection", { enabled: nextEnabled });
  setFollowDevtoolsSelection(nextEnabled);

  if (!nextEnabled) {
    return;
  }

  setSelectModeEnabled(false);
  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext || isRestrictedUrl(tabContext.url)) {
        logger.debug("skip enabling follow mode for inactive or restricted tab", {
          tabId: tabContext?.tabId ?? null,
          url: tabContext?.url ?? null,
        });
        return;
      }

      logger.debug("enable follow mode for active tab", {
        tabId: tabContext.tabId,
        url: tabContext.url ?? null,
      });
      try {
        await runContentSelectionToggle(tabContext.tabId, false);
      } catch (error) {
        logIgnoredError("Unable to disable content selection while following DevTools selection.", error, {
          tabId: tabContext.tabId,
        });
      }

      const devtoolsOpen = await requestDevtoolsStatus(tabContext.tabId);
      setDevtoolsIntegrationDetected(devtoolsOpen);
      logger.debug("devtools open state after enabling follow mode", {
        tabId: tabContext.tabId,
        open: devtoolsOpen,
      });
      if (!devtoolsOpen) {
        return;
      }

      try {
        await syncSelectionFromDevtools(tabContext.tabId);
      } catch (error) {
        logIgnoredError("Unable to sync followed DevTools selection.", error, { tabId: tabContext.tabId });
      }
    })
    .catch((error) => {
      logIgnoredError("Unable to enable DevTools follow mode.", error);
    });
}

const updateSelectionFromDevtoolsMessage = (message: DevtoolsSelectionChangedRuntimeMessage) => {
  try {
    applyDevtoolsSelectionChangedMessage(message);
  } catch (error) {
    logIgnoredError("Unable to handle DevTools selection change message.", error, { tabId: message.tabId });
  }
};

const updateDevtoolsStatusForActiveTab = (message: DevtoolsSelectionStatusChangedRuntimeMessage) => {
  logger.debug("apply devtools status changed message", { tabId: message.tabId, open: message.open });
  setDevtoolsIntegrationDetected(message.open);
  if (!message.open || !isFollowingDevtoolsSelection()) {
    return;
  }

  void syncSelectionFromDevtools(message.tabId).catch((error) => {
    logIgnoredError("Unable to sync selection after DevTools status update.", error, { tabId: message.tabId });
  });
};

export const attachSelectionListener = () => {
  const listener = (message: unknown) => {
    const messageType = isRecord(message) && typeof message.type === "string" ? message.type : "unknown";
    logger.debug("runtime message received", { type: messageType });

    if (isDevtoolsStatusChangedMessage(message)) {
      updateDevtoolsStatusForActiveTab(message);
      return;
    }

    if (isDevtoolsSelectionChangedMessage(message)) {
      updateSelectionFromDevtoolsMessage(message);
      return;
    }

    if (!isSelectToolMessage(message)) {
      return;
    }

    if (message.type === "select:mode") {
      setSelectModeEnabled(message.enabled);
      return;
    }

    if (message.type === "select:hover") {
      return;
    }

    if (message.type === "select:selected") {
      setSelection(message.payload ?? null, {
        source: "content",
        tabId: null,
        frameId: 0,
        frameUrl: null,
      });
      if (message.payload && !shouldSuppressSelectedElementRecord()) {
        recordSelectedElement(message.payload);
      }
      setToolMessage(null, "error");
    }
  };

  const activatedListener: Parameters<typeof browser.tabs.onActivated.addListener>[0] = () => {
    refreshDevtoolsIntegrationForActiveTab();
  };

  const updatedListener: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (_tabId, changeInfo, tab) => {
    if (!tab.active) {
      return;
    }

    if (typeof changeInfo.status === "string" || typeof changeInfo.url === "string") {
      refreshDevtoolsIntegrationForActiveTab();
    }
  };

  refreshDevtoolsIntegrationForActiveTab();
  browser.runtime.onMessage.addListener(listener);
  browser.tabs.onActivated.addListener(activatedListener);
  browser.tabs.onUpdated.addListener(updatedListener);

  return () => {
    browser.runtime.onMessage.removeListener(listener);
    browser.tabs.onActivated.removeListener(activatedListener);
    browser.tabs.onUpdated.removeListener(updatedListener);
  };
};
