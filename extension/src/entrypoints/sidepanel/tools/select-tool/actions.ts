import { browser } from "wxt/browser";
import log from "@/lib/logger";
import { get } from "svelte/store";

import type {
  ElementInfo,
  SelectElementAction,
  SelectElementActionResult,
  SelectToolMessage,
  SelectorOpenResult,
  SelectorPopupMode,
} from "@/lib/selection";
import { buildSelectorTemplateCode } from "@/entrypoints/select-tool.content/popup/selector";
import { buildCssDocument } from "@/entrypoints/select-tool.content/css-editor-utils";
import type {
  DevtoolsSelectionChangedRuntimeMessage,
  DevtoolsSelectionStatusChangedRuntimeMessage,
  DevtoolsSelectionResponseMessage,
} from "@/lib/devtools-selection";
import { recordSidepanelAction } from "../record/state";
import { setToolMessage } from "../tool-errors";
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

const logger = log.getLogger("select-tool-sidepanel");
const selectedElementRecordSuppressionMs = 1000;
let suppressSelectedElementRecordUntil = 0;
let suppressNextSelectedElementRecord = false;
let internalClipboardHtml: string | null = null;

const armSelectedElementRecordSuppression = () => {
  suppressNextSelectedElementRecord = true;
  suppressSelectedElementRecordUntil = Date.now() + selectedElementRecordSuppressionMs;
};

const clearSelectedElementRecordSuppression = () => {
  suppressNextSelectedElementRecord = false;
  suppressSelectedElementRecordUntil = 0;
};

const shouldSuppressSelectedElementRecord = () => {
  const now = Date.now();
  if (now > suppressSelectedElementRecordUntil) {
    clearSelectedElementRecordSuppression();
    return false;
  }

  if (suppressNextSelectedElementRecord) {
    clearSelectedElementRecordSuppression();
    return true;
  }

  if (now <= suppressSelectedElementRecordUntil) {
    suppressSelectedElementRecordUntil = 0;
    return true;
  }

  return false;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasType = <T extends string>(value: unknown, type: T): value is { type: T } =>
  isRecord(value) && value.type === type;

const isSelectorOpenResult = (value: unknown): value is SelectorOpenResult =>
  isRecord(value) && typeof value.opened === "boolean";

const isSelectElementActionResult = (value: unknown): value is SelectElementActionResult =>
  isRecord(value) &&
  typeof value.ok === "boolean" &&
  (value.ok === true || (typeof value.error === "string" && value.error.length > 0));

const isElementInfo = (value: unknown): value is ElementInfo => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.tag === "string" &&
    (value.id === null || typeof value.id === "string") &&
    typeof value.selector === "string" &&
    isRecord(value.attributes) &&
    isRecord(value.boundingBox)
  );
};

const isSelectParentResponse = (value: unknown): value is { ok: boolean; payload?: ElementInfo; error?: string } => {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.payload !== undefined && !isElementInfo(value.payload)) {
    return false;
  }

  return value.error === undefined || typeof value.error === "string";
};

const isSelectToolMessage = (value: unknown): value is SelectToolMessage =>
  hasType(value, "select:mode") ||
  hasType(value, "select:hover") ||
  hasType(value, "select:selected") ||
  hasType(value, "selectors:hover") ||
  hasType(value, "select:toggle") ||
  hasType(value, "select:parent") ||
  hasType(value, "select:action") ||
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
  setToolMessage(null, "error");
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
    setToolMessage(null, "error");
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

const recordSelectedParentElement = (selectorHint?: string | null) => {
  const detail = selectorHint && selectorHint.trim().length > 0 ? `selector: ${selectorHint.trim()}` : "";
  recordSidepanelAction("Selected parent element", detail);
};

