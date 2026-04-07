import { getElementInfo } from "../element-info";
import type {
  RoutedSelectToolHandler,
  RoutedSelectToolMessageContent,
} from "./types";

export const handleSelectRestoreMessage: RoutedSelectToolHandler<"select:restore"> = (
  content: RoutedSelectToolMessageContent<"select:restore">,
  { ctrl, sendResponse },
) => {
  const target = document.querySelector(content.selector);
  if (!(target instanceof Element) || !target.isConnected) {
    sendResponse({ ok: false, error: "Unable to restore the previous selected element." });
    return false;
  }

  ctrl.hover.clearHoverAndNotify();
  ctrl.applySelection(target);
  ctrl.setSelectionEnabled(false, { clearSelection: false });
  sendResponse({ ok: true, payload: getElementInfo(target) });
  return false;
};
