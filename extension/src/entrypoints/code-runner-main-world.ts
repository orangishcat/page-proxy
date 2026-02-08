import {defineUnlistedScript} from 'wxt/utils/define-unlisted-script';

import {
  buildScriptRunResponse,
  isScriptRunRequest,
  type ScriptRunResponse
} from '@/lib/script-runner';
import * as pq from '@/lib/pp/pp-query';
import * as ps from '@/lib/pp/pp-style';
import * as pa from '@/lib/pp/pp-api';

type PpModuleBindings = {
  pq: typeof pq;
  ps: typeof ps;
  pa: typeof pa;
};

type WindowWithPpModules = typeof window & {
  __pageProxyPpModules__?: PpModuleBindings;
};

const ensurePpModules = (): PpModuleBindings => {
  const target = window as WindowWithPpModules;
  if (!target.__pageProxyPpModules__) {
    target.__pageProxyPpModules__ = {
      pq,
      ps,
      pa
    };
  }

  return target.__pageProxyPpModules__;
};

const stripPpImportText = (code: string) =>
  code
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed === 'import * as pq from "@/lib/pp/pp-query";') {
        return false;
      }
      if (trimmed === 'import * as ps from "@/lib/pp/pp-style";') {
        return false;
      }
      if (trimmed === 'import * as pa from "@/lib/pp/pp-api";') {
        return false;
      }
      if (trimmed === 'const pp = pa.pp;') {
        return false;
      }
      return true;
    })
    .join('\n');

const getTargetOrigin = () => {
  if (window.location.origin === 'null') {
    return '*';
  }

  return window.location.origin;
};

const respondOnce = (
  requestId: string,
  response: ScriptRunResponse,
  cleanup: () => void,
  responded: {value: boolean}
) => {
  if (responded.value) {
    return;
  }

  responded.value = true;
  cleanup();
  window.postMessage(response, getTargetOrigin());
};

const injectBlobScript = (
  code: string,
  onSuccess: () => void,
  onFailure: () => void
) => {
  const blob = new Blob([code], {type: 'text/javascript'});
  const url = URL.createObjectURL(blob);
  const script = document.createElement('script');

  script.async = false;
  script.src = url;
  script.onload = () => {
    URL.revokeObjectURL(url);
    script.remove();
    onSuccess();
  };
  script.onerror = () => {
    URL.revokeObjectURL(url);
    script.remove();
    onFailure();
  };

  (document.head || document.documentElement).appendChild(script);
};

export default defineUnlistedScript(() => {
  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    if (!isScriptRunRequest(event.data)) {
      return;
    }

    const {requestId, code} = event.data;
    const responded = {value: false};

    const onError = (errorEvent: ErrorEvent) => {
      respondOnce(
        requestId,
        buildScriptRunResponse(
          requestId,
          `Script execution failed: ${errorEvent.message || 'Unknown error.'}`
        ),
        cleanupListeners,
        responded
      );
      errorEvent.preventDefault();
    };

    const onRejection = (rejection: PromiseRejectionEvent) => {
      const rawMessage =
        rejection.reason instanceof Error
          ? rejection.reason.message
          : 'Unknown rejection.';
      respondOnce(
        requestId,
        buildScriptRunResponse(
          requestId,
          `Script execution failed: ${rawMessage}`
        ),
        cleanupListeners,
        responded
      );
      rejection.preventDefault();
    };

    const cleanupListeners = () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    const modules = ensurePpModules();
    (globalThis as Record<string, unknown>).pq = modules.pq;
    (globalThis as Record<string, unknown>).ps = modules.ps;
    (globalThis as Record<string, unknown>).pa = modules.pa;
    const executableCode = stripPpImportText(code);
    injectBlobScript(
      executableCode,
      () => {
        respondOnce(
          requestId,
          buildScriptRunResponse(requestId, null),
          cleanupListeners,
          responded
        );
      },
      () => {
        respondOnce(
          requestId,
          buildScriptRunResponse(
            requestId,
            'Script execution blocked by the page Content Security Policy.'
          ),
          cleanupListeners,
          responded
        );
      }
    );
  });
});
