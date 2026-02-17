import {browser} from 'wxt/browser';
import {defineContentScript} from 'wxt/utils/define-content-script';
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

const responseTimeoutMs = 1800;
const scriptRunResponseTimeoutMs = 1800;
const logger = log.getLogger('sandbox-runner');
logger.setLevel('debug', false);
const pendingResponses = new Map<string, (response: SandboxEvaluateResponse) => void>();
const pendingScriptRunResponses = new Map<string, (response: ScriptRunResponse) => void>();

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

const resolvePendingScriptRunResponse = (response: ScriptRunResponse) => {
  const resolver = pendingScriptRunResponses.get(response.requestId);
  if (!resolver) {
    logger.debug('No pending script:run response resolver', {requestId: response.requestId});
    return;
  }

  pendingScriptRunResponses.delete(response.requestId);
  logger.debug('Resolved script:run response', {requestId: response.requestId});
  resolver(response);
};

const getTargetOrigin = () => {
  if (window.location.origin === 'null') {
    return '*';
  }

  return window.location.origin;
};

const isWindowSource = (source: MessageEventSource | null) => source === window || source === null;

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    logger.debug('sandbox-runner initialized', {href: window.location.href});

    window.addEventListener('message', (event) => {
      if (!isWindowSource(event.source)) {
        return;
      }

      if (!isSandboxResponse(event.data)) {
        if (isScriptRunResponse(event.data)) {
          resolvePendingScriptRunResponse(event.data);
        }
        return;
      }

      resolvePendingResponse(event.data);
    });

    const handleSandboxRequest = (message: {
      requestId: string;
      code: string;
    }) =>
      new Promise<SandboxEvaluateResponse>((resolve) => {
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

    const handleScriptRunRequest = (message: {requestId: string; code: string}) =>
      new Promise<ScriptRunResponse>((resolve) => {
        const timeoutId = window.setTimeout(() => {
          pendingScriptRunResponses.delete(message.requestId);
          logger.warn('Script run request timed out', {
            requestId: message.requestId,
            scriptRunResponseTimeoutMs
          });
          resolve(
            buildScriptRunResponse(
              message.requestId,
              'Script run request timed out waiting for main-world response.'
            )
          );
        }, scriptRunResponseTimeoutMs);

        pendingScriptRunResponses.set(message.requestId, (response) => {
          window.clearTimeout(timeoutId);
          logger.debug('Script run response received before timeout', {requestId: message.requestId});
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

        void handleScriptRunRequest(message)
          .then((response) => {
            sendResponse(response);
          })
          .catch((error: unknown) => {
            logger.error('script:run handling failed before response', {
              requestId: message.requestId,
              error
            });
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
