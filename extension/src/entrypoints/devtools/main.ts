import { browser } from "wxt/browser";
import log from "@/lib/logger";

import {
  devtoolsSelectionPortName,
  type DevtoolsElementSelection,
  type DevtoolsSelectionCommandMessage,
  type DevtoolsSelectionCommandResultMessage,
  type DevtoolsSelectionUpdateMessage,
} from "@/lib/devtools-selection";
import { isRecord } from "@/lib/utils/type-guards";
import evalSource from "./eval-selection.js?raw";

type EvalSelectionResult = {
  ok: boolean;
  selection: DevtoolsElementSelection | null;
  error?: string;
};

const logger = log.getLogger("devtools-bridge");
const selectionPublishRetryDelayMs = 100;
const maxSelectionPublishAttempts = 2;

const inspectedTabId = chrome.devtools.inspectedWindow.tabId;
const selectionPort = browser.runtime.connect({
  name: devtoolsSelectionPortName,
});
let publishCurrentSelectionRetryTimeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

const selectionEvalSource = (selectParent: boolean) =>
  `(${evalSource.replace(/^export default\s+/, "")})(${JSON.stringify(selectParent)})`;

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

const isExceptionInfo = (value: unknown): value is { isException?: boolean; value?: unknown } => isRecord(value);

const evaluateSelection = (selectParent: boolean) =>
  new Promise<EvalSelectionResult>((resolve) => {
    chrome.devtools.inspectedWindow.eval(
      selectionEvalSource(selectParent),
      (result: unknown, exceptionInfo: unknown) => {
        if (isExceptionInfo(exceptionInfo) && exceptionInfo.isException) {
          const valueText = typeof exceptionInfo.value === "string" ? exceptionInfo.value : "Unable to evaluate $0.";
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

  logger.debug("port message sent", { type: message.type, tabId: inspectedTabId });
  selectionPort.postMessage(message);
};

const clearPublishCurrentSelectionRetry = () => {
  if (publishCurrentSelectionRetryTimeoutId === null) {
    return;
  }

  globalThis.clearTimeout(publishCurrentSelectionRetryTimeoutId);
  publishCurrentSelectionRetryTimeoutId = null;
};

const publishCurrentSelection = (attempt = 0) => {
  clearPublishCurrentSelectionRetry();
  void evaluateSelection(false).then((result) => {
    logger.debug("evaluated current DevTools selection", {
      tabId: inspectedTabId,
      attempt,
      ok: result.ok,
      hasSelection: Boolean(result.selection),
      error: result.error ?? null,
    });

    if (!result.ok) {
      logger.debug("Unable to publish current DevTools selection.", { error: result.error });
    } else if (result.selection) {
      postSelectionUpdate(result.selection);
      return;
    }

    if (attempt + 1 < maxSelectionPublishAttempts) {
      logger.debug("retrying current DevTools selection publish", {
        tabId: inspectedTabId,
        attempt: attempt + 1,
      });
      publishCurrentSelectionRetryTimeoutId = globalThis.setTimeout(() => {
        publishCurrentSelection(attempt + 1);
      }, selectionPublishRetryDelayMs);
      return;
    }

    logger.debug("publishing empty current DevTools selection", { tabId: inspectedTabId, attempt });
    postSelectionUpdate(null);
  });
};

selectionPort.onMessage.addListener((message: unknown) => {
  const messageType = getMessageType(message);
  logger.debug("port message received", { type: messageType });

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
    logger.debug("port message sent", {
      type: response.type,
      requestId: response.requestId,
      ok: response.ok,
    });
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
  clearPublishCurrentSelectionRetry();
});

publishCurrentSelection();
