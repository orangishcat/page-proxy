import type {
  RoutedSelectToolHandler,
  RoutedSelectToolMessageContent,
} from "./types";

export const handleSelectClearMessage: RoutedSelectToolHandler<"select:clear"> = (
  _content: RoutedSelectToolMessageContent<"select:clear">,
  { ctrl, sendResponse },
) => {
  ctrl.hover.clearHoverAndNotify();
  ctrl.clearSelectedAndNotify();
  sendResponse({ ok: true });
  return false;
};
