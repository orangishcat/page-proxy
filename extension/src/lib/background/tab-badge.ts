import { browser } from "wxt/browser";

import { isRestrictedUrl } from "@/lib/utils/url-utils";

const badgeBackgroundColor = "#f59e0b";

type CountMatchingScriptsForUrl = (url: string) => Promise<number>;

export type TabBadgeUpdater = {
  hasAutoRunUrl: (tabId: number, url: string) => boolean;
  markAutoRunStarted: (tabId: number, url: string) => void;
  applyAutoRunResult: (tabId: number, url: string, count: number) => Promise<void>;
  applyAutoRunFailure: (tabId: number) => Promise<void>;
  handleTabLoading: (tabId: number) => Promise<void>;
  refreshBadgeForActivatedTab: (tabId: number) => Promise<void>;
  refreshBadgeForWindowFocus: (windowId: number) => Promise<void>;
  handleTabRemoved: (tabId: number) => void;
};

export const createTabBadgeUpdater = (countMatchingScriptsForUrl: CountMatchingScriptsForUrl): TabBadgeUpdater => {
  const lastAutoRunUrlByTabId = new Map<number, string>();
  const runCountByTabId = new Map<number, number>();

  const setTabBadge = async (tabId: number, count: number) => {
    if (count <= 0) {
      await browser.action.setBadgeText({ tabId, text: "" });
      return;
    }

    await browser.action.setBadgeBackgroundColor({ tabId, color: badgeBackgroundColor });
    await browser.action.setBadgeText({ tabId, text: count > 99 ? "99+" : String(count) });
  };

  const resolveBadgeCountForTab = async (tabId: number, url?: string) => {
    if (!url || isRestrictedUrl(url)) {
      return 0;
    }

    const lastUrl = lastAutoRunUrlByTabId.get(tabId);
    if (lastUrl === url) {
      return runCountByTabId.get(tabId) ?? 0;
    }

    return countMatchingScriptsForUrl(url);
  };

  const refreshBadgeForTab = async (tabId: number, url?: string) => {
    const count = await resolveBadgeCountForTab(tabId, url);
    await setTabBadge(tabId, count);
  };

  const clearTabTracking = (tabId: number) => {
    lastAutoRunUrlByTabId.delete(tabId);
    runCountByTabId.delete(tabId);
  };

  return {
    hasAutoRunUrl: (tabId, url) => lastAutoRunUrlByTabId.get(tabId) === url,

    markAutoRunStarted: (tabId, url) => {
      lastAutoRunUrlByTabId.set(tabId, url);
    },

    applyAutoRunResult: async (tabId, url, count) => {
      lastAutoRunUrlByTabId.set(tabId, url);
      runCountByTabId.set(tabId, count);
      await setTabBadge(tabId, count);
    },

    applyAutoRunFailure: async (tabId) => {
      clearTabTracking(tabId);
      await setTabBadge(tabId, 0);
    },

    handleTabLoading: async (tabId) => {
      clearTabTracking(tabId);
      await setTabBadge(tabId, 0);
    },

    refreshBadgeForActivatedTab: async (tabId) => {
      const tab = await browser.tabs.get(tabId);
      await refreshBadgeForTab(tabId, tab.url);
    },

    refreshBadgeForWindowFocus: async (windowId) => {
      if (windowId === browser.windows.WINDOW_ID_NONE) {
        return;
      }

      const tabs = await browser.tabs.query({ active: true, windowId });
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        return;
      }

      await refreshBadgeForTab(activeTab.id, activeTab.url);
    },

    handleTabRemoved: (tabId) => {
      clearTabTracking(tabId);
    },
  };
};
