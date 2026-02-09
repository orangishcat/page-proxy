import {defineUnlistedScript} from 'wxt/utils/define-unlisted-script';

import {
  buildScriptRunResponse,
  isScriptRunRequest,
  type ScriptRunLogEntry,
  type ScriptRunLogValue,
  type ScriptRunResponse
} from '@/lib/script-runner';
import * as pq from '@/lib/pp/pp-query';
import * as ps from '@/lib/pp/pp-style';
import * as pa from '@/lib/pp/pp-api';
import * as pv from '@/lib/pp/pp-event';

type PpModuleBindings = {
  pq: typeof pq;
  ps: typeof ps;
  pa: typeof pa;
  pv: typeof pv;
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
      pa,
      pv
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
      if (trimmed === 'import * as pv from "@/lib/pp/pp-event";') {
        return false;
      }
      if (trimmed === 'const pp = pa.pp;') {
        return false;
      }
      return true;
    })
    .join('\n');

const wrapExecutableCode = (code: string) =>
  `((pq, ps, pa, pv) => {\n${code}\n})(globalThis.pq, globalThis.ps, globalThis.pa, globalThis.pv);`;

const maxLogDepth = 5;
const maxLogEntries = 50;

const getConstructorName = (value: object) => {
  const constructor = (value as {constructor?: {name?: unknown}}).constructor;
  return typeof constructor?.name === 'string' ? constructor.name : null;
};

const serializeScriptRunValue = (
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): ScriptRunLogValue => {
  if (value === null) {
    return {kind: 'null'};
  }

  if (value === undefined) {
    return {kind: 'undefined'};
  }

  const valueType = typeof value;
  if (valueType === 'string') {
    return {kind: 'string', value: value as string};
  }
  if (valueType === 'number') {
    return {kind: 'number', value: value as number};
  }
  if (valueType === 'boolean') {
    return {kind: 'boolean', value: value as boolean};
  }
  if (valueType === 'bigint') {
    return {kind: 'bigint', value: String(value)};
  }
  if (valueType === 'symbol') {
    return {kind: 'symbol', value: value.toString()};
  }
  if (valueType === 'function') {
    return {kind: 'function', name: (value as {name?: string}).name || '(anonymous)'};
  }

  if (!(value instanceof Object)) {
    return {kind: 'string', value: String(value)};
  }

  if (seen.has(value)) {
    return {kind: 'circular'};
  }
  seen.add(value);

  if (value instanceof Date) {
    return {kind: 'date', value: Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()};
  }

  if (value instanceof RegExp) {
    return {kind: 'regexp', value: value.toString()};
  }

  if (value instanceof Error) {
    return {
      kind: 'error',
      name: value.name,
      message: value.message,
      stack: typeof value.stack === 'string' ? value.stack : null
    };
  }

  if (Array.isArray(value)) {
    if (depth >= maxLogDepth) {
      return {kind: 'array', items: [], truncated: value.length > 0};
    }

    const items = value
      .slice(0, maxLogEntries)
      .map((entry) => serializeScriptRunValue(entry, depth + 1, seen));
    return {
      kind: 'array',
      items,
      truncated: value.length > maxLogEntries
    };
  }

  const ownKeys = Reflect.ownKeys(value);
  const limitedKeys = ownKeys.slice(0, maxLogEntries);
  const constructorName = getConstructorName(value);

  if (depth >= maxLogDepth) {
    return {
      kind: 'object',
      constructorName,
      entries: [],
      truncated: limitedKeys.length > 0
    };
  }

  const entries = limitedKeys.map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    const normalizedKey = typeof key === 'symbol' ? key.toString() : key;
    if (!descriptor) {
      return {
        key: normalizedKey,
        value: {kind: 'undefined'} satisfies ScriptRunLogValue
      };
    }

    if ('value' in descriptor) {
      return {
        key: normalizedKey,
        value: serializeScriptRunValue(descriptor.value, depth + 1, seen)
      };
    }

    const descriptorKinds = [
      descriptor.get ? 'Getter' : null,
      descriptor.set ? 'Setter' : null
    ].filter((kind): kind is string => Boolean(kind));

    return {
      key: normalizedKey,
      value: {
        kind: 'accessor',
        description: `[${descriptorKinds.join('/')}]`
      } satisfies ScriptRunLogValue
    };
  });

  return {
    kind: 'object',
    constructorName,
    entries,
    truncated: ownKeys.length > maxLogEntries
  };
};

const createNotificationCapture = () => {
  const logs: ScriptRunLogEntry[] = [];
  const capture = (level: ScriptRunLogEntry['level'], values: unknown[]) => {
    logs.push({
      level,
      timestamp: Date.now(),
      values: values.map((value) => serializeScriptRunValue(value, 0, new WeakSet<object>()))
    });
  };

  const sink = (payload: {level: ScriptRunLogEntry['level']; values: unknown[]}) => {
    capture(payload.level, payload.values);
  };

  return {logs, sink};
};

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
    const {logs, sink} = createNotificationCapture();

    const onError = (errorEvent: ErrorEvent) => {
      respondOnce(
        requestId,
        buildScriptRunResponse(
          requestId,
          `Script execution failed: ${errorEvent.message || 'Unknown error.'}`,
          logs
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
          `Script execution failed: ${rawMessage}`,
          logs
        ),
        cleanupListeners,
        responded
      );
      rejection.preventDefault();
    };

    const cleanupListeners = () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      delete (globalThis as Record<string, unknown>)[pa.notificationSinkGlobalKey];
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    const modules = ensurePpModules();
    (globalThis as Record<string, unknown>).pq = modules.pq;
    (globalThis as Record<string, unknown>).ps = modules.ps;
    (globalThis as Record<string, unknown>).pa = modules.pa.createApi();
    (globalThis as Record<string, unknown>).pv = modules.pv;
    (globalThis as Record<string, unknown>)[modules.pa.notificationSinkGlobalKey] = sink;
    const executableCode = wrapExecutableCode(stripPpImportText(code));
    injectBlobScript(
      executableCode,
      () => {
        respondOnce(
          requestId,
          buildScriptRunResponse(requestId, null, logs),
          cleanupListeners,
          responded
        );
      },
      () => {
        respondOnce(
          requestId,
          buildScriptRunResponse(
            requestId,
            'Script execution blocked by the page Content Security Policy.',
            logs
          ),
          cleanupListeners,
          responded
        );
      }
    );
  });
});
