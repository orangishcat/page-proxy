import {browser} from 'wxt/browser';
import {defineContentScript} from 'wxt/utils/define-content-script';
import {injectScript} from 'wxt/utils/inject-script';
import log from 'loglevel';

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
const responseTimeoutMs = 10000;
const logger = log.getLogger('sandbox-runner');
logger.setLevel('debug', false);
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
    logger.debug('No pending sandbox response resolver', {requestId: response.requestId});
    return;
  }

  pendingResponses.delete(response.requestId);
  logger.debug('Resolved sandbox response', {requestId: response.requestId});
  resolver(response);
};

const resolvePendingRunResponse = (response: ScriptRunResponse) => {
  const resolver = pendingRunResponses.get(response.requestId);
  if (!resolver) {
    logger.debug('No pending script response resolver', {requestId: response.requestId});
    return;
  }

  pendingRunResponses.delete(response.requestId);
  logger.debug('Resolved script response', {requestId: response.requestId});
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
    logger.debug('sandbox-runner initialized', {href: window.location.href});

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
    }) => {
      logger.debug('Handling sandbox:evaluate', {requestId: message.requestId});
      return (
      ensureInjected().then((injected) => {
        if (!injected) {
          logger.error('Sandbox script injection failed', {requestId: message.requestId});
          return buildSandboxErrorResponse(
            message.requestId,
            'Unable to inject the sandbox script.'
          );
        }

        return new Promise<SandboxEvaluateResponse>((resolve) => {
          const timeoutId = window.setTimeout(() => {
            pendingResponses.delete(message.requestId);
            logger.warn('Sandbox request timed out', {requestId: message.requestId, responseTimeoutMs});
            resolve(
              buildSandboxErrorResponse(message.requestId, 'Sandbox request timed out.')
            );
          }, responseTimeoutMs);

          pendingResponses.set(message.requestId, (response) => {
            window.clearTimeout(timeoutId);
            logger.debug('Sandbox response received before timeout', {requestId: message.requestId});
            resolve(response);
          });

          logger.debug('Posting sandbox:evaluate to main world', {requestId: message.requestId});
          window.postMessage(
            {
              type: 'sandbox:evaluate',
              requestId: message.requestId,
              code: message.code
            },
            getTargetOrigin()
          );
        });
      })
    );
    };

    const handleScriptRun = (message: {requestId: string; code: string}) =>
      ensureRunInjected().then((injected) => {
        logger.debug('Handling script:run', {requestId: message.requestId});
        if (!injected) {
          logger.error('Script runner injection failed', {requestId: message.requestId});
          return buildScriptRunResponse(
            message.requestId,
            'Unable to inject the script runner.'
          );
        }

        return new Promise<ScriptRunResponse>((resolve) => {
          const timeoutId = window.setTimeout(() => {
            pendingRunResponses.delete(message.requestId);
            logger.warn('Script run timed out', {requestId: message.requestId, responseTimeoutMs});
            resolve(
              buildScriptRunResponse(message.requestId, 'Script execution timed out.')
            );
          }, responseTimeoutMs);

          pendingRunResponses.set(message.requestId, (response) => {
            window.clearTimeout(timeoutId);
            logger.debug('Script response received before timeout', {requestId: message.requestId});
            resolve(response);
          });

          logger.debug('Posting script:run to main world', {requestId: message.requestId});
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
      logger.debug('runtime.onMessage', {
        type: typeof message === 'object' && message !== null && 'type' in message
          ? (message as {type?: unknown}).type
          : null
      });

      if (!isSandboxRequest(message)) {
        if (!isScriptRunRequest(message)) {
          return;
        }

        void handleScriptRun(message)
          .then((response) => {
            sendResponse(response);
          })
          .catch((error: unknown) => {
            logger.error('script:run handling failed before response', {requestId: message.requestId, error});
            sendResponse(
              buildScriptRunResponse(
                message.requestId,
                'Script execution failed before completion.'
              )
            );
          });

        return true;
      }

      void handleSandboxRequest(message)
        .then((response) => {
          sendResponse(response);
        })
        .catch((error: unknown) => {
          logger.error('sandbox:evaluate handling failed before response', {
            requestId: message.requestId,
            error
          });
          sendResponse(
            buildSandboxErrorResponse(
              message.requestId,
              'Sandbox evaluation failed before completion.'
            )
          );
        });

      return true;
    });
  }
});
