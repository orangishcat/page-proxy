import { createSidepanelBannerManager, type BannerDefinition } from "../../banners/banner-manager";

const helpBannerDismissedStorageKey = "sidepanel:helpBannerDismissed";
const userscriptReloadBannerDismissedStorageKey = "sidepanel:userscriptReloadBannerDismissed";
const sidepanelBannerManager = createSidepanelBannerManager();
const helpBanner: BannerDefinition = {
  id: "helpBannerDismissed",
  storageKey: helpBannerDismissedStorageKey,
};
const userscriptReloadBanner: BannerDefinition = {
  id: "userscriptReloadBannerDismissed",
  storageKey: userscriptReloadBannerDismissedStorageKey,
};

export const readHelpBannerDismissedSetting = async () => {
  return sidepanelBannerManager.isDismissed(helpBanner);
};

export const saveHelpBannerDismissedSetting = async (dismissed: boolean) => {
  if (dismissed) {
    await sidepanelBannerManager.dismiss(helpBanner);
    return;
  }

  await sidepanelBannerManager.reset(helpBanner);
};

export const readUserscriptReloadBannerDismissedSetting = async () => {
  return sidepanelBannerManager.isDismissed(userscriptReloadBanner);
};

export const saveUserscriptReloadBannerDismissedSetting = async (dismissed: boolean) => {
  if (dismissed) {
    await sidepanelBannerManager.dismiss(userscriptReloadBanner);
    return;
  }

  await sidepanelBannerManager.reset(userscriptReloadBanner);
};
