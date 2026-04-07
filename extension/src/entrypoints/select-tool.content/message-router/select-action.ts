import type { SelectElementActionResult } from "@/lib/selection";
import type {
  RoutedSelectToolHandler,
  RoutedSelectToolMessageContent,
} from "./types";

export const handleSelectAction: RoutedSelectToolHandler<"select:action"> = (
  content: RoutedSelectToolMessageContent<"select:action">,
  { ctrl, sendResponse },
) => {
  void ctrl
    .runAction(content.action, content.pasteHtml)
    .then((result) => sendResponse(result))
    .catch((error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : "Unable to update the selected element.";
      sendResponse({ ok: false, error: errorMsg } satisfies SelectElementActionResult);
    });

  return true;
};
