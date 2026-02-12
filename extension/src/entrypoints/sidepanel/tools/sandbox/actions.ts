import {browser} from 'wxt/browser';
import log from 'loglevel';

import {
  buildSandboxErrorResponse,
  isSandboxResponse,
  type SandboxEvaluateRequest,
  type SandboxResult
} from '@/lib/sandbox';
import {
  buildScriptRunResponse,
  isScriptRunResponse,
  type ScriptRunRequest,
  type ScriptRunResult
} from '@/lib/script-runner';
import {isRestrictedUrl} from '@/lib/utils/website-glob';

const emptyResult: SandboxResult = {elements: [], selectors: [], errors: []};
const emptyRunResult: ScriptRunResult = {errors: [], logs: []};
const responseTimeoutMs = 15000;
const maxScriptRunAttempts = 3;
const scriptRunRetryDelayMs = 200;
const receiverBootstrapDelayMs = 150;
const sandboxRunnerScriptFile = 'content-scripts/sandbox-runner.js';
const logger = log.getLogger('sandbox-actions');
logger.setLevel('debug', false);

type BrowserWithScripting = typeof browser & {
  scripting?: {
    executeScript: (details: {
      target: {tabId: number; allFrames?: boolean};
      files: string[];
    }) => Promise<unknown>;
  };
};

type TabsWithExecuteScript = typeof browser.tabs & {
  executeScript?: (tabId: number, details: {file: string}) => Promise<unknown>;
};

const toResult = (message: string): SandboxResult => ({
  elements: [],
  selectors: [],
  errors: [message]
});
const toRunResult = (message: string): ScriptRunResult => ({errors: [message], logs: []});

const buildRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

const isNoReceiverError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Receiving end does not exist') ||
    message.includes('Could not establish connection') ||
    message.includes('No receiving end')
  );
};

const injectSandboxRunnerReceiver = (tabId: number) => {
  const browserWithScripting = browser as BrowserWithScripting;
  if (browserWithScripting.scripting?.executeScript) {
    return browserWithScripting.scripting
      .executeScript({
        target: {tabId, allFrames: false},
        files: [sandboxRunnerScriptFile]
      })
      .then(() => {
        logger.debug('Injected sandbox-runner via scripting.executeScript', {tabId});
        return true;
      })
      .catch((error: unknown) => {
        logger.warn('scripting.executeScript injection failed', {tabId, error});
        return false;
      });
  }

  const tabsWithExecuteScript = browser.tabs as TabsWithExecuteScript;
  if (typeof tabsWithExecuteScript.executeScript === 'function') {
    return tabsWithExecuteScript
      .executeScript(tabId, {file: sandboxRunnerScriptFile})
      .then(() => {
        logger.debug('Injected sandbox-runner via tabs.executeScript', {tabId});
        return true;
      })
      .catch((error: unknown) => {
        logger.warn('tabs.executeScript injection failed', {tabId, error});
        return false;
      });
  }

  logger.warn('No available API to inject sandbox-runner receiver', {tabId});
  return Promise.resolve(false);
};

const sendMessageToTab = (
  tabId: number,
  request: SandboxEvaluateRequest | ScriptRunRequest
): Promise<unknown> =>
  browser.tabs
    .sendMessage(tabId, request, {frameId: 0})
    .catch((error: unknown) => {
      if (!isNoReceiverError(error)) {
        throw toError(error);
      }

      logger.warn('No receiver in frame 0, retrying without frameId.', {
        tabId,
        requestType: request.type,
        error
      });

      return browser.tabs.sendMessage(tabId, request);
    })
    .catch((error: unknown) => {
      if (!isNoReceiverError(error)) {
        throw toError(error);
      }

      logger.warn('No receiver found, attempting sandbox-runner injection.', {
        tabId,
        requestType: request.type,
        error
      });

      return injectSandboxRunnerReceiver(tabId).then((injected) => {
        if (!injected) {
          throw toError(error);
        }

        return wait(receiverBootstrapDelayMs).then(() => browser.tabs.sendMessage(tabId, request));
      });
    });

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      logger.warn('Tab response timed out', {timeoutMs});
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

