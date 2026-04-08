import { browser } from "wxt/browser";
import log from "@/lib/logger";
import { get } from "svelte/store";

import type {
  DevtoolsSelectionChangedRuntimeMessage,
  DevtoolsSelectionStatusChangedRuntimeMessage,
  DevtoolsSelectionResponseMessage,
} from "@/lib/devtools-selection";
import type { ElementInfo } from "@/lib/selection";
import { isRecord } from "@/lib/utils/type-guards";
import { setToolMessage } from "../tool-errors";
import {
  followDevtoolsSelection,
  setDevtoolsIntegrationDetected,
  setFollowDevtoolsSelection,
  setSelection,
  setSelectModeEnabled,
} from "./state";
import {
  isRestrictedUrl,
  type ActiveTabContext,
  readActiveTabContext,
  runContentSelectionToggle,
} from "./content-messaging";
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
    return false;
  }

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
  const response = await requestDevtoolsSelection(tabId, "devtools:selection:get");
  if (!response || !response.ok) {
    return false;
  }

  if (!response.selection) {
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

export type ApplyDevtoolsSelectionChangedMessageDeps = {
  readActiveTabContext: () => Promise<ActiveTabContext | null>;
  setDevtoolsIntegrationDetected: (detected: boolean) => void;
  isFollowingDevtoolsSelection: () => boolean;
  setSelection: (info: ElementInfo | null, context?: Parameters<typeof setSelection>[1]) => void;
  setSelectModeEnabled: (enabled: boolean) => void;
  recordSelectedElement: (info: ElementInfo) => void;
};

const defaultApplyDevtoolsSelectionChangedMessageDeps: ApplyDevtoolsSelectionChangedMessageDeps = {
  readActiveTabContext,
  setDevtoolsIntegrationDetected,
  isFollowingDevtoolsSelection,
  setSelection,
  setSelectModeEnabled,
  recordSelectedElement,
};

export const applyDevtoolsSelectionChangedMessage = async (
  message: DevtoolsSelectionChangedRuntimeMessage,
  deps: ApplyDevtoolsSelectionChangedMessageDeps = defaultApplyDevtoolsSelectionChangedMessageDeps,
) => {
  const tabContext = await deps.readActiveTabContext();
  if (!tabContext || tabContext.tabId !== message.tabId) {
    return;
  }

  deps.setDevtoolsIntegrationDetected(true);

  if (!deps.isFollowingDevtoolsSelection()) {
    return;
  }

  if (!message.selection) {
    deps.setSelection(null);
    return;
  }

  deps.setSelection(message.selection.info, {
    source: "devtools",
    tabId: message.tabId,
    frameId: message.selection.frameId,
    frameUrl: message.selection.frameUrl,
  });
  deps.setSelectModeEnabled(false);
  deps.recordSelectedElement(message.selection.info);
};

export type ToggleFollowDevtoolsSelectionDeps = {
  isFollowingDevtoolsSelection: () => boolean;
  setFollowDevtoolsSelection: (enabled: boolean) => void;
  setSelectModeEnabled: (enabled: boolean) => void;
  readActiveTabContext: () => Promise<ActiveTabContext | null>;
  isRestrictedUrl: (url: string | undefined) => boolean;
  runContentSelectionToggle: (
    tabId: number,
    enabled: boolean,
    options?: Parameters<typeof runContentSelectionToggle>[2],
  ) => Promise<void>;
  requestDevtoolsStatus: (tabId: number) => Promise<boolean>;
  setDevtoolsIntegrationDetected: (detected: boolean) => void;
  syncSelectionFromDevtools: (tabId: number) => Promise<boolean>;
  logIgnoredError: (message: string, error: unknown, extra?: Record<string, unknown>) => void;
};

const defaultToggleFollowDevtoolsSelectionDeps: ToggleFollowDevtoolsSelectionDeps = {
  isFollowingDevtoolsSelection,
  setFollowDevtoolsSelection,
  setSelectModeEnabled,
  readActiveTabContext,
  isRestrictedUrl,
  runContentSelectionToggle,
  requestDevtoolsStatus,
  setDevtoolsIntegrationDetected,
  syncSelectionFromDevtools,
  logIgnoredError,
};

export function toggleFollowDevtoolsSelection(): void;
export function toggleFollowDevtoolsSelection(deps: ToggleFollowDevtoolsSelectionDeps): void;
export function toggleFollowDevtoolsSelection(deps = defaultToggleFollowDevtoolsSelectionDeps) {
  const nextEnabled = !deps.isFollowingDevtoolsSelection();
  logger.debug("toggle follow devtools selection", { enabled: nextEnabled });
  deps.setFollowDevtoolsSelection(nextEnabled);

  if (!nextEnabled) {
    return;
  }

  deps.setSelectModeEnabled(false);
  void deps
    .readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext || deps.isRestrictedUrl(tabContext.url)) {
        return;
      }

      try {
        await deps.runContentSelectionToggle(tabContext.tabId, false);
      } catch (error) {
        deps.logIgnoredError("Unable to disable content selection while following DevTools selection.", error, {
          tabId: tabContext.tabId,
        });
      }

      const devtoolsOpen = await deps.requestDevtoolsStatus(tabContext.tabId);
      deps.setDevtoolsIntegrationDetected(devtoolsOpen);
      if (!devtoolsOpen) {
        return;
      }

      try {
        await deps.syncSelectionFromDevtools(tabContext.tabId);
      } catch (error) {
        deps.logIgnoredError("Unable to sync followed DevTools selection.", error, { tabId: tabContext.tabId });
      }
    })
    .catch((error) => {
      deps.logIgnoredError("Unable to enable DevTools follow mode.", error);
    });
}

