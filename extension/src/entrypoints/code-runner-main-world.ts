import {defineUnlistedScript} from 'wxt/utils/define-unlisted-script';

import {
  buildScriptRunResponse,
  isScriptRunRequest,
  type ScriptRunLogEntry,
  type ScriptRunLogValue,
  type ScriptRunSelectorEntry,
  type ScriptRunResponse
} from '@/lib/script-runner';
import * as pq from '@page-proxy/pp/pp-query';
import * as ps from '@page-proxy/pp/pp-style';
import * as pv from '@page-proxy/pp/pp-event';

type PpModuleBindings = {
  pq: typeof pq;
  ps: typeof ps;
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
      if (trimmed === 'import * as pq from "@page-proxy/pp/pp-query";') {
        return false;
      }
      if (trimmed === 'import * as ps from "@page-proxy/pp/pp-style";') {
        return false;
      }
      if (trimmed === 'import * as pa from "@page-proxy/pp/pp-api";') {
        return false;
      }
      if (trimmed === 'import * as pv from "@page-proxy/pp/pp-event";') {
        return false;
      }
      if (trimmed === 'const pp = pa.pp;' || trimmed === 'const pp = pv.pp;') {
        return false;
      }
      return true;
    })
    .join('\n');

const wrapExecutableCode = (code: string) =>
  [
    'const pq = globalThis.pq;',
    'const ps = globalThis.ps;',
    'const pv = globalThis.pv;',
    'const pa = globalThis.pa;',
    'const pp = globalThis.pp;',
    code
  ].join('\n');

const maxLogDepth = 5;
const maxLogEntries = 50;
const maxSelectorRules = 24;

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

  if (typeof value === 'string') {
    return {kind: 'string', value};
  }
  if (typeof value === 'number') {
    return {kind: 'number', value};
  }
  if (typeof value === 'boolean') {
    return {kind: 'boolean', value};
  }
  if (typeof value === 'bigint') {
    return {kind: 'bigint', value: value.toString()};
  }
  if (typeof value === 'symbol') {
    const description = value.description;
    return {kind: 'symbol', value: description === undefined ? 'Symbol()' : `Symbol(${description})`};
  }
  if (typeof value === 'function') {
    return {kind: 'function', name: (value as {name?: string}).name || '(anonymous)'};
  }

  if (!(value instanceof Object)) {
    return {kind: 'string', value: ''};
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

const toExecutionErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
};

const normalizeRuleText = (value: string) => value.replace(/\s+/g, ' ').trim();

const getRuleValues = (source: string, pattern: RegExp) =>
  Array.from(source.matchAll(pattern))
    .map((match) => normalizeRuleText(match[1] ?? ''))
    .filter((value) => value.length > 0);

