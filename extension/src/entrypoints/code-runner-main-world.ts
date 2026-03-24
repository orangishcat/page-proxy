import {defineUnlistedScript} from 'wxt/utils/define-unlisted-script';

import {
  buildScriptRunResponse,
  isScriptRunRequest,
  type ScriptRunLogEntry,
  type ScriptRunLogValue,
  type ScriptRunSelectorEntry,
  type ScriptRunResponse
} from '@/lib/script-runner';
import {pa, pn, pq, ps, pt, pv} from '@page-proxy/pp';
import { extractCssSelectorsFromStyleText } from '@/lib/utils/css-rule-parsing';

type PpModuleBindings = {
  pa: typeof pa;
  pn: typeof pn;
  pq: typeof pq;
  ps: typeof ps;
  pt: typeof pt;
  pv: typeof pv;
};

type WindowWithPpModules = typeof window & {
  __pageProxyPpModules__?: PpModuleBindings;
};

const ensurePpModules = (): PpModuleBindings => {
  const target = window as WindowWithPpModules;
  if (!target.__pageProxyPpModules__) {
    target.__pageProxyPpModules__ = {
      pa,
      pn,
      pq,
      ps,
      pt,
      pv
    };
  }

  return target.__pageProxyPpModules__;
};

const globalBindingsLine = 'const { pa, pn, pq, ps, pt, pv, pp } = globalThis;';
const ppImportLinePattern = /^import\s*\{[^}]+\}\s*from\s*["']@page-proxy\/pp["'];?$/;

const shouldReplaceWithGlobalBindings = (line: string) => {
  const trimmed = line.trim();
  if (trimmed === 'import * as pq from "@page-proxy/pp/pp-query";') {
    return true;
  }
  if (trimmed === 'import * as ps from "@page-proxy/pp/pp-style";') {
    return true;
  }
  if (ppImportLinePattern.test(trimmed)) {
    return true;
  }
  if (trimmed === 'import * as pa from "@page-proxy/pp/pp-api";') {
    return true;
  }
  if (trimmed === 'import * as pn from "@page-proxy/pp/pp-network";') {
    return true;
  }
  if (trimmed === 'import * as pt from "@page-proxy/pp/pp-storage";') {
    return true;
  }
  if (trimmed === 'import * as pv from "@page-proxy/pp/pp-event";') {
    return true;
  }
  if (trimmed === 'const pp = pa.pp;' || trimmed === 'const pp = pv.pp;') {
    return true;
  }
  return false;
};

const replacePpImportsWithGlobalBindings = (code: string) => {
  const lines = code.split('\n');
  let replacedAny = false;
  const replacedLines = lines.map((line) => {
    if (!shouldReplaceWithGlobalBindings(line)) {
      return line;
    }

    if (!replacedAny) {
      replacedAny = true;
      return globalBindingsLine;
    }

    // Keep line numbers stable even when multiple import variants exist.
    return '';
  });

  if (!replacedAny) {
    if (replacedLines.length === 0) {
      return globalBindingsLine;
    }

    replacedLines[0] = `${globalBindingsLine} ${replacedLines[0]}`;
  }

  return replacedLines.join('\n');
};

const maxLogDepth = 5;
const maxLogEntries = 50;
const maxSelectorRules = 24;
const blobSourcePattern = /blob:[^\s)]+/g;

const replaceBlobSources = (value: string) =>
  value.replace(blobSourcePattern, (sourceRef) => {
    const locationSuffixMatch = sourceRef.match(/(:\d+(?::\d+)?)$/);
    const locationSuffix = locationSuffixMatch ? locationSuffixMatch[1] : "";
    return `<script>${locationSuffix}`;
  });

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
      stack: typeof value.stack === 'string' ? replaceBlobSources(value.stack) : null
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
    return replaceBlobSources(error.message);
  }
  return replaceBlobSources(String(error));
};

const toExecutionErrorStack = (error: unknown) => {
  if (error instanceof Error && typeof error.stack === 'string') {
    return replaceBlobSources(error.stack);
  }

  if (typeof error === 'object' && error !== null && 'stack' in error) {
    const stack = (error as {stack?: unknown}).stack;
    return typeof stack === 'string' ? replaceBlobSources(stack) : null;
  }

  return null;
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
    rules,
    mode: 'pp-api'
  };
};


const toCssSelectorEntry = (name: string, selectors: string[]): ScriptRunSelectorEntry => {
  const rules = selectors.length > 0 ? selectors.map((selector) => `selector: ${selector}`) : ['css'];
  return {
    name,
    ruleKeys: rules,
    rules,
    mode: 'css'
  };
};

