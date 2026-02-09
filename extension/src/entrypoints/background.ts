import {defineBackground} from 'wxt/utils/define-background';

import {browser} from 'wxt/browser';
import {matchWebsiteGlob} from '@/lib/utils/website-glob';
import {isRestrictedUrl} from '@/lib/utils/url-utils';
import {type ScriptRunRequest} from '@/lib/script-runner';

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

const findStoredToolStateForUrl = async (url: string) => {
  const states = await listStoredToolStates();
  const matches = states
    .filter((entry) => matchWebsiteGlob(entry.websiteGlob, url))
    .sort((left, right) => right.websiteGlob.length - left.websiteGlob.length);

  return matches[0] ?? null;
};

const buildRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const runMatchingScriptForTab = async (tabId: number, url?: string) => {
  if (isRestrictedUrl(url)) {
    return;
  }

  const tabUrl = url ?? '';
  const matched = await findStoredToolStateForUrl(tabUrl);
  const code = matched?.state.codeEditor.content.trim() ?? '';
  if (!code) {
    return;
  }

  const request: ScriptRunRequest = {
    type: 'script:run',
    requestId: buildRequestId(),
    code
  };

  await browser.tabs.sendMessage(tabId, request);
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
    void runMatchingScriptForTab(tabId, tab.url).catch(() => {
      lastAutoRunUrlByTabId.delete(tabId);
    });
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    lastAutoRunUrlByTabId.delete(tabId);
  });
});
