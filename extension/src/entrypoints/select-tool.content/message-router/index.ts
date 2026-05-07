import { browser } from "wxt/browser";
import type { SelectToolMessage } from "@/lib/selection";
import { isGrantPermissionRequestMessage } from "@/lib/grant-permissions";
import { isScriptRunRequest } from "@/lib/script-runner";
import { forwardScriptRunToMainWorld } from "../runtime/script-run-bridge";
import type { SelectionController } from "../controller/SelectionController";
import { selectToolHandlerMap } from "./select-tool-handler-map";
import type { RoutedSelectToolMessageContent, RoutedSelectToolMessageMap, RoutedSelectToolMessageType } from "./types";

const routedSelectToolMessageTypes = new Set<RoutedSelectToolMessageType>([
  "selector:open",
  "record:converter:open",
  "select:parent",
  "select:restore",
  "select:clear",
  "select:action",
  "select:toggle",
  "selectors:hover",
]);

const isSelectToolMessage = (message: unknown): message is SelectToolMessage =>
  Boolean(message) && typeof message === "object" && typeof (message as { type?: unknown }).type === "string";

const isRoutedSelectToolMessageType = (type: SelectToolMessage["type"]): type is RoutedSelectToolMessageType =>
  routedSelectToolMessageTypes.has(type as RoutedSelectToolMessageType);

const dispatchRoutedSelectToolMessage = <TType extends RoutedSelectToolMessageType>(
  type: TType,
  content: RoutedSelectToolMessageContent<TType>,
  ctrl: SelectionController,
  sendResponse: (response: unknown) => void,
): boolean => {
  const handler = selectToolHandlerMap[type];
  return handler(content, { ctrl, sendResponse });
};

export const addMessageListener = (ctrl: SelectionController): (() => void) => {
  const listener = (message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    if (isScriptRunRequest(message)) {
      return forwardScriptRunToMainWorld(message, sendResponse);
    }

    if (isGrantPermissionRequestMessage(message)) {
      void ctrl.grantManager.open(message.payload);
      return false;
    }

    if (!isSelectToolMessage(message)) {
      return false;
    }

    if (!isRoutedSelectToolMessageType(message.type)) {
      return false;
    }

    const routedMessage = message as RoutedSelectToolMessageMap[RoutedSelectToolMessageType];
    const { type, ...content } = routedMessage;
    return dispatchRoutedSelectToolMessage(type, content as never, ctrl, sendResponse);
  };

  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
};
