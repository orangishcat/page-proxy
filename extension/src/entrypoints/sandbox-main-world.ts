import { lockdown } from "@endo/lockdown";
import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";

import {
  buildSandboxErrorResponse,
  isSandboxRequest,
  type SandboxEvaluateResponse,
  type SandboxResult,
  type SelectorEntry,
} from "@/lib/sandbox";
import * as pq from "@page-proxy/pp/pp-query";
import * as ps from "@page-proxy/pp/pp-style";
import * as pv from "@page-proxy/pp/pp-event";

type CompartmentConstructor = new (endowments?: Record<string, unknown>) => {
  evaluate: (code: string) => unknown;
  globalThis: unknown;
};

type LockdownOptions = {
  errorTaming?: "safe" | "unsafe" | "unsafe-guards";
  stackFiltering?: "concise" | "verbose";
  overrideTaming?: "severe" | "moderate" | "min";
};

const lockdownFn = lockdown as unknown as (options?: LockdownOptions) => void;
const lockdownMarkerKey = "__pageProxySesLockdown__";

const hasHarden = () => typeof (globalThis as { harden?: unknown }).harden === "function";

const hasLockdownMarker = () => (globalThis as Record<string, unknown>)[lockdownMarkerKey] === true;

const setLockdownMarker = () => {
  (globalThis as Record<string, unknown>)[lockdownMarkerKey] = true;
};

const initialLockdownReady = hasHarden() || hasLockdownMarker();
let lockdownReady = initialLockdownReady;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const readDataProperty = (value: Record<string, unknown>, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !("value" in descriptor)) {
    return undefined;
  }
  return descriptor.value as unknown;
};

const readString = (value: Record<string, unknown>, key: string) => {
  const data = readDataProperty(value, key);
  return typeof data === "string" ? data : null;
};

const readOptionalString = (
  value: Record<string, unknown>,
  key: string,
  errors: string[],
  label: string,
) => {
  const data = readDataProperty(value, key);
  if (data === undefined || data === null) {
    return null;
  }
  if (typeof data !== "string") {
    errors.push(`${label} must be a string when provided.`);
    return null;
  }
  return data;
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

  if (typeof lockdownFn !== "function") {
    errors.push("Sandbox initialization failed: lockdown is unavailable.");
    return false;
  }

  lockdownFn({
    errorTaming: "safe",
    stackFiltering: "concise",
    overrideTaming: "severe",
  });
  setLockdownMarker();
  lockdownReady = true;
  return true;
};

const getCompartmentConstructor = (): CompartmentConstructor | null => {
  const compartment = (
    globalThis as typeof globalThis & {
      Compartment?: CompartmentConstructor;
    }
  ).Compartment;

  return typeof compartment === "function" ? compartment : null;
};

const getHarden = () => {
  const harden = (
    globalThis as typeof globalThis & {
      harden?: (value: unknown) => unknown;
    }
  ).harden;

  return typeof harden === "function" ? harden : null;
};

const readMatchFunction = (
  value: Record<string, unknown>,
  errors: string[],
): ((element: Element) => boolean) | null => {
  const matchValue = readDataProperty(value, "matches");
  if (typeof matchValue !== "function") {
    errors.push("pq.selector requires a matches function.");
    return null;
  }

  return matchValue as (element: Element) => boolean;
};

const readPostMapFunction = (
  value: Record<string, unknown>,
  errors: string[],
): ((element: HTMLElement) => unknown) | undefined => {
  const postMapValue = readDataProperty(value, "postMap");
  if (postMapValue === undefined || postMapValue === null) {
    return undefined;
  }

  if (typeof postMapValue !== "function") {
    errors.push("pq.selector postMap must be a function when provided.");
    return undefined;
  }

  return postMapValue as (element: HTMLElement) => unknown;
};

