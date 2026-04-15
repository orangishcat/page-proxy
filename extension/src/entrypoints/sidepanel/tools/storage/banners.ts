import log from "../../../../lib/logger";
import { appState } from "@/lib/app-state/state.svelte.ts";
import { appStateActions } from "@/lib/app-state/actions.ts";

const logger = log.getLogger("sidepanel-banners");

export const readHelpBannerDismissedSetting = (): Promise<boolean> => Promise.resolve(appState.sidepanel.helpBannerDismissed);

export const saveHelpBannerDismissedSetting = (dismissed: boolean): Promise<void> => {
  if (dismissed) {
    appStateActions.dismissBanner("helpBannerDismissed");
    logger.debug("save help banner dismissed", { dismissed });
    return Promise.resolve();
  }

  appStateActions.resetBanner("helpBannerDismissed");
  logger.debug("save help banner dismissed", { dismissed });
  return Promise.resolve();
};

export const readUserscriptReloadBannerDismissedSetting = (): Promise<boolean> =>
  Promise.resolve(appState.sidepanel.userscriptReloadBannerDismissed);

export const saveUserscriptReloadBannerDismissedSetting = (dismissed: boolean): Promise<void> => {
  if (dismissed) {
    appStateActions.dismissBanner("userscriptReloadBannerDismissed");
    logger.debug("save userscript reload banner dismissed", { dismissed });
    return Promise.resolve();
  }

  appStateActions.resetBanner("userscriptReloadBannerDismissed");
  logger.debug("save userscript reload banner dismissed", { dismissed });
  return Promise.resolve();
};