export const sendSelectionToggle = (enabled: boolean, options: { clearSelection?: boolean } = {}) => {
  const clearSelection = options.clearSelection ?? true;
  logger.debug("toggle selection mode requested", { enabled });
  const shouldReportError = enabled;
  setToolMessage(null, "error");
  setSelectModeEnabled(enabled);

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setDevtoolsIntegrationDetected(false);
        setSelectModeEnabled(false);
        if (shouldReportError) {
          setToolMessage("No active tab found.", "error");
        }
        return;
      }

      if (shouldReportError && isRestrictedUrl(tabContext.url)) {
        setDevtoolsIntegrationDetected(false);
        setSelectModeEnabled(false);
        setToolMessage("Selection is unavailable on this page.", "error");
        return;
      }

      if (!enabled) {
        if (clearSelection) {
          setSelection(null);
        }
        await runContentSelectionToggle(tabContext.tabId, false, { clearSelection }).catch(() => undefined);
        return;
      }

      const appliedDevtoolsSelection = await trySelectWithDevtools(tabContext.tabId);
      if (appliedDevtoolsSelection) {
        await runContentSelectionToggle(tabContext.tabId, false).catch(() => undefined);
        return;
      }

      await runContentSelectionToggle(tabContext.tabId, true).catch(() => {
        setSelectModeEnabled(false);
        setToolMessage("Unable to connect to the active tab.", "error");
      });
    })
    .catch(() => {
      setSelectModeEnabled(false);
      if (!shouldReportError) {
        return;
      }

      setToolMessage("Unable to connect to the active tab.", "error");
    });
};

export const sendSelectParent = () => {
  logger.debug("request select parent");
  setToolMessage(null, "error");

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setToolMessage("No active tab found.", "error");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        setToolMessage("Selection is unavailable on this page.", "error");
        return;
      }

      const context = getSelectionContext();
      if (context.source === "devtools") {
        const response = await requestDevtoolsSelection(tabContext.tabId, "devtools:selection:parent");
        if (!response || !applyDevtoolsSelection(tabContext.tabId, response)) {
          setToolMessage(response?.error ?? "Unable to select parent element.", "error");
          return;
        }
        recordSelectedParentElement();
        return;
      }

      armSelectedElementRecordSuppression();
      const response = await sendSelectToolMessage(
        tabContext.tabId,
        {
          type: "select:parent",
        } satisfies SelectToolMessage,
        context.frameId ?? 0,
      ).catch(() => null);
      if (response === null) {
        clearSelectedElementRecordSuppression();
        setToolMessage("Unable to connect to the active tab.", "error");
        return;
      }

      let selectorHint: string | null = null;
      if (isSelectParentResponse(response)) {
        if (!response.ok) {
          clearSelectedElementRecordSuppression();
          setToolMessage(response.error ?? "Unable to select parent element.", "error");
          return;
        }
        selectorHint = response.payload?.selector ?? null;
      }

      if (!selectorHint) {
        const currentSelection = get(selectedInfo);
        selectorHint = currentSelection?.selector ?? null;
      }

      recordSelectedParentElement(selectorHint);
    })
    .catch(() => {
      clearSelectedElementRecordSuppression();
      setToolMessage("Unable to connect to the active tab.", "error");
    });
};

export const sendSelectorPopup = (
  mode: SelectorPopupMode = "pp-api",
  initialCssContent?: string,
  initialCode?: string,
) => {
  logger.debug("request selector popup open", { mode });
  setToolMessage(null, "error");
  const selection = get(selectedInfo);
  const context = getSelectionContext();

  const selectorValue = selection?.selector ?? "body";
  const resolvedInitialCode =
    initialCode !== undefined
      ? initialCode
      : mode === "pp-api"
        ? buildSelectorTemplateCode(selectorValue)
        : initialCssContent !== undefined
          ? initialCssContent
          : buildCssDocument(selectorValue, "");

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setToolMessage("No active tab found.", "error");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        setToolMessage("Selection is unavailable on this page.", "error");
        return;
      }

      const response: unknown = await sendSelectToolMessage(
        tabContext.tabId,
        {
          type: "selector:open",
          payload: selection,
          mode,
          initialCssContent,
          initialCode: resolvedInitialCode,
        } satisfies SelectToolMessage,
        context.frameId ?? 0,
      ).catch(() => null);

      if (response === null) {
        setToolMessage("Unable to connect to the active tab.", "error");
        return;
      }

      if (isSelectorOpenResult(response) && !response.opened) {
        setToolMessage("Unable to open selector details for the selected element.", "error");
      }
    })
    .catch(() => {
      setToolMessage("Unable to connect to the active tab.", "error");
    });
};

