import {defineBackground} from 'wxt/utils/define-background';

import {browser} from 'wxt/browser';
import {matchWebsiteGlob} from '@/lib/utils/website-glob';
import {isRestrictedUrl} from '@/lib/utils/url-utils';
import {
  isScriptRunResponse,
  type ScriptRunRequest
} from '@/lib/script-runner';

type ToolId = 'select' | 'new-element' | 'selectors' | 'help' | 'share' | 'none';

type StoredToolState = {
  activeTool: ToolId;
  codeEditor: {
    content: string;
  };
  websiteGlob: string;
  updatedAt: number;
};

const storageKeyPrefix = 'pageproxy:';
const badgeBackgroundColor = '#f59e0b';

const isToolId = (value: unknown): value is ToolId =>
  value === 'select' ||
  value === 'new-element' ||
  value === 'selectors' ||
  value === 'help' ||
  value === 'share' ||
  value === 'none';

const fromStorageKey = (key: string) => {
  if (!key.startsWith(storageKeyPrefix)) {
    return null;
  }

  const websiteGlob = key.slice(storageKeyPrefix.length).trim();
  return websiteGlob.length > 0 ? websiteGlob : null;
};

const coerceStoredToolState = (
  value: unknown,
  websiteGlob: string
): StoredToolState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const data = value as {
    activeTool?: unknown;
    codeEditor?: unknown;
    websiteGlob?: unknown;
    updatedAt?: unknown;
  };

  if (!isToolId(data.activeTool)) {
    return null;
  }

  const codeEditor = data.codeEditor as {content?: unknown} | undefined;
  if (typeof codeEditor?.content !== 'string') {
    return null;
  }

  return {
    activeTool: data.activeTool,
    codeEditor: {
      content: codeEditor.content
    },
    websiteGlob:
      typeof data.websiteGlob === 'string' && data.websiteGlob.trim().length > 0
        ? data.websiteGlob
        : websiteGlob,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
  };
};

const listStoredToolStates = async () => {
  const allValues = await browser.storage.local.get(null);
  const states: Array<{websiteGlob: string; state: StoredToolState}> = [];

  Object.entries(allValues).forEach(([key, value]) => {
    const websiteGlob = fromStorageKey(key);
    if (!websiteGlob) {
      return;
    }

    const state = coerceStoredToolState(value, websiteGlob);
    if (!state) {
      return;
    }

    states.push({websiteGlob, state});
  });

  return states;
};

const findStoredToolStatesForUrl = async (url: string) => {
  const states = await listStoredToolStates();
  return states
    .filter((entry) => matchWebsiteGlob(entry.websiteGlob, url))
    .sort((left, right) => right.websiteGlob.length - left.websiteGlob.length);
};

const buildRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildRunRequest = (code: string): ScriptRunRequest => ({
  type: 'script:run',
  requestId: buildRequestId(),
  code
});

const runScriptInTab = async (tabId: number, code: string) => {
  const response = await browser.tabs.sendMessage(tabId, buildRunRequest(code));
  if (!isScriptRunResponse(response)) {
    return false;
  }
  return response.error === null;
};

const setTabBadge = async (tabId: number, count: number) => {
  if (count <= 0) {
    await browser.action.setBadgeText({tabId, text: ''});
    return;
  }

  await browser.action.setBadgeBackgroundColor({tabId, color: badgeBackgroundColor});
  await browser.action.setBadgeText({tabId, text: count > 99 ? '99+' : String(count)});
};

const runMatchingScriptsForTab = async (tabId: number, url?: string) => {
  if (isRestrictedUrl(url)) {
    return 0;
  }

  const tabUrl = url ?? '';
  const matchedStates = await findStoredToolStatesForUrl(tabUrl);
  const scripts = matchedStates
    .map((entry) => entry.state.codeEditor.content.trim())
    .filter((code) => code.length > 0);
  if (scripts.length === 0) {
    return 0;
  }

  const runResults = await Promise.all(
    scripts.map((code) =>
      runScriptInTab(tabId, code).catch(() => false)
    )
  );
  return runResults.filter(Boolean).length;
};

export default defineBackground(() => {
  const sidePanel = browser.sidePanel;
  if (sidePanel?.setPanelBehavior) {
    void sidePanel.setPanelBehavior({openPanelOnActionClick: true});
  }

  const sidebarAction = (
    browser as typeof browser & {
      sidebarAction?: {
        open: () => Promise<void>;
      };
    }
  ).sidebarAction;

  if (sidebarAction?.open) {
    browser.action.onClicked.addListener(() => {
      void sidebarAction.open();
    });
  }

  const lastAutoRunUrlByTabId = new Map<number, string>();
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
      lastAutoRunUrlByTabId.delete(tabId);
      void setTabBadge(tabId, 0);
      return;
    }

    if (changeInfo.status !== 'complete') {
      return;
    }

    if (!tab?.url) {
      return;
    }

    const lastUrl = lastAutoRunUrlByTabId.get(tabId);
    if (lastUrl === tab.url) {
      return;
    }

    lastAutoRunUrlByTabId.set(tabId, tab.url);
    void runMatchingScriptsForTab(tabId, tab.url)
      .then((count) => setTabBadge(tabId, count))
      .catch(() => {
        lastAutoRunUrlByTabId.delete(tabId);
        return setTabBadge(tabId, 0);
      });
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    lastAutoRunUrlByTabId.delete(tabId);
  });
});
