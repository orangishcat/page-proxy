import log from "@/lib/logger";
import { getElementInfo } from "../element-info";
import type {
  RoutedSelectToolHandler,
  RoutedSelectToolMessageContent,
} from "./types";

const logger = log.getLogger("message-router");

export const handleSelectParentMessage: RoutedSelectToolHandler<"select:parent"> = (
  _content: RoutedSelectToolMessageContent<"select:parent">,
  { ctrl, sendResponse },
) => {
  if (!ctrl.selectedTarget) {
    sendResponse({ ok: false, error: "Select an element first." });
    return false;
  }

  const parent = ctrl.selectedTarget.parentElement;
  if (!parent) {
    logger.debug("select parent skipped", { reason: "no-parent" });
    sendResponse({ ok: false, error: "Selected element has no parent." });
    return false;
  }

  ctrl.hover.clearHoverAndNotify();
  ctrl.applySelection(parent);
  sendResponse({ ok: true, payload: getElementInfo(parent) });
  return false;
};
