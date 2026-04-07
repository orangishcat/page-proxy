import type { SelectorOpenResult } from "@/lib/selection";
import type { RoutedSelectToolHandler } from "./types";

export const handleSelectorOpen: RoutedSelectToolHandler<"selector:open"> = (content, { ctrl, sendResponse }) => {
  ctrl.recordManager.clear();
  void ctrl.selectorManager
    .open(content.payload, content.mode ?? "pp-api", content.initialCssContent, content.initialCode, {
      applyStyle: content.applyStyle,
    })
    .then((opened) => sendResponse({ opened } satisfies SelectorOpenResult))
    .catch(() => sendResponse({ opened: false } satisfies SelectorOpenResult));
  return true;
};
