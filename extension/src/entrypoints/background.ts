import { defineBackground } from "wxt/utils/define-background";

import { browser } from "wxt/browser";
import { coerceScriptGrantValues, type ScriptGrantValue } from "@/lib/grants";
import {
  isGrantPermissionResolveMessage,
  type GrantPermissionRequestMessage,
  type GrantPermissionResolveResult,
} from "@/lib/grant-permissions";
import { parseScriptMetadata } from "@/lib/utils/script-metadata";
import { isRestrictedUrl, matchWebsiteGlob } from "@/lib/utils/website-glob";
import { isScriptRunResponse, type ScriptRunRequest } from "@/lib/script-runner";
import { createTabBadgeUpdater } from "@/lib/background/tab-badge";
import { buildDefaultScript } from "@/lib/default-script";
import { ensureCodeRunnerUserscript } from "@/lib/userscript-runner";
import log from "loglevel";

type ToolId = "select" | "create" | "selectors" | "help" | "share" | "none";

type StoredToolState = {
  activeTool: ToolId;
  codeEditor: {
    content: string;
  };
  selectorPanel: {
    entries: Array<{
      name: string;
      ruleKeys: string[];
      rules?: string[];
    }>;
  };
  permissions: {
    allowedGrants: ScriptGrantValue[];
  };
  websiteGlob: string;
  updatedAt: number;
};

const storageKeyPrefix = "pageproxy:";
const runOnPageLoadGrant: ScriptGrantValue = "run-on-page-load";
const defaultScriptImportLines = ['import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";'] as const;
const defaultDefineBlockStart = "// ==Selectors==";
const defaultDefineBlockEnd = "// ==/Selectors==";
const defaultScriptConfig = {
  ppImportLines: defaultScriptImportLines,
  defineBlockStart: defaultDefineBlockStart,
  defineBlockEnd: defaultDefineBlockEnd,
} as const;
const logger = log.getLogger("background");
logger.setLevel("debug", false);

