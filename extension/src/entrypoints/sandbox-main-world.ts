import {lockdown} from '@endo/lockdown';
import {defineUnlistedScript} from 'wxt/utils/define-unlisted-script';

import {
  buildSandboxErrorResponse,
  isSandboxRequest,
  type BoundingBox,
  type ElementEntry,
  type SandboxEvaluateResponse,
  type SandboxResult,
  type StyleEntry
} from '@/lib/sandbox';

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
const initialLockdownReady =
  typeof (globalThis as {harden?: unknown}).harden === 'function';
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

  if (typeof lockdownFn !== 'function') {
    errors.push('Sandbox initialization failed: lockdown is unavailable.');
    return false;
  }

  lockdownFn({
    errorTaming: 'safe',
    stackFiltering: 'concise',
    overrideTaming: 'severe'
  });
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

const createStyleEntry = (value: unknown, errors: string[]): StyleEntry | null => {
  if (!isRecord(value)) {
    errors.push('pp.style expects an object definition.');
    return null;
  }

  const selector = readString(value, 'selector');
  if (!selector) {
    errors.push('pp.style requires a string selector.');
    return null;
  }

  const name = readString(value, 'name')?.trim() || 'Style';
  const bbox = parseBoundingBox(
    readDataProperty(value, 'bbox'),
    errors,
    'pp.style',
    false
  );
  const properties = sanitizeStringMap(
    readDataProperty(value, 'properties'),
    errors,
    'pp.style property'
  );

  return {name, selector, bbox: bbox ?? undefined, properties};
};

const evaluateDefinitionBlock = (code: string): SandboxResult => {
  const errors: string[] = [];
  const elements: ElementEntry[] = [];
  const styles: StyleEntry[] = [];

  if (!code.trim()) {
    return {elements, styles, errors};
  }

  if (!ensureLockdown(errors)) {
    return {elements, styles, errors};
  }

  const CompartmentCtor = getCompartmentConstructor();
  if (!CompartmentCtor) {
    errors.push('Sandbox initialization failed: Compartment is unavailable.');
    return {elements, styles, errors};
  }

  const harden = getHarden();
  if (!harden) {
    errors.push('Sandbox initialization failed: harden is unavailable.');
    return {elements, styles, errors};
  }

  const registerElement = (definition: unknown) => {
    const entry = createElementEntry(definition, errors);
    if (entry) {
      elements.push(entry);
    }
    return entry ? harden({definition: entry}) : harden({});
  };

  const registerStyle = (definition: unknown) => {
    const entry = createStyleEntry(definition, errors);
    if (entry) {
      styles.push(entry);
    }
    return entry ? harden({definition: entry}) : harden({});
  };

  const sandboxApi = harden({
    element: registerElement,
    style: registerStyle
  });

  const compartment = new CompartmentCtor({pp: sandboxApi});
  harden(compartment.globalThis);
  compartment.evaluate(`'use strict';\n${code}`);

  return {elements, styles, errors};
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
        styles: result.styles,
        errors: result.errors
      },
      cleanupListeners,
      responded
    );
  });
});