const extractRuleKeysFromMatches = (matches: (element: Element) => boolean) => {
  const source = Function.prototype.toString.call(matches);
  const keys = new Set<string>();
  const propRegex = /(?:(?:pp|pq|pa)\.)?prop(?:Matches|Contains|Exists)\s*\(\s*[^,]+,\s*(['"`])([^'"`]+)\1/g;
  let match = propRegex.exec(source);

  while (match) {
    const key = match[2]?.trim();
    if (key) {
      keys.add(key);
    }
    match = propRegex.exec(source);
  }

  const specialRules: Array<{ key: string; pattern: RegExp }> = [
    { key: "tag", pattern: /(?:(?:pp|pq|pa)\.)?tagMatches\s*\(/ },
    { key: "selector", pattern: /(?:(?:pp|pq|pa)\.)?selectorMatches\s*\(/ },
    { key: "innerText", pattern: /(?:(?:pp|pq|pa)\.)?innerTextMatches\s*\(/ },
    { key: "bbox", pattern: /(?:(?:pp|pq|pa)\.)?bboxMatches\s*\(/ },
  ];

  specialRules.forEach((rule) => {
    if (rule.pattern.test(source)) {
      keys.add(rule.key);
    }
  });

  return Array.from(keys);
};

const extractSelectorRules = (baseSelector: string | undefined, matches: (element: Element) => boolean) => {
  const rules: string[] = [];
  const normalizedBaseSelector = baseSelector?.trim();
  if (normalizedBaseSelector && normalizedBaseSelector !== "*") {
    rules.push("baseSelector: " + normalizedBaseSelector);
  }

  const source = Function.prototype.toString.call(matches);
  const pqMethodCallRegex = /(?:\b(?:pq|pp))\.([A-Za-z_$][\w$]*)\s*\(/g;
  let methodMatch = pqMethodCallRegex.exec(source);

  while (methodMatch) {
    rules.push("pq." + methodMatch[1] + "()");
    methodMatch = pqMethodCallRegex.exec(source);
  }

  return rules;
};

const createSelectorEntry = (
  value: unknown,
  errors: string[],
): {
  entry: SelectorEntry;
  matches: (element: Element) => boolean;
  postMap?: (element: HTMLElement) => unknown;
  baseSelector?: string;
} | null => {
  if (!isRecord(value)) {
    errors.push("pq.selector expects an object definition.");
    return null;
  }

  const name = readString(value, "name")?.trim() || "Selector";
  const baseSelector = readOptionalString(value, "baseSelector", errors, "pq.selector baseSelector")?.trim() || undefined;
  const matches = readMatchFunction(value, errors);
  const postMap = readPostMapFunction(value, errors);
  if (!matches) {
    return null;
  }

  return {
    entry: {
      name,
      ruleKeys: extractRuleKeysFromMatches(matches),
      rules: extractSelectorRules(baseSelector, matches),
    },
    matches,
    postMap,
    baseSelector,
  };
};

const evaluateDefinitionBlock = (code: string): SandboxResult => {
  const errors: string[] = [];
  const elements: SandboxResult["elements"] = [];
  const selectors: SelectorEntry[] = [];

  if (!code.trim()) {
    return { elements, selectors, errors };
  }

  if (!ensureLockdown(errors)) {
    return { elements, selectors, errors };
  }

  const CompartmentCtor = getCompartmentConstructor();
  if (!CompartmentCtor) {
    errors.push("Sandbox initialization failed: Compartment is unavailable.");
    return { elements, selectors, errors };
  }

  const harden = getHarden();
  if (!harden) {
    errors.push("Sandbox initialization failed: harden is unavailable.");
    return { elements, selectors, errors };
  }

  const registerSelector = (definition: unknown) => {
    const result = createSelectorEntry(definition, errors);
    if (!result) {
      return harden({});
    }
    const { entry, matches, postMap } = result;
    selectors.push(entry);
    const resolvedSelector = pq.selector({
      name: entry.name,
      baseSelector: result.baseSelector,
      matches,
      postMap,
    });
    return harden({
      definition: entry,
      matches: (el: Element) => resolvedSelector.matches(el),
      onElementMatches: (
        func: (value: unknown) => void,
        targetNode?: Node,
        observerOptions?: MutationObserverInit,
      ) => resolvedSelector.onElementMatches(func, targetNode, observerOptions),
      query: () => resolvedSelector.query(),
      queryAll: () => resolvedSelector.queryAll(),
    });
  };

  const applyStyle = (elementsValue: unknown, values: unknown) => {
    if (!Array.isArray(elementsValue)) {
      errors.push("ps.applyStyle expects an array of elements.");
      return harden({});
    }

    if (!isRecord(values)) {
      errors.push("ps.applyStyle expects a style object with string values.");
      return harden({});
    }

    const entries = Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === "string");

    if (entries.length === 0) {
      errors.push("ps.applyStyle expects at least one style value.");
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

  const pageApi = harden({
    ...pv.createApi(),
  });

  const queryApi = harden({
    ...pq,
    selector: registerSelector,
  });

  const styleApi = harden({
    ...ps,
    applyStyle,
  });

  const eventApi = harden({
    ...pv,
  });

  const compartment = new CompartmentCtor({
    pa: pageApi,
    pq: queryApi,
    ps: styleApi,
    pv: eventApi,
    pp: pageApi,
  });
  harden(compartment.globalThis);
  compartment.evaluate(`'use strict';\n${code}`);

  return { elements, selectors, errors };
};

const getTargetOrigin = () => {
  if (window.location.origin === "null") {
    return "*";
  }

  return window.location.origin;
};

const buildErrorResponse = (requestId: string, message: string) => buildSandboxErrorResponse(requestId, message);
const isWindowSource = (source: MessageEventSource | null) => source === window || source === null;

const respondOnce = (
  requestId: string,
  response: SandboxEvaluateResponse,
  cleanup: () => void,
  responded: { value: boolean },
) => {
  if (responded.value) {
    return;
  }

  responded.value = true;
  cleanup();
  window.postMessage(response, getTargetOrigin());
};

export default defineUnlistedScript(() => {
  console.debug("[pp sandbox-main-world] initialized", {href: window.location.href});

  window.addEventListener("message", (event) => {
    if (!isWindowSource(event.source)) {
      return;
    }

    if (!isSandboxRequest(event.data)) {
      return;
    }

    const { requestId, code } = event.data;
    console.debug("[pp sandbox-main-world] request received", {requestId});
    const responded = { value: false };
    const errors: string[] = [];

    const onError = (errorEvent: ErrorEvent) => {
      const rawMessage = errorEvent.message || "Unknown error.";
      const message = rawMessage.includes("unsafe-eval")
        ? "Sandbox execution blocked by the page Content Security Policy (unsafe-eval is not allowed)."
        : rawMessage;
      errors.push(`Sandbox execution failed: ${message}`);
      errorEvent.preventDefault();
      respondOnce(requestId, buildErrorResponse(requestId, errors[0]), cleanupListeners, responded);
    };

    const onRejection = (rejection: PromiseRejectionEvent) => {
      const rawMessage = rejection.reason instanceof Error ? rejection.reason.message : "Unknown rejection.";
      const message = rawMessage.includes("unsafe-eval")
        ? "Sandbox execution blocked by the page Content Security Policy (unsafe-eval is not allowed)."
        : rawMessage;
      errors.push(`Sandbox execution failed: ${message}`);
      rejection.preventDefault();
      respondOnce(requestId, buildErrorResponse(requestId, errors[0]), cleanupListeners, responded);
    };

    const cleanupListeners = () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    const result = evaluateDefinitionBlock(code);
    console.debug("[pp sandbox-main-world] evaluation completed", {
      requestId,
      elementCount: result.elements.length,
      selectorCount: result.selectors.length,
      errorCount: result.errors.length
    });
    respondOnce(
      requestId,
      {
        type: "sandbox:result",
        requestId,
        elements: result.elements,
        selectors: result.selectors,
        errors: result.errors,
      },
      cleanupListeners,
      responded,
    );
  });
});
