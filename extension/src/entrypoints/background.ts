import { defineBackground } from "wxt/utils/define-background";

import { browser } from "wxt/browser";
import { readDisableAllGrantsSetting } from "@/lib/disable-all-grants-setting";
import { coerceScriptGrantValues, resolveEffectiveScriptGrants, type ScriptGrantValue } from "@/lib/grants";
import {
  isGrantPermissionResolveMessage,
  type GrantPermissionRequestMessage,
  type GrantPermissionResolveResult,
  type GrantResolvedMessage,
} from "@/lib/grant-permissions";
import { isRestrictedUrl } from "@/lib/utils/website-glob";
import { isNoReceiverError } from "@/lib/utils/error-detection";
import { isScriptRunResponse, type ScriptRunRequest } from "@/lib/script-runner";
import { createTabBadgeUpdater } from "@/lib/background/tab-badge";
import { createDevtoolsSelectionRuntimeHandler } from "@/lib/background/devtools-selection";
import { buildDefaultScript } from "@/lib/default-script";
import { createEmptyStoredRuntimeStorage } from "@/lib/script-runtime-storage";
import { ensureCodeRunnerUserscript } from "@/lib/userscript-runner";
import {
  coerceStoredToolState,
  findBestMatchingWebsiteGlob,
  fromStorageKey,
  getWebsiteGlobsFromContent,
  resolveMetadataFallback,
  toStorageKey,
  type StoredToolState,
} from "@/lib/stored-tool-state";
import log from "@/lib/logger";

type StoredStateMatch = {
  scriptName: string;
  matchedWebsiteGlob: string;
  state: StoredToolState;
};

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

const listStoredToolStates = async () => {
  const allValues = await browser.storage.local.get(null);
  const dedupedStates = new Map<string, { scriptName: string; state: StoredToolState }>();

  Object.entries(allValues).forEach(([key, value]) => {
    const scriptName = fromStorageKey(key);
    if (!scriptName) {
      return;
    }

    const state = coerceStoredToolState(value, scriptName);
    if (!state) {
      return;
    }

    const existing = dedupedStates.get(state.scriptName);
    if (!existing || state.updatedAt >= existing.state.updatedAt) {
      dedupedStates.set(state.scriptName, { scriptName: state.scriptName, state });
    }
  });

  return Array.from(dedupedStates.values());
};

const findStoredToolStatesForUrl = async (url: string) => {
  const states = await listStoredToolStates();
  const matches: StoredStateMatch[] = [];
  states.forEach((entry) => {
    const websiteGlobs = getWebsiteGlobsFromContent(entry.state.codeEditor.content);
    const matchedWebsiteGlob = findBestMatchingWebsiteGlob(websiteGlobs, url);
    if (!matchedWebsiteGlob) {
      return;
    }

    matches.push({
      scriptName: entry.state.scriptName,
      matchedWebsiteGlob,
      state: entry.state,
    });
  });

  return matches.sort((left, right) => {
    const byGlobLength = right.matchedWebsiteGlob.length - left.matchedWebsiteGlob.length;
    if (byGlobLength !== 0) {
      return byGlobLength;
    }
    return right.state.updatedAt - left.state.updatedAt;
  });
};

const readStoredToolState = async (scriptName: string) => {
  const key = toStorageKey(scriptName);
  const stored = await browser.storage.local.get(key);
  return coerceStoredToolState(stored[key], scriptName);
};