const updateSelectionFromDevtoolsMessage = (message: DevtoolsSelectionChangedRuntimeMessage) => {
  void applyDevtoolsSelectionChangedMessage(message).catch((error) => {
    logIgnoredError("Unable to handle DevTools selection change message.", error, { tabId: message.tabId });
  });
};

const updateDevtoolsStatusForActiveTab = (message: DevtoolsSelectionStatusChangedRuntimeMessage) => {
  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext || tabContext.tabId !== message.tabId) {
        return;
      }

      setDevtoolsIntegrationDetected(message.open);
      if (!message.open || !isFollowingDevtoolsSelection()) {
        return;
      }

      try {
        await syncSelectionFromDevtools(message.tabId);
      } catch (error) {
        logIgnoredError("Unable to sync selection after DevTools status update.", error, { tabId: message.tabId });
      }
    })
    .catch((error) => {
      logIgnoredError("Unable to handle DevTools status update.", error, { tabId: message.tabId });
    });
};

type SelectionListenerBrowser = {
  runtime: {
    onMessage: Pick<typeof browser.runtime.onMessage, "addListener" | "removeListener">;
  };
  tabs: {
    onActivated: Pick<typeof browser.tabs.onActivated, "addListener" | "removeListener">;
    onUpdated: Pick<typeof browser.tabs.onUpdated, "addListener" | "removeListener">;
  };
};

export type AttachSelectionListenerDeps = {
  browser: SelectionListenerBrowser;
  refreshDevtoolsIntegrationForActiveTab: () => void;
  updateDevtoolsStatusForActiveTab: (message: DevtoolsSelectionStatusChangedRuntimeMessage) => void;
  updateSelectionFromDevtoolsMessage: (message: DevtoolsSelectionChangedRuntimeMessage) => void;
  isSelectToolMessage: typeof isSelectToolMessage;
  setSelectModeEnabled: (enabled: boolean) => void;
  setSelection: (info: ElementInfo | null, context?: Parameters<typeof setSelection>[1]) => void;
  shouldSuppressSelectedElementRecord: () => boolean;
  recordSelectedElement: (info: ElementInfo) => void;
  setToolMessage: (message: string | null, status: "success" | "error") => void;
};

const defaultAttachSelectionListenerDeps: AttachSelectionListenerDeps = {
  browser,
  refreshDevtoolsIntegrationForActiveTab,
  updateDevtoolsStatusForActiveTab,
  updateSelectionFromDevtoolsMessage,
  isSelectToolMessage,
  setSelectModeEnabled,
  setSelection,
  shouldSuppressSelectedElementRecord,
  recordSelectedElement,
  setToolMessage,
};

export const attachSelectionListener = (deps: AttachSelectionListenerDeps = defaultAttachSelectionListenerDeps) => {
  const listener = (message: unknown) => {
    const messageType = isRecord(message) && typeof message.type === "string" ? message.type : "unknown";
    logger.debug("runtime message received", { type: messageType });

    if (isDevtoolsStatusChangedMessage(message)) {
      deps.updateDevtoolsStatusForActiveTab(message);
      return;
    }

    if (isDevtoolsSelectionChangedMessage(message)) {
      deps.updateSelectionFromDevtoolsMessage(message);
      return;
    }

    if (!deps.isSelectToolMessage(message)) {
      return;
    }

    if (message.type === "select:mode") {
      deps.setSelectModeEnabled(message.enabled);
      return;
    }

    if (message.type === "select:hover") {
      return;
    }

    if (message.type === "select:selected") {
      deps.setSelection(message.payload ?? null, {
        source: "content",
        tabId: null,
        frameId: 0,
        frameUrl: null,
      });
      if (message.payload && !deps.shouldSuppressSelectedElementRecord()) {
        deps.recordSelectedElement(message.payload);
      }
      deps.setToolMessage(null, "error");
    }
  };

  const activatedListener: Parameters<typeof browser.tabs.onActivated.addListener>[0] = () => {
    deps.refreshDevtoolsIntegrationForActiveTab();
  };

  const updatedListener: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (_tabId, changeInfo, tab) => {
    if (!tab.active) {
      return;
    }

    if (typeof changeInfo.status === "string" || typeof changeInfo.url === "string") {
      deps.refreshDevtoolsIntegrationForActiveTab();
    }
  };

  deps.refreshDevtoolsIntegrationForActiveTab();
  deps.browser.runtime.onMessage.addListener(listener);
  deps.browser.tabs.onActivated.addListener(activatedListener);
  deps.browser.tabs.onUpdated.addListener(updatedListener);

  return () => {
    deps.browser.runtime.onMessage.removeListener(listener);
    deps.browser.tabs.onActivated.removeListener(activatedListener);
    deps.browser.tabs.onUpdated.removeListener(updatedListener);
  };
};
