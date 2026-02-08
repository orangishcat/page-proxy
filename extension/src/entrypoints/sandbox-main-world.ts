import {lockdown} from '@endo/lockdown';
import {defineUnlistedScript} from 'wxt/utils/define-unlisted-script';

import {
  buildSandboxErrorResponse,
  isSandboxRequest,
  type BoundingBox,
  type ElementEntry,
  type SandboxEvaluateResponse,
  type SandboxResult,
  type SelectorEntry
} from '@/lib/sandbox';
import * as pq from '@/lib/pp/pp-query';
import * as ps from '@/lib/pp/pp-style';
import * as pa from '@/lib/pp/pp-api';

type CompartmentConstructor = new (
  endowments?: Record<string, unknown>
) => {
  evaluate: (code: string) => unknown;
  globalThis: unknown;
};

type LockdownOptions = {
  errorTaming?: 'safe' | 'unsafe' | 'unsafe-guards';
  stackFiltering?: 'concise' | 'verbose';
  overrideTaming?: 'severe' | 'moderate' | 'min';
};

const lockdownFn = lockdown as unknown as (options?: LockdownOptions) => void;
const lockdownMarkerKey = '__pageProxySesLockdown__';

const hasHarden = () =>
  typeof (globalThis as {harden?: unknown}).harden === 'function';

const hasLockdownMarker = () =>
  (globalThis as Record<string, unknown>)[lockdownMarkerKey] === true;

const setLockdownMarker = () => {
  (globalThis as Record<string, unknown>)[lockdownMarkerKey] = true;
};

const initialLockdownReady = hasHarden() || hasLockdownMarker();
let lockdownReady = initialLockdownReady;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readDataProperty = (
  value: Record<string, unknown>,
  key: string
): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) {
    return undefined;
  }
  return descriptor.value as unknown;
};

const readString = (value: Record<string, unknown>, key: string) => {
  const data = readDataProperty(value, key);
  return typeof data === 'string' ? data : null;
};

const readNumber = (value: Record<string, unknown>, key: string) => {
  const data = readDataProperty(value, key);
  return typeof data === 'number' && Number.isFinite(data) ? data : null;
};

const parseBoundingBox = (
  value: unknown,
  errors: string[],
  label: string,
  required: boolean
): BoundingBox | null => {
  if (value === undefined || value === null) {
    if (required) {
      errors.push(`${label} must include a bbox with x, y, width, and height.`);
    }
    return null;
  }

  if (!isRecord(value)) {
    errors.push(`${label} bbox must be an object with x, y, width, and height.`);
    return null;
  }

  const x = readNumber(value, 'x');
  const y = readNumber(value, 'y');
  const width = readNumber(value, 'width');
  const height = readNumber(value, 'height');

  if (x === null || y === null || width === null || height === null) {
    errors.push(`${label} bbox must include numeric x, y, width, and height.`);
    return null;
  }

  return {x, y, width, height};
};

const sanitizeStringMap = (
  value: unknown,
  errors: string[],
  label: string
): Record<string, string> => {
  if (!isRecord(value)) {
    return {};
  }

  const result = Object.create(null) as Record<string, string>;
  Object.keys(value).forEach((key) => {
    const entry = Object.getOwnPropertyDescriptor(value, key);
    if (!entry || !('value' in entry)) {
      errors.push(`${label} "${key}" must be a data property.`);
      return;
    }
    if (typeof entry.value !== 'string') {
      errors.push(`${label} "${key}" must be a string.`);
      return;
    }
    result[key] = entry.value;
  });

  return result;
};

const ensureLockdown = (errors: string[]) => {
  if (lockdownReady) {
    return true;
  }

  if (hasHarden() || hasLockdownMarker()) {
    setLockdownMarker();
    lockdownReady = true;
    return true;
  }

  if (typeof lockdownFn !== 'function') {
    errors.push('Sandbox initialization failed: lockdown is unavailable.');
    return false;
  }

  lockdownFn({
    errorTaming: 'safe',
    stackFiltering: 'concise',
    overrideTaming: 'severe'
  });
  setLockdownMarker();
  lockdownReady = true;
  return true;
};

const getCompartmentConstructor = (): CompartmentConstructor | null => {
  const compartment = (globalThis as typeof globalThis & {
    Compartment?: CompartmentConstructor;
  }).Compartment;

  return typeof compartment === 'function' ? compartment : null;
};

const getHarden = () => {
  const harden = (globalThis as typeof globalThis & {
    harden?: (value: unknown) => unknown;
  }).harden;

  return typeof harden === 'function' ? harden : null;
};

const createElementEntry = (value: unknown, errors: string[]): ElementEntry | null => {
  if (!isRecord(value)) {
    errors.push('pp.element expects an object definition.');
    return null;
  }

  const selector = readString(value, 'selector');
  if (!selector) {
    errors.push('pp.element requires a string selector.');
    return null;
  }

  const name = readString(value, 'name')?.trim() || 'Element';
  const bbox = parseBoundingBox(
    readDataProperty(value, 'bbox'),
    errors,
    'pp.element',
    true
  );

  if (!bbox) {
    return null;
  }

  const attributes = sanitizeStringMap(
    readDataProperty(value, 'attributes'),
    errors,
    'pp.element attribute'
  );

  return {name, selector, bbox, attributes};
};

const readMatchFunction = (
  value: Record<string, unknown>,
  errors: string[]
): ((element: Element) => boolean) | null => {
  const matchValue = readDataProperty(value, 'matches');
  if (typeof matchValue !== 'function') {
    errors.push('pp.selector requires a matches function.');
    return null;
  }

  return matchValue as (element: Element) => boolean;
};

