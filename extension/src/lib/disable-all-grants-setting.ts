import { browser } from "wxt/browser";

export const disableAllGrantsStorageKey = "pageproxy:disable-all-grants";

export const coerceDisableAllGrantsSetting = (value: unknown) => value === true;

export const readDisableAllGrantsSetting = async () => {
  const stored = await browser.storage.local.get(disableAllGrantsStorageKey);
  return coerceDisableAllGrantsSetting(stored[disableAllGrantsStorageKey]);
};

export const saveDisableAllGrantsSetting = async (value: boolean) =>
  browser.storage.local.set({
    [disableAllGrantsStorageKey]: value,
  });
