import {browser} from 'wxt/browser';

import {
  buildSandboxErrorResponse,
  isSandboxResponse,
  type SandboxEvaluateRequest,
  type SandboxResult
} from '@/lib/sandbox';

const isRestrictedUrl = (url: string | undefined) => {
  if (!url) {
    return true;
  }

  const normalized = url.toLowerCase();
  return (
    normalized.startsWith('chrome://') ||
    normalized.startsWith('brave://') ||
    normalized.startsWith('edge://') ||
    normalized.startsWith('about:') ||
    normalized.startsWith('chrome-extension://') ||
    normalized.startsWith('moz-extension://') ||
    normalized.startsWith('view-source:')
  );
};

const emptyResult: SandboxResult = {elements: [], styles: [], errors: []};

const toResult = (message: string): SandboxResult => ({
  elements: [],
  styles: [],
  errors: [message]
});

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
      styles: response.styles,
      errors: response.errors
    }))
    .catch(() => toResult('Unable to connect to the active tab.'));
};
