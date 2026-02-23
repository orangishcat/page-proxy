import { browser } from "wxt/browser";
import { get } from "svelte/store";

import type { SelectToolMessage, SelectorOpenResult, SelectorPopupMode } from "@/lib/selection";
import type {
  DevtoolsSelectionChangedRuntimeMessage,
  DevtoolsSelectionStatusChangedRuntimeMessage,
  DevtoolsSelectionResponseMessage,
} from "@/lib/devtools-selection";
import { setErrorMessage } from "../tool-errors";
import {
  followDevtoolsSelection,
  getSelectionContext,
  selectedInfo,
  setDevtoolsIntegrationDetected,
  setFollowDevtoolsSelection,
  setSelection,
  setSelectModeEnabled,
} from "./state";
import {
  isRestrictedUrl,
  readActiveTabContext,
  runContentSelectionToggle,
  sendSelectToolMessage,
} from "./content-messaging";
import {
  isDevtoolsSelectionChangedMessage,
  isDevtoolsStatusChangedMessage,
  requestDevtoolsSelection,
  requestDevtoolsStatus,
} from "./devtools";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasType = <T extends string>(value: unknown, type: T): value is { type: T } =>
  isRecord(value) && value.type === type;

const isSelectorOpenResult = (value: unknown): value is SelectorOpenResult =>
  isRecord(value) && typeof value.opened === "boolean";

const isSelectToolMessage = (value: unknown): value is SelectToolMessage =>
  hasType(value, "select:mode") ||
  hasType(value, "select:hover") ||
  hasType(value, "select:selected") ||
  hasType(value, "select:toggle") ||
  hasType(value, "select:parent") ||
  hasType(value, "selector:open");

const applyDevtoolsSelection = (tabId: number, response: DevtoolsSelectionResponseMessage) => {
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
  setErrorMessage(null);
  return true;
};

const isFollowingDevtoolsSelection = () => get(followDevtoolsSelection);

const syncSelectionFromDevtools = async (tabId: number) => {
  const response = await requestDevtoolsSelection(tabId, "devtools:selection:get");
  if (!response || !response.ok) {
    return false;
  }

  if (!response.selection) {
    setSelection(null);
    setSelectModeEnabled(false);
    setErrorMessage(null);
    return true;
  }

  return applyDevtoolsSelection(tabId, response);
};

const trySelectWithDevtools = async (tabId: number) => {
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
      if (devtoolsOpen && isFollowingDevtoolsSelection()) {
        await syncSelectionFromDevtools(tabContext.tabId).catch(() => undefined);
      }
    })
    .catch(() => {
      setDevtoolsIntegrationDetected(false);
    });
};

export const sendSelectionToggle = (enabled: boolean) => {
  const shouldReportError = enabled;
  setErrorMessage(null);
  setSelectModeEnabled(enabled);

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setDevtoolsIntegrationDetected(false);
        setSelectModeEnabled(false);
        if (shouldReportError) {
          setErrorMessage("No active tab found.");
        }
        return;
      }

      if (shouldReportError && isRestrictedUrl(tabContext.url)) {
        setDevtoolsIntegrationDetected(false);
        setSelectModeEnabled(false);
        setErrorMessage("Selection is unavailable on this page.");
        return;
      }

      if (!enabled) {
        setSelection(null);
        await runContentSelectionToggle(tabContext.tabId, false).catch(() => undefined);
        return;
      }

      const appliedDevtoolsSelection = await trySelectWithDevtools(tabContext.tabId);
      if (appliedDevtoolsSelection) {
        await runContentSelectionToggle(tabContext.tabId, false).catch(() => undefined);
        return;
      }

      await runContentSelectionToggle(tabContext.tabId, true).catch(() => {
        setSelectModeEnabled(false);
        setErrorMessage("Unable to connect to the active tab.");
      });
    })
    .catch(() => {
      setSelectModeEnabled(false);
      if (!shouldReportError) {
        return;
      }

      setErrorMessage("Unable to connect to the active tab.");
    });
};