const extractSelectorRules = (definition: pq.SelectorDefinition<unknown>): string[] => {
  const uniqueRules = new Set<string>();
  const pushRule = (rule: string) => {
    const normalizedRule = normalizeRuleText(rule);
    if (!normalizedRule || uniqueRules.size >= maxSelectorRules) {
      return;
    }

    uniqueRules.add(normalizedRule);
  };

  const normalizedBaseSelector = definition.baseSelector?.trim() ?? '';
  if (normalizedBaseSelector) {
    pushRule(`baseSelector: ${normalizedBaseSelector}`);
  }

  const matchesSource = typeof definition.matches === 'function' ? definition.matches.toString() : '';
  getRuleValues(matchesSource, /pq\.(?:propMatches|propContains|propExists)\s*\([^,]+,\s*['"`]([^'"`]+)['"`]/g).forEach(
    (propertyKey) => pushRule(propertyKey)
  );
  getRuleValues(matchesSource, /pq\.tagMatches\s*\([^,]+,\s*['"`]([^'"`]+)['"`]/g).forEach((tag) =>
    pushRule(`tag: ${tag}`)
  );
  getRuleValues(matchesSource, /pq\.selectorMatches\s*\([^,]+,\s*['"`]([^'"`]+)['"`]/g).forEach((selectorText) =>
    pushRule(`selector: ${selectorText}`)
  );

  if (matchesSource.includes('pq.bboxMatches(')) {
    pushRule('bbox');
  }

  if (matchesSource.includes('pq.innerTextMatches(')) {
    pushRule('innerText');
  }

  if (uniqueRules.size === 0) {
    pushRule('matches');
  }

  return Array.from(uniqueRules);
};

const toSelectorEntry = (definition: pq.SelectorDefinition<unknown>): ScriptRunSelectorEntry => {
  const name = definition.name?.trim() || 'Unnamed selector';
  const rules = extractSelectorRules(definition);

  return {
    name,
    ruleKeys: rules,
    rules
  };
};

const runScriptCode = (code: string) => {
  const executableCode = wrapExecutableCode(stripPpImportText(code));
  const blob = new Blob([executableCode], {type: 'text/javascript'});
  const blobUrl = URL.createObjectURL(blob);

  return import(/* @vite-ignore */ blobUrl)
    .then(() => {
      URL.revokeObjectURL(blobUrl);
    })
    .catch((error: unknown) => {
      URL.revokeObjectURL(blobUrl);
      throw error;
    });
};

const getTargetOrigin = () => {
  if (window.location.origin === 'null') {
    return '*';
  }

  return window.location.origin;
};

const isWindowSource = (source: MessageEventSource | null) => source === window || source === null;

const runScriptRequest = (
  requestId: string,
  code: string,
  sendResult: (response: ScriptRunResponse) => void
) => {
  const {logs, sink} = createNotificationCapture();
  const selectorsByName = new Map<string, ScriptRunSelectorEntry>();
  const modules = ensurePpModules();
  let notificationSinkKey = modules.pv.notificationSinkGlobalKey;
  const pageApi = modules.pv.createApi();
  let hasResponded = false;
  const queryApi = {
    ...modules.pq,
    selector: <T = HTMLElement>(definition: pq.SelectorDefinition<T>) => {
      const entry = toSelectorEntry(definition);
      selectorsByName.set(entry.name, entry);
      return modules.pq.selector(definition);
    }
  } satisfies typeof pq;

  const cleanup = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    delete (globalThis as Record<string, unknown>)[notificationSinkKey];
  };

  const respond = (error: string | null) => {
    if (hasResponded) {
      return;
    }

    hasResponded = true;
    cleanup();
    sendResult(buildScriptRunResponse(requestId, error, logs, Array.from(selectorsByName.values())));
  };

  const onError = (errorEvent: ErrorEvent) => {
    respond(`Script execution failed: ${errorEvent.message || 'Unknown error.'}`);
    errorEvent.preventDefault();
  };

  const onRejection = (rejection: PromiseRejectionEvent) => {
    respond(`Script execution failed: ${toExecutionErrorMessage(rejection.reason)}`);
    rejection.preventDefault();
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  notificationSinkKey = modules.pv.notificationSinkGlobalKey;
  (globalThis as Record<string, unknown>).pq = queryApi;
  (globalThis as Record<string, unknown>).ps = modules.ps;
  (globalThis as Record<string, unknown>).pv = modules.pv;
  (globalThis as Record<string, unknown>).pa = pageApi;
  (globalThis as Record<string, unknown>).pp = pageApi;
  (globalThis as Record<string, unknown>)[notificationSinkKey] = sink;

  void runScriptCode(code)
    .then(() => {
      respond(null);
    })
    .catch((error: unknown) => {
      respond(`Script execution failed: ${toExecutionErrorMessage(error)}`);
    });
};

export default defineUnlistedScript(() => {
  window.addEventListener('message', (event) => {
    if (!isWindowSource(event.source)) {
      return;
    }

    if (!isScriptRunRequest(event.data)) {
      return;
    }

    runScriptRequest(event.data.requestId, event.data.code, (response) => {
      window.postMessage(response, getTargetOrigin());
    });
  });
});
