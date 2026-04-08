import type { ElementInfo } from "@/lib/selection";
import { recordSidepanelAction } from "../record/state";

const selectedElementRecordSuppressionMs = 1000;

let suppressSelectedElementRecordUntil = 0;
let suppressNextSelectedElementRecord = false;

export const armSelectedElementRecordSuppression = () => {
  suppressNextSelectedElementRecord = true;
  suppressSelectedElementRecordUntil = Date.now() + selectedElementRecordSuppressionMs;
};

export const clearSelectedElementRecordSuppression = () => {
  suppressNextSelectedElementRecord = false;
  suppressSelectedElementRecordUntil = 0;
};

export const shouldSuppressSelectedElementRecord = () => {
  const now = Date.now();
  if (now > suppressSelectedElementRecordUntil) {
    clearSelectedElementRecordSuppression();
    return false;
  }

  if (suppressNextSelectedElementRecord) {
    clearSelectedElementRecordSuppression();
    return true;
  }

  if (now <= suppressSelectedElementRecordUntil) {
    suppressSelectedElementRecordUntil = 0;
    return true;
  }

  return false;
};

export const recordSelectedParentElement = (selectorHint?: string | null) => {
  const detail = selectorHint && selectorHint.trim().length > 0 ? `selector: ${selectorHint.trim()}` : "";
  recordSidepanelAction("Selected parent element", detail);
};

export const recordSelectedElement = (info: ElementInfo) => {
  const selectorDetail = info.selector.trim();
  recordSidepanelAction("Selected element", selectorDetail.length > 0 ? `selector: ${selectorDetail}` : "");
};
