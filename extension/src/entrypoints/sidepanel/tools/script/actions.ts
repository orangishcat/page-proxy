import { browser } from "wxt/browser";
import log from "@/lib/logger";

import {
  buildScriptRunResponse,
  isScriptRunResponse,
  type ScriptRunRequest,
  type ScriptRunResult,
} from "@/lib/script-runner";
import {
  createEmptyStoredRuntimeStorage,
  type StoredRuntimeStorage,
} from "@/lib/script-runtime-storage";
import { ensureCodeRunnerUserscript, getUserscriptEnableMessage } from "@/lib/userscript-runner";
import { isRestrictedUrl } from "@/lib/utils/website-glob";
import { isNoReceiverError } from "@/lib/utils/error-detection";
import { readStoredToolState, saveStoredToolState } from "../state-storage";

const emptyRunResult: ScriptRunResult = { errors: [], errorStacks: [], logs: [], selectors: [] };
const responseTimeoutMs = 1800;
const maxScriptRunAttempts = 3;
const scriptRunRetryDelayMs = 200;
const scriptRunBroadcastWaitTimeoutMs = 1500;
const logger = log.getLogger("script-actions");
type ScriptRunAttemptResult = {
  result: ScriptRunResult;
  runtimeStorage: StoredRuntimeStorage;
};

const toRunResult = (message: string, errorStack: string | null = null): ScriptRunResult => ({
  errors: [message],
  errorStacks: errorStack ? [errorStack] : [],
  logs: [],
  selectors: [],
});

const buildRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

const isClosedMessageChannelError = (error: unknown) => {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("message channel closed before a response was received") ||
    message.includes("message port closed before a response was received") ||
    (message.includes("listener indicated an asynchronous response") &&
      message.includes("closed before a response was received"))
  );
};

const sendScriptRunMessageToTab = (tabId: number, request: ScriptRunRequest): Promise<unknown> =>
  browser.tabs
    .sendMessage(tabId, request, { frameId: 0 })
    .catch((error: unknown) => {
      if (!isNoReceiverError(error)) {
        throw toError(error);
      }

      logger.warn("No script-run receiver in frame 0, retrying without frameId.", {
        tabId,
        requestType: request.type,
        error,
      });

      return browser.tabs.sendMessage(tabId, request);
    })
    .catch((error: unknown) => {
      if (!isNoReceiverError(error)) {
        throw toError(error);
      }

      throw toError(error);
    });

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      logger.warn("Tab response timed out", { timeoutMs });
      resolve(fallbackValue);
    }, timeoutMs);

    promise
      .then((value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: unknown) => {
        globalThis.clearTimeout(timeoutId);
        reject(toError(error));
      });
  });

const createScriptRunBroadcastWaiter = (requestId: string, timeoutMs: number) => {
  let settled = false;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  let listener: ((message: unknown) => boolean) | null = null;

  const cleanup = () => {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (listener) {
      browser.runtime.onMessage.removeListener(listener);
      listener = null;
    }
  };

  const promise = new Promise<unknown>((resolve) => {
    listener = (message: unknown) => {
      if (!isScriptRunResponse(message) || message.requestId !== requestId) {
        return false;
      }

      settled = true;
      cleanup();
      resolve(message);
      return false;
    };

    browser.runtime.onMessage.addListener(listener);
    timeoutId = globalThis.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(undefined);
    }, timeoutMs);
  });

  return {
    promise,
    cancel: () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
    },
  };
};

const toScriptRunResultFromResponse = (requestId: string, response: unknown): ScriptRunAttemptResult | null => {
  if (!isScriptRunResponse(response) || response.requestId !== requestId) {
    return null;
  }

  return {
    result: {
      errors: response.error ? [response.error] : [],
      errorStacks: response.errorStack ? [response.errorStack] : [],
      logs: response.logs ?? [],
      selectors: response.selectors ?? [],
    },
    runtimeStorage: response.runtimeStorage,
  };
};