const saveStoredToolState = async (state: StoredToolState) => {
  await browser.storage.local.set({
    [toStorageKey(state.scriptName)]: state,
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
  const defaultContent = normalizeContentForStorage(
    buildDefaultScript(state.websiteGlob, defaultScriptConfig, state.scriptName),
  );
  return state.codeEditor.content === defaultContent;
};

const toRunnableScriptContent = (state: StoredToolState) => {
  const content = state.codeEditor.content.trim();
  if (!content || isDefaultScriptState(state)) {
    return null;
  }

  return content;
};

const extractScriptGrants = (content: string, disableAllGrants: boolean, scriptEnabled: boolean) =>
  resolveEffectiveScriptGrants(resolveMetadataFallback(content)?.grants ?? [], disableAllGrants, scriptEnabled);

const getMissingAllowedGrants = (state: StoredToolState, requiredGrants: ScriptGrantValue[]) =>
  requiredGrants.filter((grant) => !state.permissions.allowedGrants.includes(grant));

const countMatchingScriptsForUrl = async (url: string) => {
  if (isRestrictedUrl(url)) {
    return 0;
  }

  const matchedStates = await findStoredToolStatesForUrl(url);
  const disableAllGrants = await readDisableAllGrantsSetting();
  return matchedStates
    .map((entry) => {
      const content = toRunnableScriptContent(entry.state);
      if (!content) {
        return null;
      }

      const scriptGrants = extractScriptGrants(content, disableAllGrants, entry.state.permissions.enabled);
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

const buildRunRequest = (state: StoredToolState, code: string): ScriptRunRequest => ({
  type: "script:run",
  requestId: buildRequestId(),
  code,
  scriptName: state.scriptName,
  runtimeStorage: state.runtimeStorage ?? createEmptyStoredRuntimeStorage(),
});

const sendRunRequestToTab = (tabId: number, state: StoredToolState, code: string) =>
  browser.tabs.sendMessage(tabId, buildRunRequest(state, code), { frameId: 0 }).catch((error: unknown) => {
    if (!isNoReceiverError(error)) {
      throw error;
    }

    return browser.tabs.sendMessage(tabId, buildRunRequest(state, code));
  });

const runScriptInTab = async (tabId: number, state: StoredToolState, code: string) => {
  const userscriptStatus = await ensureCodeRunnerUserscript();
  if (!userscriptStatus.ok) {
    return null;
  }

  const response: unknown = await sendRunRequestToTab(tabId, state, code);
  if (!isScriptRunResponse(response)) {
    return null;
  }

  const latestState = await readStoredToolState(state.scriptName);
  if (latestState) {
    await saveStoredToolState({
      ...latestState,
      runtimeStorage: response.runtimeStorage,
    });
  }

  return response;
};

const requestGrantPermissions = (payload: GrantPermissionRequestMessage["payload"]) =>
  browser.runtime.sendMessage({
    type: "grant:request",
    payload,
  } satisfies GrantPermissionRequestMessage);

const resolveGrantPermissions = async (
  scriptName: string,
  requestedGrants: ScriptGrantValue[],
  allow: boolean,
): Promise<GrantPermissionResolveResult> => {
  const normalizedScriptName = scriptName.trim();
  if (!normalizedScriptName) {
    return { ok: false, error: "Missing script name for permission request." };
  }

  const grants = coerceScriptGrantValues(requestedGrants);
  if (grants.length === 0) {
    return { ok: false, error: "No supported grants were requested." };
  }

  const state = await readStoredToolState(normalizedScriptName);
  if (!state) {
    return { ok: false, error: `No script state found for script "${normalizedScriptName}".` };
  }

  if (!allow) {
    return { ok: true, allowedGrants: state.permissions.allowedGrants };
  }

  const nextAllowedGrants = coerceScriptGrantValues([...state.permissions.allowedGrants, ...grants]);
  const nextState: StoredToolState = {
    ...state,
    permissions: {
      allowedGrants: nextAllowedGrants,
      enabled: state.permissions.enabled,
    },
    updatedAt: Date.now(),
  };

  await saveStoredToolState(nextState);
  return { ok: true, allowedGrants: nextAllowedGrants };
};

const runMatchingScriptsForTab = async (tabId: number, url?: string) => {
  logger.debug("runMatchingScriptsForTab called", { tabId, url });

  if (isRestrictedUrl(url)) {
    logger.debug("runMatchingScriptsForTab: restricted URL, skipping", { url });
    return 0;
  }

  const tabUrl = url ?? "";
  const matchedStates = await findStoredToolStatesForUrl(tabUrl);
  const disableAllGrants = await readDisableAllGrantsSetting();
  logger.debug("runMatchingScriptsForTab: matched states", { count: matchedStates.length, tabUrl });

  const scripts: Array<{ code: string; state: StoredToolState }> = [];
  const permissionRequests = new Map<string, Set<ScriptGrantValue>>();

  matchedStates.forEach((entry) => {
    const content = toRunnableScriptContent(entry.state);
    if (!content) {
      logger.debug("runMatchingScriptsForTab: skipping entry — no runnable content", { scriptName: entry.scriptName });
      return;
    }

    const scriptGrants = extractScriptGrants(content, disableAllGrants, entry.state.permissions.enabled);
    if (!scriptGrants.includes(runOnPageLoadGrant)) {
      logger.debug("runMatchingScriptsForTab: skipping entry — no run-on-page-load grant", {
        scriptName: entry.scriptName,
        grants: scriptGrants,
      });
      return;
    }

    const missingGrants = getMissingAllowedGrants(entry.state, scriptGrants);
    if (missingGrants.length > 0) {
      logger.debug("runMatchingScriptsForTab: grant request needed", {
        scriptName: entry.scriptName,
        missingGrants,
        allowedGrants: entry.state.permissions.allowedGrants,
      });
      if (!permissionRequests.has(entry.scriptName)) {
        permissionRequests.set(entry.scriptName, new Set<ScriptGrantValue>());
      }
      missingGrants.forEach((grant) => {
        permissionRequests.get(entry.scriptName)?.add(grant);
      });
      return;
    }

    logger.debug("runMatchingScriptsForTab: script ready to run", { scriptName: entry.scriptName });
    scripts.push({
      code: content,
      state: entry.state,
    });
  });

  logger.debug("runMatchingScriptsForTab: summary", {
    tabId,
    tabUrl,
    permissionRequestCount: permissionRequests.size,
    runnableScriptCount: scripts.length,
  });

  permissionRequests.forEach((grants, scriptName) => {
    const payload = { scriptName, grants: Array.from(grants) };
    logger.debug("runMatchingScriptsForTab: sending grant request", { scriptName, grants: payload.grants, tabId });
    void requestGrantPermissions(payload).catch(() => {
      logger.debug("No open sidepanel receiver for grant request.", { scriptName });
    });
    void browser.tabs
      .sendMessage(tabId, { type: "grant:request", payload } satisfies GrantPermissionRequestMessage)
      .catch(() => {
        logger.debug("No open content script receiver for grant request.", { scriptName });
      });
  });

  if (scripts.length === 0) {
    return 0;
  }

  const runResults = await Promise.all(
    scripts.map(({ code, state }) => runScriptInTab(tabId, state, code).catch(() => null)),
  );
  return runResults.filter((response) => response?.error === null).length;
};

export default defineBackground(() => {
  const tabsWithPendingInitialLoad = new Set<number>();
  const devtoolsSelectionRuntime = createDevtoolsSelectionRuntimeHandler();

  void ensureCodeRunnerUserscript().then((status) => {
    if (!status.ok) {
      logger.warn("Unable to initialize User Scripts runner", { message: status.message });
    }
  });

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isGrantPermissionResolveMessage(message)) {
      return devtoolsSelectionRuntime.handleRuntimeMessage(
        message,
        _sender as chrome.runtime.MessageSender,
        sendResponse,
      );
    }

    const allow = message.payload.allow;
    void resolveGrantPermissions(message.payload.scriptName, message.payload.grants, allow)
      .then((result) => {
        sendResponse(result);
        if (result.ok) {
          void browser.runtime
            .sendMessage({
              type: "grant:resolved",
              payload: { allowedGrants: result.allowedGrants, allow },
            } satisfies GrantResolvedMessage)
            .catch(() => { logger.debug("No sidepanel receiver for grant:resolved message."); });
        }
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

  const toolbarAction =
    (
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
    void badgeUpdater.refreshBadgeForWindowFocus(windowId).catch(() => { logger.debug("Badge refresh on window focus failed."); });
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
