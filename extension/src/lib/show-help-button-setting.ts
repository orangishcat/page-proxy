import { browser } from "wxt/browser";

export const showHelpButtonStorageKey = "pageproxy:show-help-button";

export const coerceShowHelpButtonSetting = (value: unknown) => value !== false;

export const readShowHelpButtonSetting = async () => {
  const stored = await browser.storage.local.get(showHelpButtonStorageKey);
  return coerceShowHelpButtonSetting(stored[showHelpButtonStorageKey]);
};

export const saveShowHelpButtonSetting = async (value: boolean) =>
  browser.storage.local.set({
    [showHelpButtonStorageKey]: value,
  });