const requestScriptRunAttempt = (
  tabId: number,
  tabUrl: string | undefined,
  request: ScriptRunRequest,
  attempt: number,
): Promise<ScriptRunAttemptResult> => {
  const requestId = request.requestId;

  logger.debug("Sending script:run", {
    requestId,
    tabId,
    url: tabUrl,
    attempt,
    maxScriptRunAttempts,
  });

  const timeoutFallback = buildScriptRunResponse(
    requestId,
    "Script request timed out waiting for tab response, try reloading the current tab",
    [],
    [],
    null,
    request.runtimeStorage,
  );
  const broadcastWaiter = createScriptRunBroadcastWaiter(requestId, scriptRunBroadcastWaitTimeoutMs);

  return withTimeout(sendScriptRunMessageToTab(tabId, request), responseTimeoutMs, timeoutFallback)
    .then((response) => {
      logger.debug("Received script:run response", {
        requestId,
        responseType: typeof response,
        attempt,
      });

      const directResult = toScriptRunResultFromResponse(requestId, response);
      if (directResult) {
        broadcastWaiter.cancel();
        return directResult;
      }

      return broadcastWaiter.promise.then((broadcastResponse) => {
        const broadcastResult = toScriptRunResultFromResponse(requestId, broadcastResponse);
        if (broadcastResult) {
          return broadcastResult;
        }

        if (response === undefined && attempt < maxScriptRunAttempts) {
          logger.warn("Received empty script:run response, retrying.", {
            requestId,
            attempt,
            retryDelayMs: scriptRunRetryDelayMs,
          });

          return wait(scriptRunRetryDelayMs).then(() => requestScriptRunAttempt(tabId, tabUrl, request, attempt + 1));
        }

        if (response === undefined) {
          return {
            result: toRunResult("Script runner did not respond. Reload the page and try again."),
            runtimeStorage: request.runtimeStorage,
          };
        }

        return {
          result: toRunResult("Script returned an invalid response."),
          runtimeStorage: request.runtimeStorage,
        };
      });
    })
    .catch((error: unknown) => {
      const normalizedError = toError(error);
      if (isClosedMessageChannelError(error)) {
        logger.warn("script:run response channel closed", { requestId, error, attempt });
        return broadcastWaiter.promise.then((broadcastResponse) => {
          const broadcastResult = toScriptRunResultFromResponse(requestId, broadcastResponse);
          if (broadcastResult) {
            return broadcastResult;
          }

          if (attempt < maxScriptRunAttempts) {
            return wait(scriptRunRetryDelayMs).then(() => requestScriptRunAttempt(tabId, tabUrl, request, attempt + 1));
          }

          return {
            result: toRunResult("Script runner disconnected before it could reply. Reload the page and try again."),
            runtimeStorage: request.runtimeStorage,
          };
        });
      }

      broadcastWaiter.cancel();
      logger.error("script:run failed", { requestId, error, attempt });
      if (isNoReceiverError(error)) {
        return {
          result: toRunResult(`${getUserscriptEnableMessage()} If already enabled, reload this tab and run again.`),
          runtimeStorage: request.runtimeStorage,
        };
      }
      return {
        result: toRunResult("Unable to connect to the active tab.", normalizedError.stack ?? null),
        runtimeStorage: request.runtimeStorage,
      };
    });
};

export const requestScriptRun = async (code: string, scriptName: string): Promise<ScriptRunResult> => {
  if (!code.trim()) {
    return emptyRunResult;
  }

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (!activeTab?.id) {
    return toRunResult("No active tab found.");
  }

  if (isRestrictedUrl(activeTab.url)) {
    return toRunResult("Script execution is unavailable on this page.");
  }

  const userscriptStatus = await ensureCodeRunnerUserscript();
  if (!userscriptStatus.ok) {
    return toRunResult(userscriptStatus.message);
  }

  const storedState = await readStoredToolState(scriptName);
  const request: ScriptRunRequest = {
    type: "script:run",
    requestId: buildRequestId(),
    code,
    scriptName,
    runtimeStorage: storedState?.runtimeStorage ?? createEmptyStoredRuntimeStorage(),
  };

  const attemptResult = await requestScriptRunAttempt(activeTab.id, activeTab.url, request, 1);
  const latestState = await readStoredToolState(scriptName);
  if (latestState) {
    await saveStoredToolState({
      ...latestState,
      runtimeStorage: attemptResult.runtimeStorage,
    });
  }

  return attemptResult.result;
};
