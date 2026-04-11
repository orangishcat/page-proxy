import type { SelectElementAction, SelectElementActionResult } from "@/lib/selection";

export const runSelectElementAction = (
  action: SelectElementAction,
  selectedTarget: Element | null,
  clearSelectedAndNotify: () => void,
  pasteHtml?: string,
): SelectElementActionResult => {
  const target = selectedTarget;
  if (!target?.isConnected) return { ok: false, error: "Select an element first." };

  if (action === "copy") {
    return { ok: true, html: target.outerHTML };
  }

  if (action === "click") {
    (target as HTMLElement).click();
    return { ok: true };
  }

  if (action === "cut") {
    const html = target.outerHTML;
    target.remove();
    clearSelectedAndNotify();
    return { ok: true, html };
  }

  if (action === "paste") {
    const pasted = pasteHtml?.trim();
    if (!pasted) return { ok: false, error: "Nothing to paste." };
    if (!target.parentElement) return { ok: false, error: "Selected element has no parent element." };
    target.insertAdjacentHTML("afterend", pasted);
    return { ok: true };
  }

  if (action === "hide") {
    (target as HTMLElement).style.display = "none";
    return { ok: true };
  }

  if (action === "delete") {
    target.remove();
    clearSelectedAndNotify();
    return { ok: true };
  }

  return { ok: false, error: "Unsupported action." };
};
