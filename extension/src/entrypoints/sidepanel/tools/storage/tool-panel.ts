import { browser } from "wxt/browser";

const toolPanelHeightStorageKey = "sidepanel:toolPanelHeightPx";

const coerceToolPanelHeight = (value: unknown) => {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return null;
  }

  return value;
};

export const readToolPanelHeightSetting = async () => {
  return browser.storage.local
    .get(toolPanelHeightStorageKey)
    .then((stored) => coerceToolPanelHeight(stored[toolPanelHeightStorageKey]))
    .catch(() => null);
};

export const saveToolPanelHeightSetting = async (height: number) => {
  const normalizedHeight = coerceToolPanelHeight(height);
  if (normalizedHeight === null) {
    return;
  }

  await browser.storage.local
    .set({
      [toolPanelHeightStorageKey]: normalizedHeight,
    })
    .catch(() => undefined);
};