export const sendApplyStylePopup = () => {
  logger.debug("request apply style popup");
  setToolMessage(null, "error");
  const selection = get(selectedInfo);
  const context = getSelectionContext();
  const selectorValue = selection?.selector ?? "body";
  const initialCssContent = buildCssDocument(selectorValue, "");

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setToolMessage("No active tab found.", "error");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        setToolMessage("Selection is unavailable on this page.", "error");
        return;
      }

      const response: unknown = await sendSelectToolMessage(
        tabContext.tabId,
        {
          type: "selector:open",
          payload: selection,
          mode: "css",
          initialCssContent,
          applyStyle: true,
        } satisfies SelectToolMessage,
        context.frameId ?? 0,
      ).catch(() => null);

      if (response === null) {
        setToolMessage("Unable to connect to the active tab.", "error");
        return;
      }

      if (isSelectorOpenResult(response) && !response.opened) {
        setToolMessage("Unable to open style editor for the selected element.", "error");
      }
    })
    .catch(() => {
      setToolMessage("Unable to connect to the active tab.", "error");
    });
};

const sendSelectionAction = (action: SelectElementAction) => {
  logger.debug("request selected element action", { action });
  setToolMessage(null, "error");

  const selection = get(selectedInfo);
  if (!selection) {
    setToolMessage("Select an element first.", "error");
    return;
  }

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setToolMessage("No active tab found.", "error");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        setToolMessage("Selection is unavailable on this page.", "error");
        return;
      }

      const context = getSelectionContext();

      let clipboardText: string | undefined;
      if (action === "paste") {
        if (!internalClipboardHtml) {
          setToolMessage("Nothing to paste. Copy or cut an element first.", "error");
          return;
        }
        clipboardText = internalClipboardHtml;
      }

      const response: unknown = await sendSelectToolMessage(
        tabContext.tabId,
        {
          type: "select:action",
          action,
          clipboardText,
        } satisfies SelectToolMessage,
        context.frameId ?? 0,
      ).catch(() => null);

      if (response === null) {
        setToolMessage("Unable to connect to the active tab.", "error");
        return;
      }

      if (!isSelectElementActionResult(response)) {
        setToolMessage("Unable to update the selected element.", "error");
        return;
      }

      if (!response.ok) {
        setToolMessage(response.error, "error");
        return;
      }

      if (response.html !== undefined) {
        internalClipboardHtml = response.html;
      }

      if (action === "copy") {
        recordSidepanelAction("Copied element");
        return;
      }

      if (action === "cut") {
        const selectorDetail = get(selectedInfo)?.selector?.trim() ?? "";
        recordSidepanelAction("Cut element", selectorDetail ? `selector: ${selectorDetail}` : "");
        return;
      }

      if (action === "click") {
        recordSidepanelAction("Clicked element");
        return;
      }

      if (action === "paste") {
        recordSidepanelAction("Pasted element");
        return;
      }

      if (action === "delete") {
        recordSidepanelAction("Deleted element");
      }
    })
    .catch(() => {
      setToolMessage("Unable to connect to the active tab.", "error");
    });
};

export const sendCopySelection = () => {
  sendSelectionAction("copy");
};

export const sendClickSelection = () => {
  sendSelectionAction("click");
};

export const sendCutSelection = () => {
  sendSelectionAction("cut");
};

export const sendPasteSelection = () => {
  sendSelectionAction("paste");
};

export const sendDeleteSelection = () => {
  sendSelectionAction("delete");
};

export const toggleFollowDevtoolsSelection = () => {
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
      if (message.payload) {
        if (!shouldSuppressSelectedElementRecord()) {
          const selectorDetail = message.payload.selector.trim();
          recordSidepanelAction("Selected element", selectorDetail.length > 0 ? `selector: ${selectorDetail}` : "");
        }
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
