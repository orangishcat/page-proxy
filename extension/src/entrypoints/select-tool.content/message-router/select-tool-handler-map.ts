import type { RoutedSelectToolHandler, RoutedSelectToolMessageType } from "./types";
import { handleRecordConverterOpen } from "./record-converter-open";
import { handleSelectAction } from "./select-action";
import { handleSelectClearMessage } from "./select-clear";
import { handleSelectParentMessage } from "./select-parent";
import { handleSelectRestoreMessage } from "./select-restore";
import { handleSelectToggle } from "./select-toggle";
import { handleSelectorOpen } from "./selector-open";
import { handleSelectorsHover } from "./selectors-hover";

type RoutedSelectToolHandlerMap = {
  [TType in RoutedSelectToolMessageType]: RoutedSelectToolHandler<TType>;
};

export const selectToolHandlerMap: RoutedSelectToolHandlerMap = {
  "selector:open": handleSelectorOpen,
  "record:converter:open": handleRecordConverterOpen,
  "select:parent": handleSelectParentMessage,
  "select:restore": handleSelectRestoreMessage,
  "select:clear": handleSelectClearMessage,
  "select:action": handleSelectAction,
  "select:toggle": handleSelectToggle,
  "selectors:hover": handleSelectorsHover,
};
