import { browser } from "wxt/browser";
import log from "loglevel";
import { get } from "svelte/store";

import type {
  SelectCopyResult,
  SelectDeleteResult,
  SelectPasteLocation,
  SelectPasteResult,
  SelectToolMessage,
  SelectorOpenResult,
  SelectorPopupMode,
} from "@/lib/selection";
import type {
  DevtoolsSelectionChangedRuntimeMessage,
  DevtoolsSelectionStatusChangedRuntimeMessage,
  DevtoolsSelectionResponseMessage,
} from "@/lib/devtools-selection";
import { recordSidepanelAction } from "../record/state";
import { setErrorMessage, setSuccessMessage } from "../tool-errors";
import {
  copiedElementCopyId,
  copiedElementCut,
  setCopiedElementState,
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

const logger = log.getLogger("select-tool-sidepanel");
logger.setLevel("debug", false);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasType = <T extends string>(value: unknown, type: T): value is { type: T } =>
  isRecord(value) && value.type === type;

const isSelectorOpenResult = (value: unknown): value is SelectorOpenResult =>
  isRecord(value) && typeof value.opened === "boolean";

const isSelectCopyResult = (value: unknown): value is SelectCopyResult => {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok) {
    return typeof value.copyId === "string" && typeof value.cut === "boolean";
  }

  return typeof value.error === "string";
};

const isSelectPasteResult = (value: unknown): value is SelectPasteResult => {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok) {
    return typeof value.copyId === "string" && typeof value.cut === "boolean";
  }

  return typeof value.error === "string";
};

const isSelectDeleteResult = (value: unknown): value is SelectDeleteResult => {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok) {
    return true;
  }

  return typeof value.error === "string";
};

const isSelectToolMessage = (value: unknown): value is SelectToolMessage =>
  hasType(value, "select:mode") ||
  hasType(value, "select:hover") ||
  hasType(value, "select:selected") ||
  hasType(value, "selectors:hover") ||
  hasType(value, "select:toggle") ||
  hasType(value, "select:parent") ||
  hasType(value, "select:copy") ||
  hasType(value, "select:paste") ||
  hasType(value, "select:delete") ||
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
  logger.debug("toggle selection mode requested", { enabled });
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
  logger.debug("request select parent");
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
          return;
        }
        recordSidepanelAction("Selected parent element");
        return;
      }

      const response = await sendSelectToolMessage(
        tabContext.tabId,
        {
          type: "select:parent",
        } satisfies SelectToolMessage,
        context.frameId ?? 0,
      ).catch(() => null);
      if (response === null) {
        setErrorMessage("Unable to connect to the active tab.");
        return;
      }
      recordSidepanelAction("Selected parent element");
    })
    .catch(() => {
      setErrorMessage("Unable to connect to the active tab.");
    });
};

export const sendSelectorPopup = (mode: SelectorPopupMode = "pp-api") => {
  logger.debug("request selector popup open", { mode });
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
        return;
      }

      recordSidepanelAction(
        mode === "css" ? "Opened CSS inspector" : "Opened selector popup",
        mode === "css" ? "Mode: css" : "Mode: pp-api",
      );
    })
    .catch(() => {
      setErrorMessage("Unable to connect to the active tab.");
    });
};

export const sendCopySelection = (cut: boolean) => {
  logger.debug("request copy selection", { cut });
  setErrorMessage(null);
  setSuccessMessage(null);
  const selection = get(selectedInfo);
  const context = getSelectionContext();

  if (!selection) {
    setErrorMessage("Select an element before copying.");
    return;
  }

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
          type: "select:copy",
          payload: selection,
          cut,
        } satisfies SelectToolMessage,
        context.frameId ?? 0,
      ).catch(() => null);

      if (response === null) {
        setErrorMessage("Unable to connect to the active tab.");
        return;
      }

      if (!isSelectCopyResult(response)) {
        setErrorMessage("Unable to copy selected element.");
        return;
      }

      if (!response.ok) {
        setErrorMessage(response.error || "Unable to copy selected element.");
        return;
      }

      setCopiedElementState(response.copyId, response.cut);
      setSuccessMessage(`${response.cut ? "Cut" : "Copied"} element. Select another element to paste.`);
      recordSidepanelAction(response.cut ? "Cut selected element" : "Copied selected element");
    })
    .catch(() => {
      setErrorMessage("Unable to connect to the active tab.");
    });
};

export const sendPasteSelection = (pasteLocation: SelectPasteLocation, childPosition: number) => {
  logger.debug("request paste selection", { pasteLocation, childPosition });
  setErrorMessage(null);
  setSuccessMessage(null);
  const copyId = get(copiedElementCopyId);
  const cut = get(copiedElementCut);
  const selection = get(selectedInfo);
  const context = getSelectionContext();

  if (!copyId) {
    setErrorMessage("Copy or cut an element before pasting.");
    return;
  }

  if (!selection) {
    setErrorMessage("Select a target element before pasting.");
    return;
  }

  const normalizedChildPosition = Number.isFinite(childPosition)
    ? Math.max(1, Math.floor(childPosition))
    : 1;

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
          type: "select:paste",
          payload: selection,
          copyId,
          cut,
          childPosition: normalizedChildPosition,
          pasteLocation,
        } satisfies SelectToolMessage,
        context.frameId ?? 0,
      ).catch(() => null);

      if (response === null) {
        setErrorMessage("Unable to connect to the active tab.");
        return;
      }

      if (!isSelectPasteResult(response)) {
        setErrorMessage("Unable to paste copied element.");
        return;
      }

      if (!response.ok) {
        setErrorMessage(response.error || "Unable to paste copied element.");
        return;
      }

      setCopiedElementState(response.copyId, response.cut);
      setSuccessMessage(`Pasted ${response.cut ? "cut" : "copied"} element.`);
      recordSidepanelAction(
        response.cut ? "Moved selected element" : "Pasted copied element",
        pasteLocation === "child" ? `Location: child #${normalizedChildPosition}` : `Location: ${pasteLocation}`,
      );
    })
    .catch(() => {
      setErrorMessage("Unable to connect to the active tab.");
    });
};

export const sendDeleteSelection = () => {
  logger.debug("request delete selection");
  setErrorMessage(null);
  setSuccessMessage(null);
  const selection = get(selectedInfo);
  const context = getSelectionContext();

  if (!selection) {
    setErrorMessage("Select an element before deleting.");
    return;
  }

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
          type: "select:delete",
          payload: selection,
        } satisfies SelectToolMessage,
        context.frameId ?? 0,
      ).catch(() => null);

      if (response === null) {
        setErrorMessage("Unable to connect to the active tab.");
        return;
      }

      if (!isSelectDeleteResult(response)) {
        setErrorMessage("Unable to delete selected element.");
        return;
      }

      if (!response.ok) {
        setErrorMessage(response.error || "Unable to delete selected element.");
        return;
      }

      setSelection(null);
      setSuccessMessage("Deleted selected element.");
      recordSidepanelAction("Deleted selected element");
    })
    .catch(() => {
      setErrorMessage("Unable to connect to the active tab.");
    });
};

export const toggleFollowDevtoolsSelection = () => {
  const nextEnabled = !isFollowingDevtoolsSelection();
  logger.debug("toggle follow devtools selection", { enabled: nextEnabled });
  setFollowDevtoolsSelection(nextEnabled);
  recordSidepanelAction(nextEnabled ? "Enabled DevTools follow mode" : "Disabled DevTools follow mode");

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
