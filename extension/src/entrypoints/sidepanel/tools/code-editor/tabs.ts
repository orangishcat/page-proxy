import { browser } from "wxt/browser";

export type ActiveTab = {
  id?: number;
  url?: string;
  pendingUrl?: string;
  lastAccessed?: number;
};

export const getTabUrl = (tab: ActiveTab | null) => {
  if (!tab) {
    return null;
  }

  if (typeof tab.url === "string" && tab.url.trim()) {
    return tab.url;
  }

  if (typeof tab.pendingUrl === "string" && tab.pendingUrl.trim()) {
    return tab.pendingUrl;
  }

  return null;
};

const pickBestActiveTab = (tabs: ActiveTab[]) => {
  if (tabs.length === 0) {
    return null;
  }

  const tabsWithId = tabs.filter((tab) => tab.id !== undefined);
  if (tabsWithId.length === 0) {
    return null;
  }

  const tabsWithUrl = tabsWithId.filter((tab) => getTabUrl(tab) !== null);
  if (tabsWithUrl.length > 0) {
    return tabsWithUrl.sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))[0];
  }

  return tabsWithId.sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))[0];
};

export const resolveActiveTab = async () => {
  const lastFocusedWindowTabs = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
    windowType: "normal",
  });
  const lastFocusedWindowTab = pickBestActiveTab(lastFocusedWindowTabs);
  if (lastFocusedWindowTab) {
    return lastFocusedWindowTab;
  }

  const currentWindowTabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
    windowType: "normal",
  });
  const currentWindowTab = pickBestActiveTab(currentWindowTabs);
  if (currentWindowTab) {
    return currentWindowTab;
  }

  const activeTabs = await browser.tabs.query({ active: true, windowType: "normal" });
  return pickBestActiveTab(activeTabs);
};

export const shouldHandleTabUpdate = (
  activeTabId: number | null,
  tabId: number,
  changeInfo: { url?: string; status?: string },
) => {
  if (activeTabId !== tabId) {
    return false;
  }

  const hasUrlUpdate = typeof changeInfo.url === "string" && changeInfo.url.length > 0;
  const completedLoad = changeInfo.status === "complete";
  return hasUrlUpdate || completedLoad;
};
