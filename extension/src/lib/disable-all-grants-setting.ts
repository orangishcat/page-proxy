import { browser } from "wxt/browser";
import { isAppStateHydrated } from "./app-state/hydration";

const loadAppState: () => Promise<typeof import("./app-state.ts")> = () => import("./app-state.ts");

export const disableAllGrantsStorageKey = "pageproxy:disable-all-grants";

export const coerceDisableAllGrantsSetting = (value: unknown) => value === true;

export const readDisableAllGrantsSetting = async (): Promise<boolean> => {
  if (!isAppStateHydrated) {
    const stored = await browser.storage.local.get(disableAllGrantsStorageKey);
    return coerceDisableAllGrantsSetting(stored[disableAllGrantsStorageKey]);
  }

  const { appStateSelectors } = await loadAppState();
  return appStateSelectors.getDisableAllGrants();
};

export const saveDisableAllGrantsSetting = async (value: boolean): Promise<void> => {
  if (!isAppStateHydrated) {
    await browser.storage.local.set({
      [disableAllGrantsStorageKey]: value,
    });
    return;
  }

  const { appStateActions } = await loadAppState();
  appStateActions.setDisableAllGrants(value);
};
