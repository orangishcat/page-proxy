import { browser } from "wxt/browser";
import { get } from "svelte/store";

import type { SelectToolMessage, SelectorOpenResult } from "@/lib/selection";
import type {
  DevtoolsSelectionChangedRuntimeMessage,
  DevtoolsSelectionResponseMessage,
} from "@/lib/devtools-selection";
import { setErrorMessage } from "../tool-errors";
import { getSelectionContext, selectedInfo, setSelection, setSelectModeEnabled } from "./state";
import {
  isRestrictedUrl,
  readActiveTabContext,
  runContentSelectionToggle,
  sendSelectToolMessage,
} from "./content-messaging";
import {
  isDevtoolsSelectionChangedMessage,
  requestDevtoolsSelection,
  requestDevtoolsStatus,
} from "./devtools";

const hasType = <T extends string>(value: unknown, type: T): value is { type: T } =>
  value !== null && typeof value === "object" && !Array.isArray(value) && value.type === type;

const isSelectorOpenResult = (value: unknown): value is SelectorOpenResult =>
  value !== null && typeof value === "object" && !Array.isArray(value) && typeof value.opened === "boolean";

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

const trySelectWithDevtools = async (tabId: number) => {
  const devtoolsOpen = await requestDevtoolsStatus(tabId);
  if (!devtoolsOpen) {
    return false;
  }

  const response = await requestDevtoolsSelection(tabId, "devtools:selection:get");
  if (!response) {
    return false;
  }

  return applyDevtoolsSelection(tabId, response);
};

export const sendSelectionToggle = (enabled: boolean) => {
  const shouldReportError = enabled;
  setErrorMessage(null);
  setSelectModeEnabled(enabled);

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setSelectModeEnabled(false);
        if (shouldReportError) {
          setErrorMessage("No active tab found.");
        }
        return;
      }

      if (shouldReportError && isRestrictedUrl(tabContext.url)) {
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

export const sendSelectorPopup = () => {
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

      const response = await sendSelectToolMessage(
        tabContext.tabId,
        {
          type: "selector:open",
          payload: selection,
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

const updateSelectionFromDevtoolsMessage = (message: DevtoolsSelectionChangedRuntimeMessage) => {
  void readActiveTabContext()
    .then((tabContext) => {
      if (!tabContext || tabContext.tabId !== message.tabId) {
        return;
      }

      const currentContext = getSelectionContext();
      const hasActiveSelection = get(selectedInfo) !== null;
      if (currentContext.source !== "devtools" && hasActiveSelection) {
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

export const attachSelectionListener = () => {
  const listener = (message: unknown) => {
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

  browser.runtime.onMessage.addListener(listener);

  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
};
