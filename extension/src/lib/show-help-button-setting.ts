import { browser } from "wxt/browser";
import { isAppStateHydrated } from "./app-state/storage/hydrate/hydration";

const loadAppState: () => Promise<typeof import("./app-state.ts")> = () => import("./app-state.ts");

export const showHelpButtonStorageKey = "pageproxy:show-help-button";

export const coerceShowHelpButtonSetting = (value: unknown) => value !== false;

export const readShowHelpButtonSetting = async (): Promise<boolean> => {
  if (!isAppStateHydrated) {
    const stored = await browser.storage.local.get(showHelpButtonStorageKey);
    return coerceShowHelpButtonSetting(stored[showHelpButtonStorageKey]);
  }

  const { appStateSelectors } = await loadAppState();
  return appStateSelectors.getShowHelpButton();
};

export const saveShowHelpButtonSetting = async (value: boolean): Promise<void> => {
  if (!isAppStateHydrated) {
    await browser.storage.local.set({
      [showHelpButtonStorageKey]: value,
    });
    return;
  }

  const { appStateActions } = await loadAppState();
  appStateActions.setShowHelpButton(value);
};
