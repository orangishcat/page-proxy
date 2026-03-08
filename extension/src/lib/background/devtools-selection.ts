import { browser } from "wxt/browser";
import log from "@/lib/logger";
import {
  devtoolsSelectionPortName,
  type DevtoolsCommandAction,
  type DevtoolsElementSelection,
  type DevtoolsSelectionChangedRuntimeMessage,
  type DevtoolsSelectionCommandMessage,
  type DevtoolsSelectionCommandResultMessage,
  type DevtoolsSelectionRuntimeMessage,
  type DevtoolsSelectionStatusResponseMessage,
  type DevtoolsSelectionResponseMessage,
  type DevtoolsSelectionStatusChangedRuntimeMessage,
} from "@/lib/devtools-selection";
import {
  isCommandResultMessage,
  isSelectionGetRequestMessage,
  isSelectionParentRequestMessage,
  isSelectionUpdateMessage,
  isStatusRequestMessage,
} from "@/lib/background/devtools-selection-guards";
type RuntimeMessageHandler = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean;
type PendingCommand = {
  resolve: (result: DevtoolsSelectionResponseMessage) => void;
  timeoutId: ReturnType<typeof globalThis.setTimeout>;
};
const commandTimeoutMs = 1200;
const logger = log.getLogger("devtools-selection");

const buildRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getMessageType = (message: unknown) => {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return "unknown";
  }

  const messageRecord = message as Record<string, unknown>;
  return typeof messageRecord.type === "string" ? messageRecord.type : "unknown";
};

const cloneSelection = (selection: DevtoolsElementSelection | null): DevtoolsElementSelection | null => {
  if (!selection) {
    return null;
  }

  return {
    info: selection.info,
    frameId: selection.frameId,
    frameUrl: selection.frameUrl,
    updatedAt: selection.updatedAt,
  };
};

const resolveFrameIdForSelection = (tabId: number, selection: DevtoolsElementSelection | null) => {
  if (!selection || selection.frameId !== null || !selection.frameUrl) {
    return Promise.resolve(selection);
  }

  return browser.webNavigation
    .getAllFrames({ tabId })
    .then((frames) => {
      const matchingFrame = (frames ?? []).find((frame) => frame.url === selection.frameUrl);
      if (!matchingFrame) {
        return selection;
      }

      return {
        ...selection,
        frameId: matchingFrame.frameId,
      };
    })
    .catch(() => selection);
};

const notifySelectionChanged = (tabId: number, selection: DevtoolsElementSelection | null) => {
  const message: DevtoolsSelectionChangedRuntimeMessage = {
    type: "devtools:selection:changed",
    tabId,
    selection: cloneSelection(selection),
  };
  logger.debug("runtime message sent", { type: message.type, tabId });
  void browser.runtime.sendMessage(message satisfies DevtoolsSelectionRuntimeMessage).catch(() => undefined);
};

const notifyStatusChanged = (tabId: number, open: boolean) => {
  const message: DevtoolsSelectionStatusChangedRuntimeMessage = {
    type: "devtools:status:changed",
    tabId,
    open,
  };
  logger.debug("runtime message sent", { type: message.type, tabId, open });
  void browser.runtime.sendMessage(message satisfies DevtoolsSelectionRuntimeMessage).catch(() => undefined);
};