export const sendSelectParent = () => {
  setErrorMessage(null);

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setErrorMessage("No active tab found.");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        setErrorMessage("Selection is unavailable on this page.");
        return;
      }

      const context = getSelectionContext();
      if (context.source === "devtools") {
        const response = await requestDevtoolsSelection(tabContext.tabId, "devtools:selection:parent");
        if (!response || !applyDevtoolsSelection(tabContext.tabId, response)) {
          setErrorMessage(response?.error ?? "Unable to select parent element.");
        }
        return;
      }

      await sendSelectToolMessage(
        tabContext.tabId,
        {
          type: "select:parent",
        } satisfies SelectToolMessage,
        context.frameId ?? 0,
      ).catch(() => {
        setErrorMessage("Unable to connect to the active tab.");
      });
    })
    .catch(() => {
      setErrorMessage("Unable to connect to the active tab.");
    });
};

export const sendSelectorPopup = (mode: SelectorPopupMode = "pp-api") => {
  setErrorMessage(null);
  const selection = get(selectedInfo);
  const context = getSelectionContext();

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setErrorMessage("No active tab found.");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        setErrorMessage("Selection is unavailable on this page.");
        return;
      }

      const response: unknown = await sendSelectToolMessage(
        tabContext.tabId,
        {
          type: "selector:open",
          payload: selection,
          mode,
        } satisfies SelectToolMessage,
        context.frameId ?? 0,
      ).catch(() => null);

      if (response === null) {
        setErrorMessage("Unable to connect to the active tab.");
        return;
      }

      if (isSelectorOpenResult(response) && !response.opened) {
        setErrorMessage("Unable to open selector details for the selected element.");
      }
    })
    .catch(() => {
      setErrorMessage("Unable to connect to the active tab.");
    });
};

export const toggleFollowDevtoolsSelection = () => {
  const nextEnabled = !isFollowingDevtoolsSelection();
  setFollowDevtoolsSelection(nextEnabled);

  if (!nextEnabled) {
    return;
  }

  setSelectModeEnabled(false);
  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext || isRestrictedUrl(tabContext.url)) {
        return;
      }

      await runContentSelectionToggle(tabContext.tabId, false).catch(() => undefined);

      const devtoolsOpen = await requestDevtoolsStatus(tabContext.tabId);
      setDevtoolsIntegrationDetected(devtoolsOpen);
      if (!devtoolsOpen) {
        return;
      }

      await syncSelectionFromDevtools(tabContext.tabId).catch(() => undefined);
    })
    .catch(() => undefined);
};

const updateSelectionFromDevtoolsMessage = (message: DevtoolsSelectionChangedRuntimeMessage) => {
  void readActiveTabContext()
    .then((tabContext) => {
      if (!tabContext || tabContext.tabId !== message.tabId) {
        return;
      }
      setDevtoolsIntegrationDetected(true);

      if (!isFollowingDevtoolsSelection()) {
        return;
      }

      if (!message.selection) {
        setSelection(null);
        return;
      }

      setSelection(message.selection.info, {
        source: "devtools",
        tabId: message.tabId,
        frameId: message.selection.frameId,
        frameUrl: message.selection.frameUrl,
      });
      setSelectModeEnabled(false);
    })
    .catch(() => undefined);
};

const updateDevtoolsStatusForActiveTab = (message: DevtoolsSelectionStatusChangedRuntimeMessage) => {
  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext || tabContext.tabId !== message.tabId) {
        return;
      }

      setDevtoolsIntegrationDetected(message.open);
      if (message.open && isFollowingDevtoolsSelection()) {
        await syncSelectionFromDevtools(message.tabId).catch(() => undefined);
      }
    })
    .catch(() => undefined);
};

export const attachSelectionListener = () => {
  const listener = (message: unknown) => {
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
      setErrorMessage(null);
    }
  };

  const activatedListener: Parameters<typeof browser.tabs.onActivated.addListener>[0] = () => {
    refreshDevtoolsIntegrationForActiveTab();
  };

  const updatedListener: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (
    _tabId,
    changeInfo,
    tab,
  ) => {
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
