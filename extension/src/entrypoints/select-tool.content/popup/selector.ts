import { cssSelectorGenerator } from "css-selector-generator";

const selectorFallback = "body";
const selectorMatchLimitDefault = 10;
const selectorBlacklist = [".pp-hover", ".pp-selected", ".pp-hovered", ".pp-no-select-tool", ".pp-*", /\[style(?:[~|^$*]?=)?/i];
type SelectorGeneratorOptions = NonNullable<Parameters<typeof cssSelectorGenerator>[1]>;

const normalizeSelector = (value: string) => value.trim().replace(/\s+/g, " ");

const supportsSelector = (value: string) => {
  if (!value) {
    return false;
  }
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return true;
  }
  return CSS.supports(`selector(${value})`);
};

const buildPathSegment = (element: Element) => {
  const parent = element.parentElement;
  let segment = element.tagName.toLowerCase();

  if (!parent) {
    return segment;
  }

  const siblingsWithSameTag = Array.from(parent.children).filter(
    (candidate) => candidate instanceof Element && candidate.tagName === element.tagName,
  );
  if (siblingsWithSameTag.length <= 1) {
    return segment;
  }

  const index = siblingsWithSameTag.indexOf(element);
  if (index >= 0) {
    segment += `:nth-of-type(${index + 1})`;
  }
  return segment;
};

export const buildDeterministicSelectorPath = (element: Element) => {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current) {
    segments.unshift(buildPathSegment(current));
    if (current.tagName.toLowerCase() === "body") {
      break;
    }
    current = current.parentElement;
  }

  return normalizeSelector(segments.join(" > "));
};

const normalizeSelectorCandidate = (value: string) => {
  const normalized = normalizeSelector(value);
  if (!supportsSelector(normalized)) {
    return null;
  }
  return normalized;
};

const createSelectorGeneratorOptions = (maxResults: number): SelectorGeneratorOptions => {
  return {
    blacklist: selectorBlacklist,
    combineWithinSelector: true,
    combineBetweenSelectors: true,
    includeTag: true,
    maxResults,
  };
};

const getGeneratedSelectors = (element: Element, maxResults: number) => {
  const cappedResults = Math.max(1, Math.floor(maxResults));
  const selectors = new Set<string>();

  for (const selector of cssSelectorGenerator(element, createSelectorGeneratorOptions(cappedResults))) {
    const normalized = normalizeSelectorCandidate(selector);
    if (!normalized || normalized.includes(".pp-")) {
      continue;
    }

    selectors.add(normalized);
    if (selectors.size >= cappedResults) {
      break;
    }
  }

  return Array.from(selectors);
};

export const getSelectorFallback = () => selectorFallback;

export const generateElementSelector = (element: Element) => {
  if (!element.isConnected) {
    return buildDeterministicSelectorPath(element) || selectorFallback;
  }

  const generatedSelectors = getGeneratedSelectors(element, 1);
  if (generatedSelectors[0]) {
    return generatedSelectors[0];
  }

  const deterministicPath = normalizeSelectorCandidate(buildDeterministicSelectorPath(element));
  if (deterministicPath) {
    return deterministicPath;
  }

  return selectorFallback;
};

export const generateElementSelectorMatches = (element: Element, maxResults = selectorMatchLimitDefault) => {
  const cappedResults = Math.max(1, Math.floor(maxResults));

  if (!element.isConnected) {
    const fallback = normalizeSelectorCandidate(buildDeterministicSelectorPath(element));
    return fallback ? [fallback] : [selectorFallback];
  }

  const selectors = getGeneratedSelectors(element, cappedResults * 4);
  if (selectors.length === 0) {
    return [generateElementSelector(element)];
  }

  return selectors.slice(0, cappedResults);
};

export const buildSelectorTemplateCode = (selectorValue: string) => {
  return [
    "const Style_1 = pq.selector({",
    `  ${JSON.stringify("name")}: ${JSON.stringify("Style 1")},`,
    `  ${JSON.stringify("baseSelector")}: ${JSON.stringify(selectorValue)},`,
    `  ${JSON.stringify("matches")}: e => true,`,
    "});",
  ].join("\n");
};
