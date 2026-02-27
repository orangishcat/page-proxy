import { cssSelectorGenerator, getCssSelector } from "css-selector-generator";

const selectorFallback = "body";
const selectorMatchLimitDefault = 10;
const selectorBlacklist = [".pp-hover", ".pp-selected", ".pp-hovered", ".pp-no-select-tool", ".pp-*"];

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

const createSelectorGeneratorOptions = (element: Element) => {
  const selectorRoot =
    element.ownerDocument?.documentElement ?? document.documentElement ?? element.ownerDocument?.body ?? null;

  return {
    ...(selectorRoot ? { root: selectorRoot } : {}),
    blacklist: selectorBlacklist,
  };
};

export const getSelectorFallback = () => selectorFallback;

export const generateElementSelector = (element: Element) => {
  if (!element.isConnected) {
    return buildDeterministicSelectorPath(element) || selectorFallback;
  }

  const generated = normalizeSelectorCandidate(getCssSelector(element, createSelectorGeneratorOptions(element)));
  if (generated) {
    return generated;
  }

  const deterministicPath = normalizeSelectorCandidate(buildDeterministicSelectorPath(element));
  if (deterministicPath) {
    return deterministicPath;
  }

  return selectorFallback;
};

export const generateElementSelectorMatches = (element: Element, maxResults = selectorMatchLimitDefault) => {
  const cappedResults = Math.max(1, Math.floor(maxResults));
  const selectors = new Set<string>();

  if (!element.isConnected) {
    const fallback = normalizeSelectorCandidate(buildDeterministicSelectorPath(element));
    return fallback ? [fallback] : [selectorFallback];
  }

  const options = {
    ...createSelectorGeneratorOptions(element),
    maxResults: cappedResults,
  };

  for (const selector of cssSelectorGenerator(element, options)) {
    const normalized = normalizeSelectorCandidate(selector);
    if (!normalized) {
      continue;
    }

    if (normalized.includes(".pp-")) {
      continue;
    }

    selectors.add(normalized);
    if (selectors.size >= cappedResults) {
      break;
    }
  }

  if (selectors.size === 0) {
    selectors.add(generateElementSelector(element));
  }

  return Array.from(selectors).slice(0, cappedResults);
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