const extractRuleKeysFromMatches = (matches: (element: Element) => boolean) => {
  const source = Function.prototype.toString.call(matches);
  const regex =
    /(?:pp\.)?prop(?:Matches|Contains|Exists)\s*\(\s*[^,]+,\s*(['"`])([^'"`]+)\1/g;
  const keys = new Set<string>();
  let match = regex.exec(source);

  while (match) {
    const key = match[2]?.trim();
    if (key) {
      keys.add(key);
    }
    match = regex.exec(source);
  }

  return Array.from(keys);
};

const createSelectorEntry = (
  value: unknown,
  errors: string[]
): {entry: SelectorEntry; matches: (element: Element) => boolean} | null => {
  if (!isRecord(value)) {
    errors.push('pp.selector expects an object definition.');
    return null;
  }

  const name = readString(value, 'name')?.trim() || 'Selector';
  const bbox = parseBoundingBox(
    readDataProperty(value, 'bbox'),
    errors,
    'pp.selector',
    false
  );
  const matches = readMatchFunction(value, errors);
  if (!matches) {
    return null;
  }

  return {
    entry: {
      name,
      bbox: bbox ?? undefined,
      ruleKeys: extractRuleKeysFromMatches(matches)
    },
    matches
  };
};

const evaluateDefinitionBlock = (code: string): SandboxResult => {
  const errors: string[] = [];
  const elements: ElementEntry[] = [];
  const selectors: SelectorEntry[] = [];

  if (!code.trim()) {
    return {elements, selectors, errors};
  }

  if (!ensureLockdown(errors)) {
    return {elements, selectors, errors};
  }

  const CompartmentCtor = getCompartmentConstructor();
  if (!CompartmentCtor) {
    errors.push('Sandbox initialization failed: Compartment is unavailable.');
    return {elements, selectors, errors};
  }

  const harden = getHarden();
  if (!harden) {
    errors.push('Sandbox initialization failed: harden is unavailable.');
    return {elements, selectors, errors};
  }

  const registerElement = (definition: unknown) => {
    const entry = createElementEntry(definition, errors);
    if (entry) {
      elements.push(entry);
    }
    return entry ? harden({definition: entry}) : harden({});
  };

  const registerSelector = (definition: unknown) => {
    const result = createSelectorEntry(definition, errors);
    if (!result) {
      return harden({});
    }
    const {entry, matches} = result;
    selectors.push(entry);
    return harden({
      definition: entry,
      query: () =>
        pq.selector({
          name: entry.name,
          bbox: entry.bbox,
          matches
        }).query()
    });
  };

  const applyStyle = (elementsValue: unknown, values: unknown) => {
    if (!Array.isArray(elementsValue)) {
      errors.push('pp.applyStyle expects an array of elements.');
      return harden({});
    }

    if (!isRecord(values)) {
      errors.push('pp.applyStyle expects a style object with string values.');
      return harden({});
    }

    const entries = Object.entries(values).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    );

    if (entries.length === 0) {
      errors.push('pp.applyStyle expects at least one style value.');
      return harden({});
    }

    const styleValues = Object.fromEntries(entries);
    const styledElements: Element[] = [];
    elementsValue.forEach((element) => {
      if (element instanceof Element) {
        styledElements.push(element);
      }
    });
    ps.applyStyle(styledElements, styleValues);

    return harden({});
  };

  const sandboxApi = harden({
    ...pa.createApi(),
    element: registerElement,
    selector: registerSelector,
    applyStyle
  });

  const compartment = new CompartmentCtor({pp: sandboxApi});
  harden(compartment.globalThis);
  compartment.evaluate(`'use strict';\n${code}`);

  return {elements, selectors, errors};
};

const getTargetOrigin = () => {
  if (window.location.origin === 'null') {
    return '*';
  }

  return window.location.origin;
};

const buildErrorResponse = (requestId: string, message: string) =>
  buildSandboxErrorResponse(requestId, message);

const respondOnce = (
  requestId: string,
  response: SandboxEvaluateResponse,
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

export default defineUnlistedScript(() => {
  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    if (!isSandboxRequest(event.data)) {
      return;
    }

    const {requestId, code} = event.data;
    const responded = {value: false};
    const errors: string[] = [];

    const onError = (errorEvent: ErrorEvent) => {
      const rawMessage = errorEvent.message || 'Unknown error.';
      const message = rawMessage.includes('unsafe-eval')
        ? 'Sandbox execution blocked by the page Content Security Policy (unsafe-eval is not allowed).'
        : rawMessage;
      errors.push(`Sandbox execution failed: ${message}`);
      errorEvent.preventDefault();
      respondOnce(
        requestId,
        buildErrorResponse(requestId, errors[0]),
        cleanupListeners,
        responded
      );
    };

    const onRejection = (rejection: PromiseRejectionEvent) => {
      const rawMessage =
        rejection.reason instanceof Error
          ? rejection.reason.message
          : 'Unknown rejection.';
      const message = rawMessage.includes('unsafe-eval')
        ? 'Sandbox execution blocked by the page Content Security Policy (unsafe-eval is not allowed).'
        : rawMessage;
      errors.push(`Sandbox execution failed: ${message}`);
      rejection.preventDefault();
      respondOnce(
        requestId,
        buildErrorResponse(requestId, errors[0]),
        cleanupListeners,
        responded
      );
    };

    const cleanupListeners = () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    const result = evaluateDefinitionBlock(code);
    respondOnce(
      requestId,
      {
        type: 'sandbox:result',
        requestId,
        elements: result.elements,
        selectors: result.selectors,
        errors: result.errors
      },
      cleanupListeners,
      responded
    );
  });
});
