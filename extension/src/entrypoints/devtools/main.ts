import { browser } from "wxt/browser";
import log from "@/lib/logger";

import {
  devtoolsSelectionPortName,
  type DevtoolsElementSelection,
  type DevtoolsPortConnectedMessage,
  type DevtoolsSelectionCommandMessage,
  type DevtoolsSelectionCommandResultMessage,
  type DevtoolsSelectionUpdateMessage,
} from "@/lib/devtools-selection";
import { isRecord } from "@/lib/utils/type-guards";
import evalSource from "./eval-selection.js?raw";
import { buildSelectionEvalSource } from "./eval-source";

type EvalSelectionResult = {
  ok: boolean;
  selection: DevtoolsElementSelection | null;
  error?: string;
};

const logger = log.getLogger("devtools-bridge");

const inspectedTabId = chrome.devtools.inspectedWindow.tabId;
const selectionPort = browser.runtime.connect({
  name: devtoolsSelectionPortName,
});

const getMessageType = (message: unknown) => {
  if (!isRecord(message)) {
    return "unknown";
  }

  return typeof message.type === "string" ? message.type : "unknown";
};

const isEvalSelectionResult = (value: unknown): value is EvalSelectionResult =>
  isRecord(value) &&
  typeof value.ok === "boolean" &&
  "selection" in value &&
  (value.selection === null || isRecord(value.selection));

const isCommandMessage = (message: unknown): message is DevtoolsSelectionCommandMessage =>
  isRecord(message) &&
  message.type === "devtools:command" &&
  typeof message.requestId === "string" &&
  (message.action === "get-selected" || message.action === "select-parent");

const isExceptionInfo = (
  value: unknown,
): value is {
  isError?: boolean;
  isException?: boolean;
  code?: unknown;
  description?: unknown;
  value?: unknown;
} => isRecord(value);

const evaluateSelection = (selectParent: boolean) =>
  new Promise<EvalSelectionResult>((resolve) => {
    chrome.devtools.inspectedWindow.eval(
      buildSelectionEvalSource(evalSource, selectParent),
      (result: unknown, exceptionInfo: unknown) => {
        if (isExceptionInfo(exceptionInfo) && (exceptionInfo.isError || exceptionInfo.isException)) {
          const valueText =
            typeof exceptionInfo.description === "string"
              ? exceptionInfo.description
              : typeof exceptionInfo.value === "string"
                ? exceptionInfo.value
                : typeof exceptionInfo.code === "string"
                  ? exceptionInfo.code
                  : "Unable to evaluate $0.";
          resolve({
            ok: false,
            selection: null,
            error: valueText,
          });
          return;
        }

        if (!isEvalSelectionResult(result)) {
          resolve({
            ok: false,
            selection: null,
            error: "Unexpected DevTools evaluation result.",
          });
          return;
        }

        resolve(result);
      },
    );
  });

const postSelectionUpdate = (selection: DevtoolsElementSelection | null) => {
  const message: DevtoolsSelectionUpdateMessage = {
    type: "devtools:selection:update",
    tabId: inspectedTabId,
    selection,
  };

  selectionPort.postMessage(message);
};

const postConnectedMessage = () => {
  const message: DevtoolsPortConnectedMessage = {
    type: "devtools:connect",
    tabId: inspectedTabId,
  };

  selectionPort.postMessage(message);
};

const publishCurrentSelection = () => {
  void evaluateSelection(false).then((result) => {
    logger.debug("evaluated current DevTools selection", {
      tabId: inspectedTabId,
      ok: result.ok,
      hasSelection: Boolean(result.selection),
      error: result.error ?? null,
    });

    if (!result.ok) {
      logger.debug("Unable to publish current DevTools selection.", { error: result.error });
      return;
    }

    // DevTools can fire onSelectionChanged before $0 is readable for the new node.
    // A transient empty read should not clear the sidepanel's current selection.
    if (!result.selection) {
      logger.debug("skip publishing empty current DevTools selection", { tabId: inspectedTabId });
      return;
    }

    postSelectionUpdate(result.selection);
  });
};

selectionPort.onMessage.addListener((message: unknown) => {
  const messageType = getMessageType(message);

  if (!isCommandMessage(message)) {
    return;
  }

  const selectParent = message.action === "select-parent";
  void evaluateSelection(selectParent).then((result) => {
    const response: DevtoolsSelectionCommandResultMessage = {
      type: "devtools:command:result",
      requestId: message.requestId,
      ok: result.ok,
      selection: result.selection,
      error: result.error,
    };
    selectionPort.postMessage(response);

    if (result.ok) {
      postSelectionUpdate(result.selection);
    }
  });
});

chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
  publishCurrentSelection();
});

selectionPort.onDisconnect.addListener(() => {
  logger.debug("DevTools bridge disconnected.");
});

postConnectedMessage();
publishCurrentSelection();
