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
const logger = log.getLogger('sandbox-actions');
logger.setLevel('debug', false);

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
        reject(error instanceof Error ? error : new Error(String(error)));
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
    browser.tabs.sendMessage(activeTab.id, request, {frameId: 0}),
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

  const requestId = buildRequestId();
  const request: ScriptRunRequest = {
    type: 'script:run',
    requestId,
    code
  };

  logger.debug('Sending script:run', {requestId, tabId: activeTab.id, url: activeTab.url});

  const timeoutFallback = buildScriptRunResponse(
    requestId,
    'Script request timed out waiting for tab response.'
  );

  return withTimeout(
    browser.tabs.sendMessage(activeTab.id, request, {frameId: 0}),
    responseTimeoutMs,
    timeoutFallback
  )
    .then((response) => {
      logger.debug('Received script:run response', {requestId, responseType: typeof response});
      if (!isScriptRunResponse(response) || response.requestId !== requestId) {
        return buildScriptRunResponse(requestId, 'Script returned an invalid response.');
      }

      return response;
    })
    .then((response) => ({
      errors: response.error ? [response.error] : [],
      logs: response.logs ?? []
    }))
    .catch((error: unknown) => {
      logger.error('script:run failed', {requestId, error});
      return toRunResult('Unable to connect to the active tab.');
    });
};
