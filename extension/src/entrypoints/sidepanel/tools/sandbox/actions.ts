import {browser} from 'wxt/browser';

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
import {isRestrictedUrl} from '@/lib/utils/url-utils';

const emptyResult: SandboxResult = {elements: [], selectors: [], errors: []};
const emptyRunResult: ScriptRunResult = {errors: [], logs: []};

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

  return browser.tabs
    .sendMessage(activeTab.id, request)
    .then((response) => {
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
    .catch(() => toResult('Unable to connect to the active tab.'));
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

  return browser.tabs
    .sendMessage(activeTab.id, request)
    .then((response) => {
      if (!isScriptRunResponse(response) || response.requestId !== requestId) {
        return buildScriptRunResponse(requestId, 'Script returned an invalid response.');
      }

      return response;
    })
    .then((response) => ({
      errors: response.error ? [response.error] : [],
      logs: response.logs ?? []
    }))
    .catch(() => toRunResult('Unable to connect to the active tab.'));
};
