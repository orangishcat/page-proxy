import type {
  RoutedSelectToolHandler,
  RoutedSelectToolMessageContent,
} from "./types";

export const handleSelectorsHover: RoutedSelectToolHandler<"selectors:hover"> = (
  content: RoutedSelectToolMessageContent<"selectors:hover">,
  { ctrl },
) => {
  ctrl.applyHoveredSelectorElements(content.payload);
  return false;
};