const runScriptCode = (code: string) => {
  const executableCode = replacePpImportsWithGlobalBindings(code);
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

const metadataBlockPattern = /\/\/\s*==\s*Page\s*Proxy\s*==([\s\S]*?)\/\/\s*==\s*\/\s*Page\s*Proxy\s*==/m;

const extractMetadataField = (metadataBlock: string, field: string) => {
  const match = metadataBlock.match(new RegExp(`^\\/\\/\\s*@${field}(?:\\s*:?\\s*)(.*)$`, 'm'));
  return match?.[1]?.trim() ?? '';
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

const buildScriptStorageScope = (code: string) => {
  const metadataBlock = code.match(metadataBlockPattern)?.[1] ?? '';
  const title = extractMetadataField(metadataBlock, 'title');
  const website = extractMetadataField(metadataBlock, 'website');
  const metadataIdentity = [title, website].filter((value) => value.length > 0).join('::');
  if (metadataIdentity.length > 0) {
    return `meta-${hashString(metadataIdentity)}`;
  }

  return `code-${hashString(code)}`;
};

const runScriptRequest = (
  requestId: string,
  code: string,
  sendResult: (response: ScriptRunResponse) => void
) => {
  const {logs, sink} = createNotificationCapture();
  const selectorEntries = new Map<string, ScriptRunSelectorEntry>();
  let cssEntryCount = 0;
  const storageScope = buildScriptStorageScope(code);
  const modules = ensurePpModules();
  const pageStorageApi = modules.pt.createStorage(storageScope);
  const pageNetworkApi = modules.pn.createNetwork(storageScope);
  let notificationSinkKey = modules.pa.notificationSinkGlobalKey;
  let hasResponded = false;
  const queryApi = {
    ...modules.pq,
    selector: <T = HTMLElement>(definition: pq.SelectorDefinition<T>) => {
      const entry = toSelectorEntry(definition);
      selectorEntries.set(`pp-api:${entry.name}`, entry);
      return modules.pq.selector(definition);
    }
  } satisfies typeof pq;
  const styleApi = {
    ...modules.ps,
    injectCSS: (styleText: string, options?: ps.InjectCssOptions) => {
      cssEntryCount += 1;
      const selectors = extractCssSelectorsFromStyleText(styleText);
      const entryName = selectors[0] ? `CSS ${cssEntryCount}: ${selectors[0]}` : `CSS ${cssEntryCount}`;
      const entry: ScriptRunSelectorEntry = { ...toCssSelectorEntry(entryName, selectors), cssText: styleText };
      selectorEntries.set(`css:${entryName}`, entry);
      return modules.ps.injectCSS(styleText, options);
    }
  } satisfies typeof ps;

  const cleanup = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    delete (globalThis as Record<string, unknown>)[notificationSinkKey];
  };

  const respond = (error: string | null, errorStack: string | null = null) => {
    if (hasResponded) {
      return;
    }

    hasResponded = true;
    cleanup();
    sendResult(buildScriptRunResponse(requestId, error, logs, Array.from(selectorEntries.values()), errorStack));
  };

  const onError = (errorEvent: ErrorEvent) => {
    const errorMessage =
      errorEvent.message || toExecutionErrorMessage(errorEvent.error) || 'Unknown error.';
    respond(`Script execution failed: ${errorMessage}`, toExecutionErrorStack(errorEvent.error));
  };

  const onRejection = (rejection: PromiseRejectionEvent) => {
    respond(
      `Script execution failed: ${toExecutionErrorMessage(rejection.reason)}`,
      toExecutionErrorStack(rejection.reason)
    );
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  notificationSinkKey = modules.pa.notificationSinkGlobalKey;
  (globalThis as Record<string, unknown>).pa = modules.pa;
  (globalThis as Record<string, unknown>).pn = pageNetworkApi;
  (globalThis as Record<string, unknown>).pq = queryApi;
  (globalThis as Record<string, unknown>).ps = styleApi;
  (globalThis as Record<string, unknown>).pt = pageStorageApi;
  (globalThis as Record<string, unknown>).pv = modules.pv;
  (globalThis as Record<string, unknown>).pp = modules.pa.pp;
  (globalThis as Record<string, unknown>)[modules.pt.scriptStorageScopeGlobalKey] = storageScope;
  (globalThis as Record<string, unknown>)[notificationSinkKey] = sink;

  void runScriptCode(code)
    .then(() => {
      respond(null);
    })
    .catch((error: unknown) => {
      respond(`Script execution failed: ${toExecutionErrorMessage(error)}`, toExecutionErrorStack(error));
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
