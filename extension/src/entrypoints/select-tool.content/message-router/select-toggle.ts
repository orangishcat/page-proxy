import type {
  RoutedSelectToolHandler,
  RoutedSelectToolMessageContent,
} from "./types";

export const handleSelectToggle: RoutedSelectToolHandler<"select:toggle"> = (
  content: RoutedSelectToolMessageContent<"select:toggle">,
  { ctrl },
) => {
  if (ctrl.selectorManager.hasPopup) {
    if (content.enabled) {
      ctrl.selectorManager.resumeSelectionAfterPopup = true;
      if (ctrl.selectionEnabled) {
        ctrl.setSelectionEnabled(false);
      } else {
        ctrl.postMessage({ type: "select:mode", enabled: false });
      }
      return false;
    }
    ctrl.selectorManager.resumeSelectionAfterPopup = false;
  }

  ctrl.setSelectionEnabled(content.enabled, { clearSelection: content.clearSelection });
  return false;
};