export const createDevtoolsSelectionRuntimeHandler = () => {
  const portsByTabId = new Map<number, Set<chrome.runtime.Port>>();
  const portTabIdByPort = new Map<chrome.runtime.Port, number>();
  const latestSelectionByTabId = new Map<number, DevtoolsElementSelection | null>();
  const pendingCommands = new Map<string, PendingCommand>();

  const untrackPort = (port: chrome.runtime.Port) => {
    const tabId = portTabIdByPort.get(port);
    if (tabId === undefined) {
      return;
    }

    portTabIdByPort.delete(port);
    const ports = portsByTabId.get(tabId);
    if (!ports) {
      return;
    }

    ports.delete(port);
    if (ports.size > 0) {
      return;
    }

    portsByTabId.delete(tabId);
    latestSelectionByTabId.delete(tabId);
    notifyStatusChanged(tabId, false);
  };

  const trackPort = (port: chrome.runtime.Port, tabId: number) => {
    const previousTabId = portTabIdByPort.get(port);
    if (previousTabId !== undefined && previousTabId !== tabId) {
      const previousPorts = portsByTabId.get(previousTabId);
      previousPorts?.delete(port);
      if (previousPorts && previousPorts.size === 0) {
        portsByTabId.delete(previousTabId);
        latestSelectionByTabId.delete(previousTabId);
        notifyStatusChanged(previousTabId, false);
      }
    }

    portTabIdByPort.set(port, tabId);
    const existingPorts = portsByTabId.get(tabId);
    const hadPorts = Boolean(existingPorts && existingPorts.size > 0);
    const ports = existingPorts ?? new Set<chrome.runtime.Port>();
    ports.add(port);
    portsByTabId.set(tabId, ports);
    if (!hadPorts) {
      notifyStatusChanged(tabId, true);
    }
  };

  const getAnyPortForTab = (tabId: number) => {
    const ports = portsByTabId.get(tabId);
    if (!ports || ports.size === 0) {
      return null;
    }

    return Array.from(ports)[0] ?? null;
  };

  const updateSelectionCache = (tabId: number, selection: DevtoolsElementSelection | null) => {
    latestSelectionByTabId.set(tabId, cloneSelection(selection));
    notifySelectionChanged(tabId, selection);
  };

  const sendCommandToTab = (
    tabId: number,
    action: DevtoolsCommandAction,
  ): Promise<DevtoolsSelectionResponseMessage> => {
    const port = getAnyPortForTab(tabId);
    if (!port) {
      return Promise.resolve({
        ok: false,
        selection: null,
        error: "DevTools is not open for this tab.",
      });
    }

    const requestId = buildRequestId();
    const message: DevtoolsSelectionCommandMessage = {
      type: "devtools:command",
      requestId,
      action,
    };

    return new Promise<DevtoolsSelectionResponseMessage>((resolve) => {
      const timeoutId = globalThis.setTimeout(() => {
        pendingCommands.delete(requestId);
        resolve({
          ok: false,
          selection: null,
          error: "Timed out waiting for DevTools selection response.",
        });
      }, commandTimeoutMs);

      pendingCommands.set(requestId, { resolve, timeoutId });
      try {
        logger.debug("port message sent", { type: message.type, tabId, action, requestId });
        port.postMessage(message);
      } catch {
        pendingCommands.delete(requestId);
        globalThis.clearTimeout(timeoutId);
        resolve({
          ok: false,
          selection: null,
          error: "Unable to send command to DevTools bridge.",
        });
      }
    }).then((response: DevtoolsSelectionResponseMessage) =>
      resolveFrameIdForSelection(tabId, response.selection).then((selection) => ({
        ...response,
        selection,
      })),
    );
  };

  const handleCommandResponse = (message: DevtoolsSelectionCommandResultMessage, tabId: number | null) => {
    const pending = pendingCommands.get(message.requestId);
    if (!pending) {
      return;
    }

    pendingCommands.delete(message.requestId);
    globalThis.clearTimeout(pending.timeoutId);

    const selection = cloneSelection(message.selection);
    if (tabId !== null) {
      updateSelectionCache(tabId, selection);
    }

    pending.resolve({
      ok: message.ok,
      selection,
      error: message.error,
    });
  };

  const onConnect = (port: chrome.runtime.Port) => {
    if (port.name !== devtoolsSelectionPortName) {
      return;
    }

    logger.debug("DevTools port connected");

    port.onMessage.addListener((message: unknown) => {
      const messageType = getMessageType(message);
      logger.debug("port message received", { type: messageType });
      const tabIdFromPort = portTabIdByPort.get(port);

      if (isSelectionUpdateMessage(message)) {
        trackPort(port, message.tabId);
        updateSelectionCache(message.tabId, message.selection);
        return;
      }

      if (isCommandResultMessage(message)) {
        handleCommandResponse(message, tabIdFromPort ?? null);
      }
    });

    port.onDisconnect.addListener(() => {
      logger.debug("DevTools port disconnected");
      untrackPort(port);
    });
  };
  browser.runtime.onConnect.addListener(onConnect);

  const handleRuntimeMessage: RuntimeMessageHandler = (message, _sender, sendResponse) => {
    if (isStatusRequestMessage(message)) {
      logger.debug("runtime message received", { message });
      const response: DevtoolsSelectionStatusResponseMessage = {
        open: getAnyPortForTab(message.tabId) !== null,
      };
      sendResponse(response);
      return false;
    }

    if (isSelectionGetRequestMessage(message)) {
      logger.debug("runtime message received", { message });
      void sendCommandToTab(message.tabId, "get-selected")
        .then((response) => {
          if (response.selection) {
            updateSelectionCache(message.tabId, response.selection);
          }
          sendResponse(response);
        })
        .catch((error: unknown) => {
          const messageText = error instanceof Error ? error.message : "Unable to retrieve selected element.";
          sendResponse({
            ok: false,
            selection: null,
            error: messageText,
          } satisfies DevtoolsSelectionResponseMessage);
        });
      return true;
    }

    if (isSelectionParentRequestMessage(message)) {
      logger.debug("runtime message received", { message });
      void sendCommandToTab(message.tabId, "select-parent")
        .then((response) => {
          if (response.selection) {
            updateSelectionCache(message.tabId, response.selection);
          }
          sendResponse(response);
        })
        .catch((error: unknown) => {
          const messageText = error instanceof Error ? error.message : "Unable to select parent element.";
          sendResponse({
            ok: false,
            selection: null,
            error: messageText,
          } satisfies DevtoolsSelectionResponseMessage);
        });
      return true;
    }

    return false;
  };

  return {
    handleRuntimeMessage,
  };
};
