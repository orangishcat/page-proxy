import type { SidepanelShortcutId } from "@/lib/sidepanel-shortcuts";

export const getShortcutTool = (event: KeyboardEvent): SidepanelShortcutId | null => {
  if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }

  switch (event.code) {
    case "Digit1": return "select";
    case "Digit2": return "selectors";
    case "Digit3": return "record";
    case "Digit4": return "settings";
    case "Digit5": return "share";
    default: return null;
  }
};
