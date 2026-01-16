import {browser} from 'wxt/browser';
import {defineContentScript} from 'wxt/utils/define-content-script';
import {injectScript} from 'wxt/utils/inject-script';

import {
  buildSandboxErrorResponse,
  isSandboxRequest,
  isSandboxResponse,
  type SandboxEvaluateResponse
} from '@/lib/sandbox';
import {
  buildScriptRunResponse,
  isScriptRunRequest,
  isScriptRunResponse,
  type ScriptRunResponse
} from '@/lib/script-runner';

const injectedScriptPath = 'sandbox-main-world.js';
const runScriptPath = 'code-runner-main-world.js';
const responseTimeoutMs = 2000;
let injectPromise: Promise<boolean> | null = null;
let runInjectPromise: Promise<boolean> | null = null;
const pendingResponses = new Map<string, (response: SandboxEvaluateResponse) => void>();
const pendingRunResponses = new Map<string, (response: ScriptRunResponse) => void>();

const ensureInjected = () => {
  if (injectPromise) {
    return injectPromise;
  }

  injectPromise = injectScript(injectedScriptPath, {keepInDom: true})
    .then(() => true)
    .catch(() => false);

  return injectPromise;
};

const ensureRunInjected = () => {
  if (runInjectPromise) {
    return runInjectPromise;
  }

  runInjectPromise = injectScript(runScriptPath, {keepInDom: true})
    .then(() => true)
    .catch(() => false);

  return runInjectPromise;
};

const resolvePendingResponse = (response: SandboxEvaluateResponse) => {
  const resolver = pendingResponses.get(response.requestId);
  if (!resolver) {
    return;
  }

  pendingResponses.delete(response.requestId);
  resolver(response);
};

const resolvePendingRunResponse = (response: ScriptRunResponse) => {
  const resolver = pendingRunResponses.get(response.requestId);
  if (!resolver) {
    return;
  }

  pendingRunResponses.delete(response.requestId);
  resolver(response);
};

const getTargetOrigin = () => {
  if (window.location.origin === 'null') {
    return '*';
  }

  return window.location.origin;
};

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) {
        return;
      }

      if (!isSandboxResponse(event.data)) {
        return;
      }

      resolvePendingResponse(event.data);
    });

    window.addEventListener('message', (event) => {
      if (event.source !== window) {
        return;
      }

      if (!isScriptRunResponse(event.data)) {
        return;
      }

      resolvePendingRunResponse(event.data);
    });

    const handleSandboxRequest = (message: {
      requestId: string;
      code: string;
    }) =>
      ensureInjected().then((injected) => {
        if (!injected) {
          return buildSandboxErrorResponse(
            message.requestId,
            'Unable to inject the sandbox script.'
          );
        }

        return new Promise<SandboxEvaluateResponse>((resolve) => {
          const timeoutId = window.setTimeout(() => {
            pendingResponses.delete(message.requestId);
            resolve(
              buildSandboxErrorResponse(message.requestId, 'Sandbox request timed out.')
            );
          }, responseTimeoutMs);

          pendingResponses.set(message.requestId, (response) => {
            window.clearTimeout(timeoutId);
            resolve(response);
          });

          window.postMessage(
            {
              type: 'sandbox:evaluate',
              requestId: message.requestId,
              code: message.code
            },
            getTargetOrigin()
          );
        });
      });

    const handleScriptRun = (message: {requestId: string; code: string}) =>
      ensureRunInjected().then((injected) => {
        if (!injected) {
          return buildScriptRunResponse(
            message.requestId,
            'Unable to inject the script runner.'
          );
        }

        return new Promise<ScriptRunResponse>((resolve) => {
          const timeoutId = window.setTimeout(() => {
            pendingRunResponses.delete(message.requestId);
            resolve(
              buildScriptRunResponse(message.requestId, 'Script execution timed out.')
            );
          }, responseTimeoutMs);

          pendingRunResponses.set(message.requestId, (response) => {
            window.clearTimeout(timeoutId);
            resolve(response);
          });

          window.postMessage(
            {
              type: 'script:run',
              requestId: message.requestId,
              code: message.code
            },
            getTargetOrigin()
          );
        });
      });

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isSandboxRequest(message)) {
        if (!isScriptRunRequest(message)) {
          return;
        }

        void handleScriptRun(message).then((response) => {
          sendResponse(response);
        });

        return true;
      }

      void handleSandboxRequest(message).then((response) => {
        sendResponse(response);
      });

      return true;
    });
  }
});