export const requestSandboxEvaluation = async (code: string): Promise<SandboxResult> => {
  if (!code.trim()) {
    return emptyResult;
  }

  const tabs = await browser.tabs.query({active: true, currentWindow: true});
  const activeTab = tabs[0];
  if (!activeTab?.id) {
    return toResult('No active tab found.');
  }

  if (isRestrictedUrl(activeTab.url)) {
    return toResult('Sandbox is unavailable on this page.');
  }

  const requestId = buildRequestId();
  const request: SandboxEvaluateRequest = {
    type: 'sandbox:evaluate',
    requestId,
    code
  };

  logger.debug('Sending sandbox:evaluate', {requestId, tabId: activeTab.id, url: activeTab.url});

  const timeoutFallback = buildSandboxErrorResponse(
    requestId,
    'Sandbox request timed out waiting for tab response.'
  );

  return withTimeout(
    sendMessageToTab(activeTab.id, request),
    responseTimeoutMs,
    timeoutFallback
  )
    .then((response) => {
      logger.debug('Received sandbox:evaluate response', {requestId, responseType: typeof response});
      if (!isSandboxResponse(response) || response.requestId !== requestId) {
        return buildSandboxErrorResponse(requestId, 'Sandbox returned an invalid response.');
      }

      return response;
    })
    .then((response) => ({
      elements: response.elements,
      selectors: response.selectors,
      errors: response.errors
    }))
    .catch((error: unknown) => {
      logger.error('sandbox:evaluate failed', {requestId, error});
      return toResult('Unable to connect to the active tab.');
    });
};

const requestScriptRunAttempt = (
  tabId: number,
  tabUrl: string | undefined,
  code: string,
  attempt: number
): Promise<ScriptRunResult> => {
  const requestId = buildRequestId();
  const request: ScriptRunRequest = {
    type: 'script:run',
    requestId,
    code
  };

  logger.debug('Sending script:run', {
    requestId,
    tabId,
    url: tabUrl,
    attempt,
    maxScriptRunAttempts
  });

  const timeoutFallback = buildScriptRunResponse(
    requestId,
    'Script request timed out waiting for tab response.'
  );

  return withTimeout(
    sendMessageToTab(tabId, request),
    responseTimeoutMs,
    timeoutFallback
  )
    .then((response) => {
      logger.debug('Received script:run response', {
        requestId,
        responseType: typeof response,
        attempt
      });

      if (response === undefined && attempt < maxScriptRunAttempts) {
        logger.warn('Received empty script:run response, retrying.', {
          requestId,
          attempt,
          retryDelayMs: scriptRunRetryDelayMs
        });

        return wait(scriptRunRetryDelayMs).then(() =>
          requestScriptRunAttempt(tabId, tabUrl, code, attempt + 1)
        );
      }

      if (response === undefined) {
        return toRunResult('Script runner did not respond. Reload the page and try again.');
      }

      if (!isScriptRunResponse(response) || response.requestId !== requestId) {
        return toRunResult('Script returned an invalid response.');
      }

      return {
        errors: response.error ? [response.error] : [],
        logs: response.logs ?? []
      };
    })
    .catch((error: unknown) => {
      logger.error('script:run failed', {requestId, error, attempt});
      return toRunResult('Unable to connect to the active tab.');
    });
};

export const requestScriptRun = async (code: string): Promise<ScriptRunResult> => {
  if (!code.trim()) {
    return emptyRunResult;
  }

  const tabs = await browser.tabs.query({active: true, currentWindow: true});
  const activeTab = tabs[0];
  if (!activeTab?.id) {
    return toRunResult('No active tab found.');
  }

  if (isRestrictedUrl(activeTab.url)) {
    return toRunResult('Script execution is unavailable on this page.');
  }

  return requestScriptRunAttempt(activeTab.id, activeTab.url, code, 1);
};
