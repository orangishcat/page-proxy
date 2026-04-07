import type { SelectToolMessage } from "@/lib/selection";
import type { SelectionController } from "../SelectionController";

export type RoutedSelectToolMessageType =
  | "selector:open"
  | "record:converter:open"
  | "select:parent"
  | "select:restore"
  | "select:clear"
  | "select:action"
  | "select:toggle"
  | "selectors:hover";

export type RoutedSelectToolMessageMap = {
  [TType in RoutedSelectToolMessageType]: Extract<SelectToolMessage, { type: TType }>;
};

export type RoutedSelectToolMessage<TType extends RoutedSelectToolMessageType> = RoutedSelectToolMessageMap[TType];

export type RoutedSelectToolMessageContent<TType extends RoutedSelectToolMessageType> = Omit<
  RoutedSelectToolMessageMap[TType],
  "type"
>;

export type RoutedSelectToolMessageSendResponse = (response: unknown) => void;

export type RoutedSelectToolHandlerDeps = {
  ctrl: SelectionController;
  sendResponse: RoutedSelectToolMessageSendResponse;
};

export type RoutedSelectToolHandler<TType extends RoutedSelectToolMessageType> = (
  content: RoutedSelectToolMessageContent<TType>,
  deps: RoutedSelectToolHandlerDeps,
) => boolean;
