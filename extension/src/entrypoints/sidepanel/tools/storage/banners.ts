import { appState } from "@/lib/app-state/state.svelte.ts";
import { appStateActions } from "@/lib/app-state/actions.ts";

export const readHelpBannerDismissedSetting = (): Promise<boolean> => Promise.resolve(appState.sidepanel.helpBannerDismissed);

export const saveHelpBannerDismissedSetting = (dismissed: boolean): Promise<void> => {
  if (dismissed) {
    appStateActions.dismissBanner("helpBannerDismissed");
    return Promise.resolve();
  }

  appStateActions.resetBanner("helpBannerDismissed");
  return Promise.resolve();
};

export const readUserscriptReloadBannerDismissedSetting = (): Promise<boolean> =>
  Promise.resolve(appState.sidepanel.userscriptReloadBannerDismissed);

export const saveUserscriptReloadBannerDismissedSetting = (dismissed: boolean): Promise<void> => {
  if (dismissed) {
    appStateActions.dismissBanner("userscriptReloadBannerDismissed");
    return Promise.resolve();
  }

  appStateActions.resetBanner("userscriptReloadBannerDismissed");
  return Promise.resolve();
};
