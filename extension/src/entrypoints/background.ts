import { defineBackground } from "wxt/utils/define-background";

import { browser } from "wxt/browser";
import { isRestrictedUrl, matchWebsiteGlob } from "@/lib/utils/website-glob";
import { isScriptRunResponse, type ScriptRunRequest } from "@/lib/script-runner";
import { createTabBadgeUpdater } from "@/lib/background/tab-badge";
import log from "loglevel";

type ToolId = "select" | "new-element" | "selectors" | "help" | "share" | "none";

type StoredToolState = {
  activeTool: ToolId;
  codeEditor: {
    content: string;
  };
  websiteGlob: string;
  updatedAt: number;
};

const storageKeyPrefix = "pageproxy:";
const defaultScriptImportLines = [
  'import * as pq from "@/lib/pp/pp-query";',
  'import * as ps from "@/lib/pp/pp-style";',
  'import * as pa from "@/lib/pp/pp-api";',
  'import * as pv from "@/lib/pp/pp-event";',
] as const;
const defaultDefineBlockStart = "// Define elements/selectors";
const defaultDefineBlockEnd = "// End define elements/selectors";

const isToolId = (value: unknown): value is ToolId =>
  value === "select" ||
  value === "new-element" ||
  value === "selectors" ||
  value === "help" ||
  value === "share" ||
  value === "none";

const fromStorageKey = (key: string) => {
  if (!key.startsWith(storageKeyPrefix)) {
    return null;
  }

  const websiteGlob = key.slice(storageKeyPrefix.length).trim();
  return websiteGlob.length > 0 ? websiteGlob : null;
};

const coerceStoredToolState = (value: unknown, websiteGlob: string): StoredToolState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
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

  const codeEditor = data.codeEditor as { content?: unknown } | undefined;
  if (typeof codeEditor?.content !== "string") {
    return null;
  }

  return {
    activeTool: data.activeTool,
    codeEditor: {
      content: codeEditor.content,
    },
    websiteGlob:
      typeof data.websiteGlob === "string" && data.websiteGlob.trim().length > 0 ? data.websiteGlob : websiteGlob,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
  };
};

const listStoredToolStates = async () => {
  const allValues = await browser.storage.local.get(null);
  const states: Array<{ websiteGlob: string; state: StoredToolState }> = [];

  Object.entries(allValues).forEach(([key, value]) => {
    const websiteGlob = fromStorageKey(key);
    if (!websiteGlob) {
      return;
    }

    const state = coerceStoredToolState(value, websiteGlob);
    if (!state) {
      return;
    }

    states.push({ websiteGlob, state });
  });

  return states;
};

const findStoredToolStatesForUrl = async (url: string) => {
  const states = await listStoredToolStates();
  return states
    .filter((entry) => matchWebsiteGlob(entry.websiteGlob, url))
    .sort((left, right) => right.websiteGlob.length - left.websiteGlob.length);
};

const buildDefaultScript = (websiteGlob: string) => {
  const normalizedWebsite = websiteGlob.trim();
  return [
    ...defaultScriptImportLines,
    "",
    "// ==Page Proxy==",
    "// @title Page Proxy",
    normalizedWebsite ? `// @website ${normalizedWebsite}` : "// @website",
    "// @description",
    "// ==/Page Proxy==",
    "",
    defaultDefineBlockStart,
    defaultDefineBlockEnd,
    "",
  ].join("\n");
};

const ensureScriptImports = (content: string) => {
  const withoutLegacyAlias = content
    .split("\n")
    .filter((line) => line.trim() !== "const pp = pa.pp;")
    .join("\n");

  const hasAllImports = defaultScriptImportLines.every((line) => withoutLegacyAlias.includes(line));
  if (hasAllImports) {
    return withoutLegacyAlias;
  }

  return [...defaultScriptImportLines, "", withoutLegacyAlias.trimStart()].join("\n");
};

const ensureDefineBlock = (content: string) => {
  const lines = content.split("\n");
  const startIndex = lines.findIndex((line) => line.trim() === defaultDefineBlockStart);
  const endIndex = lines.findIndex((line) => line.trim() === defaultDefineBlockEnd);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    return content;
  }

  return [content.trimEnd(), "", defaultDefineBlockStart, defaultDefineBlockEnd, ""].join("\n");
};

const normalizeContentForStorage = (content: string) => ensureScriptImports(ensureDefineBlock(content));

const isDefaultScriptState = (state: StoredToolState) => {
  const defaultContent = normalizeContentForStorage(buildDefaultScript(state.websiteGlob));
  log.debug(`Default content: ${defaultContent}, code editor content: ${state.codeEditor.content}`);
  return state.codeEditor.content === defaultContent;
};

const toRunnableScriptContent = (state: StoredToolState) => {
  const content = state.codeEditor.content.trim();
  if (!content || isDefaultScriptState(state)) {
    return null;
  }

  return content;
};

const countMatchingScriptsForUrl = async (url: string) => {
  if (isRestrictedUrl(url)) {
    return 0;
  }

  const matchedStates = await findStoredToolStatesForUrl(url);
  return matchedStates.map((entry) => toRunnableScriptContent(entry.state)).filter((code) => code !== null).length;
};

const buildRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildRunRequest = (code: string): ScriptRunRequest => ({
  type: "script:run",
  requestId: buildRequestId(),
  code,
});

const runScriptInTab = async (tabId: number, code: string) => {
  const response: unknown = await browser.tabs.sendMessage(tabId, buildRunRequest(code));
  if (!isScriptRunResponse(response)) {
    return false;
  }
  return response.error === null;
};

const runMatchingScriptsForTab = async (tabId: number, url?: string) => {
  if (isRestrictedUrl(url)) {
    return 0;
  }

  const tabUrl = url ?? "";
  const matchedStates = await findStoredToolStatesForUrl(tabUrl);
  const scripts = matchedStates
    .map((entry) => toRunnableScriptContent(entry.state))
    .filter((code): code is string => code !== null);
  if (scripts.length === 0) {
    return 0;
  }

  const runResults = await Promise.all(scripts.map((code) => runScriptInTab(tabId, code).catch(() => false)));
  return runResults.filter(Boolean).length;
};

export default defineBackground(() => {
  const sidePanel = browser.sidePanel;
  if (sidePanel?.setPanelBehavior) {
    void sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
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

  const badgeUpdater = createTabBadgeUpdater(countMatchingScriptsForUrl);

  browser.tabs.onActivated.addListener(({ tabId }) => {
    void badgeUpdater.refreshBadgeForActivatedTab(tabId).catch(() => badgeUpdater.applyAutoRunFailure(tabId));
  });

  browser.windows.onFocusChanged.addListener((windowId) => {
    void badgeUpdater.refreshBadgeForWindowFocus(windowId).catch(() => {});
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "loading") {
      void badgeUpdater.handleTabLoading(tabId);
      return;
    }

    if (changeInfo.status !== "complete") {
      return;
    }

    if (!tab?.url) {
      return;
    }
    const tabUrl = tab.url;

    if (badgeUpdater.hasAutoRunUrl(tabId, tabUrl)) {
      return;
    }

    badgeUpdater.markAutoRunStarted(tabId, tabUrl);
    void runMatchingScriptsForTab(tabId, tabUrl)
      .then((count) => badgeUpdater.applyAutoRunResult(tabId, tabUrl, count))
      .catch(() => badgeUpdater.applyAutoRunFailure(tabId));
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    badgeUpdater.handleTabRemoved(tabId);
  });
});
