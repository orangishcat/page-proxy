import type { SidepanelShortcutId } from "@/lib/sidepanel-shortcuts";

export const getShortcutTool = (event: KeyboardEvent): SidepanelShortcutId | null => {
  if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }

  switch (event.code) {
    case "Digit1": return "select";
    case "Digit2": return "create";
    case "Digit3": return "selectors";
    case "Digit4": return "record";
    case "Digit5": return "help";
    case "Digit6": return "share";
    default: return null;
  }
};
