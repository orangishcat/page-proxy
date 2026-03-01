import type { SelectElementAction, SelectElementActionResult } from "@/lib/selection";
import { readClipboardText, writeClipboardText } from "./clipboard";

export const runSelectElementAction = async (
  action: SelectElementAction,
  selectedTarget: Element | null,
  clearSelectedAndNotify: () => void,
): Promise<SelectElementActionResult> => {
  const target = selectedTarget;
  if (!target?.isConnected) return { ok: false, error: "Select an element first." };

  if (action === "copy") {
    const copied = await writeClipboardText(target.outerHTML);
    if (!copied) return { ok: false, error: "Copy is unavailable on this page." };
    return { ok: true };
  }

  if (action === "click") {
    (target as HTMLElement).click();
    return { ok: true };
  }

  if (action === "cut") {
    const copied = await writeClipboardText(target.outerHTML);
    if (!copied) return { ok: false, error: "Cut is unavailable on this page." };
    target.remove();
    clearSelectedAndNotify();
    return { ok: true };
  }

  if (action === "paste") {
    const pasted = (await readClipboardText())?.trim();
    if (!pasted) return { ok: false, error: "Clipboard is empty or unavailable." };
    if (!target.parentElement) return { ok: false, error: "Selected element has no parent element." };
    target.insertAdjacentHTML("afterend", pasted);
    return { ok: true };
  }

  if (action === "delete") {
    target.remove();
    clearSelectedAndNotify();
    return { ok: true };
  }

  return { ok: false, error: "Unsupported action." };
};