const isToolId = (value: unknown): value is ToolId =>
  value === "select" ||
  value === "create" ||
  value === "selectors" ||
  value === "help" ||
  value === "share" ||
  value === "none";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const coerceStoredSelectorEntries = (value: unknown): StoredToolState["selectorPanel"]["entries"] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: StoredToolState["selectorPanel"]["entries"] = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }

    const data = entry as {
      name?: unknown;
      ruleKeys?: unknown;
      rules?: unknown;
    };

    if (typeof data.name !== "string" || !isStringArray(data.ruleKeys)) {
      return;
    }

    const rules = isStringArray(data.rules) ? data.rules : undefined;
    entries.push({
      name: data.name,
      ruleKeys: data.ruleKeys,
      rules,
    });
  });

  return entries;
};

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
    selectorPanel?: unknown;
    permissions?: unknown;
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

  const selectorPanel = data.selectorPanel as { entries?: unknown } | undefined;
  const permissions = data.permissions as { allowedGrants?: unknown } | undefined;

  return {
    activeTool: data.activeTool,
    codeEditor: {
      content: codeEditor.content,
    },
    selectorPanel: {
      entries: coerceStoredSelectorEntries(selectorPanel?.entries),
    },
    permissions: {
      allowedGrants: coerceScriptGrantValues(permissions?.allowedGrants),
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

const toStorageKey = (websiteGlob: string) => `${storageKeyPrefix}${websiteGlob.trim()}`;

const readStoredToolState = async (websiteGlob: string) => {
  const key = toStorageKey(websiteGlob);
  const stored = await browser.storage.local.get(key);
  return coerceStoredToolState(stored[key], websiteGlob);
};

const saveStoredToolState = async (state: StoredToolState) => {
  await browser.storage.local.set({
    [toStorageKey(state.websiteGlob)]: state,
  });
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

const normalizeContentForStorage = (content: string) => ensureDefineBlock(content);

const isDefaultScriptState = (state: StoredToolState) => {
  const defaultContent = normalizeContentForStorage(buildDefaultScript(state.websiteGlob, defaultScriptConfig));
  logger.debug(`Default content: ${defaultContent}, code editor content: ${state.codeEditor.content}`);
  return state.codeEditor.content === defaultContent;
};

const toRunnableScriptContent = (state: StoredToolState) => {
  const content = state.codeEditor.content.trim();
  if (!content || isDefaultScriptState(state)) {
    return null;
  }

  return content;
};

const extractScriptGrants = (content: string) => {
  try {
    const metadata = parseScriptMetadata(content);
    return metadata.grants;
  } catch {
    return [];
  }
};

const getMissingAllowedGrants = (state: StoredToolState, requiredGrants: ScriptGrantValue[]) =>
  requiredGrants.filter((grant) => !state.permissions.allowedGrants.includes(grant));

const countMatchingScriptsForUrl = async (url: string) => {
  if (isRestrictedUrl(url)) {
    return 0;
  }

  const matchedStates = await findStoredToolStatesForUrl(url);
  return matchedStates
    .map((entry) => {
      const content = toRunnableScriptContent(entry.state);
      if (!content) {
        return null;
      }

      const scriptGrants = extractScriptGrants(content);
      if (!scriptGrants.includes(runOnPageLoadGrant)) {
        return null;
      }

      const missingGrants = getMissingAllowedGrants(entry.state, scriptGrants);
      if (missingGrants.length > 0) {
        return null;
      }

      return content;
    })
    .filter((code) => code !== null).length;
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

const isNoReceiverError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Receiving end does not exist") ||
    message.includes("Could not establish connection") ||
    message.includes("No receiving end")
  );
};

const sendRunRequestToTab = (tabId: number, code: string) =>
  browser.tabs
    .sendMessage(tabId, buildRunRequest(code), { frameId: 0 })
    .catch((error: unknown) => {
      if (!isNoReceiverError(error)) {
        throw error;
      }

      return browser.tabs.sendMessage(tabId, buildRunRequest(code));
    });

const runScriptInTab = async (tabId: number, code: string) => {
  const userscriptStatus = await ensureCodeRunnerUserscript();
  if (!userscriptStatus.ok) {
    return false;
  }

  const response: unknown = await sendRunRequestToTab(tabId, code);
  if (!isScriptRunResponse(response)) {
    return false;
  }
  return response.error === null;
};

const requestGrantPermissions = (payload: GrantPermissionRequestMessage["payload"]) =>
  browser.runtime.sendMessage({
    type: "grant:request",
    payload,
  } satisfies GrantPermissionRequestMessage);

const resolveGrantPermissions = async (
  websiteGlob: string,
  requestedGrants: ScriptGrantValue[],
  allow: boolean,
): Promise<GrantPermissionResolveResult> => {
  const normalizedWebsiteGlob = websiteGlob.trim();
  if (!normalizedWebsiteGlob) {
    return { ok: false, error: "Missing website glob for permission request." };
  }

  const grants = coerceScriptGrantValues(requestedGrants);
  if (grants.length === 0) {
    return { ok: false, error: "No supported grants were requested." };
  }

  const state = await readStoredToolState(normalizedWebsiteGlob);
  if (!state) {
    return { ok: false, error: `No script state found for website glob "${normalizedWebsiteGlob}".` };
  }

  if (!allow) {
    return { ok: true, allowedGrants: state.permissions.allowedGrants };
  }

  const nextAllowedGrants = coerceScriptGrantValues([...state.permissions.allowedGrants, ...grants]);
  const nextState: StoredToolState = {
    ...state,
    permissions: {
      allowedGrants: nextAllowedGrants,
    },
    updatedAt: Date.now(),
  };

  await saveStoredToolState(nextState);
  return { ok: true, allowedGrants: nextAllowedGrants };
};

const runMatchingScriptsForTab = async (tabId: number, url?: string) => {
  if (isRestrictedUrl(url)) {
    return 0;
  }

  const tabUrl = url ?? "";
  const matchedStates = await findStoredToolStatesForUrl(tabUrl);
  const scripts: string[] = [];
  const permissionRequests = new Map<string, Set<ScriptGrantValue>>();

  matchedStates.forEach((entry) => {
    const content = toRunnableScriptContent(entry.state);
    if (!content) {
      return;
    }

    const scriptGrants = extractScriptGrants(content);
    if (!scriptGrants.includes(runOnPageLoadGrant)) {
      return;
    }

    const missingGrants = getMissingAllowedGrants(entry.state, scriptGrants);
    if (missingGrants.length > 0) {
      if (!permissionRequests.has(entry.websiteGlob)) {
        permissionRequests.set(entry.websiteGlob, new Set<ScriptGrantValue>());
      }
      missingGrants.forEach((grant) => {
        permissionRequests.get(entry.websiteGlob)?.add(grant);
      });
      return;
    }

    scripts.push(content);
  });

  permissionRequests.forEach((grants, websiteGlob) => {
    void requestGrantPermissions({
      websiteGlob,
      grants: Array.from(grants),
    }).catch(() => {
      logger.debug("No open sidepanel receiver for grant request.", { websiteGlob });
    });
  });

  if (scripts.length === 0) {
    return 0;
  }

  const runResults = await Promise.all(scripts.map((code) => runScriptInTab(tabId, code).catch(() => false)));
  return runResults.filter(Boolean).length;
};

export default defineBackground(() => {
  const tabsWithPendingInitialLoad = new Set<number>();

  void ensureCodeRunnerUserscript().then((status) => {
    if (!status.ok) {
      logger.warn("Unable to initialize User Scripts runner", { message: status.message });
    }
  });

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isGrantPermissionResolveMessage(message)) {
      return false;
    }

    void resolveGrantPermissions(message.payload.websiteGlob, message.payload.grants, message.payload.allow)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error: unknown) => {
        const messageText = error instanceof Error ? error.message : "Unable to process permission request.";
        sendResponse({ ok: false, error: messageText } satisfies GrantPermissionResolveResult);
      });

    return true;
  });

  const sidePanel = browser.sidePanel;
  if (sidePanel?.setPanelBehavior) {
    void sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  const toolbarAction = (
    browser as typeof browser & {
      action?: {
        onClicked?: {
          addListener: (listener: () => void) => void;
        };
      };
      browserAction?: {
        onClicked?: {
          addListener: (listener: () => void) => void;
        };
      };
    }
  ).action ??
    (
      browser as typeof browser & {
        browserAction?: {
          onClicked?: {
            addListener: (listener: () => void) => void;
          };
        };
      }
    ).browserAction;

  const sidebarAction = (
    browser as typeof browser & {
      sidebarAction?: {
        open: () => Promise<void>;
      };
    }
  ).sidebarAction;

  if (sidebarAction?.open && toolbarAction?.onClicked?.addListener) {
    toolbarAction.onClicked.addListener(() => {
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
      tabsWithPendingInitialLoad.add(tabId);
      void badgeUpdater.handleTabLoading(tabId);
      return;
    }

    if (changeInfo.status !== "complete") {
      return;
    }

    if (!tabsWithPendingInitialLoad.has(tabId)) {
      return;
    }
    tabsWithPendingInitialLoad.delete(tabId);

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
    tabsWithPendingInitialLoad.delete(tabId);
    badgeUpdater.handleTabRemoved(tabId);
  });
});
