export type ElementSize = {
  width: number;
  height: number;
};

export type ElementDefinition = {
  name?: string;
  selector: string;
  bbox: ElementSize & { x: number; y: number };
  attributes?: Record<string, string>;
};

export type ElementLookupError = "empty-selectors" | "invalid-size" | "invalid-selectors" | "not-found";

export type ElementLookupResult = {
  element: Element | null;
  error: ElementLookupError | null;
};

const isPositiveFinite = (value: number) => Number.isFinite(value) && value > 0;

const normalizeSelectors = (selectors: string | string[]) =>
  (Array.isArray(selectors) ? selectors : [selectors])
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0);

const selectorSupportAvailable =
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("selector(*)");

const isValidSelector = (selector: string) => {
  if (!selector) {
    return false;
  }
  if (!selectorSupportAvailable) {
    return true;
  }
  return CSS.supports(`selector(${selector})`);
};

const resolveElement = (definition: ElementDefinition): ElementLookupResult => {
  const selectorList = normalizeSelectors(definition.selector);
  if (selectorList.length === 0) {
    return { element: null, error: "empty-selectors" };
  }
  if (!isPositiveFinite(definition.bbox.width) || !isPositiveFinite(definition.bbox.height)) {
    return { element: null, error: "invalid-size" };
  }

  const validSelectors = selectorList.filter(isValidSelector);
  if (validSelectors.length === 0) {
    return { element: null, error: "invalid-selectors" };
  }

  const candidates = validSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  if (candidates.length === 0) {
    return { element: null, error: "not-found" };
  }

  const target =
    candidates.find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width >= definition.bbox.width && rect.height >= definition.bbox.height;
    }) ?? candidates[0];

  return { element: target, error: null };
};

export const element = (definition: ElementDefinition) => ({
  definition,
  resolve: () => resolveElement(definition),
});

export type SelectorDefinition = {
  name: string;
  baseSelector?: string;
  matches: (element: Element) => boolean;
  bbox?: ElementSize & { x: number; y: number };
};

const selectionClassesToIgnore = new Set(["pp-hover", "pp-selected"]);

const filterSelectionClasses = (value: string | null) => {
  if (!value) {
    return null;
  }

  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !selectionClassesToIgnore.has(token));

  return tokens.length > 0 ? tokens.join(" ") : null;
};

const getBoundingBox = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x + window.scrollX,
    y: rect.y + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
};

const formatBoundingBoxCompact = (box: ElementSize & { x: number; y: number }) =>
  `${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${box.width.toFixed(2)}, ${box.height.toFixed(2)}`;

const getElementPropertyValue = (element: Element, key: string): string | null => {
  switch (key) {
    case "tag":
      return element.tagName.toLowerCase();
    case "id":
      return element.id || null;
    case "class":
      return filterSelectionClasses(element.getAttribute("class"));
    case "name":
      return element.getAttribute("name") ?? element.getAttribute("aria-label");
    case "innerText":
      if (element instanceof HTMLElement) {
        const text = element.innerText.trim();
        return text.length > 0 ? text : null;
      }
      return null;
    case "bbox":
      return formatBoundingBoxCompact(getBoundingBox(element));
    default:
      return element.getAttribute(key);
  }
};

const hasElementProperty = (element: Element, key: string) => {
  switch (key) {
    case "tag":
    case "selector":
    case "bbox":
      return true;
    case "id":
      return element.id.length > 0;
    case "class":
      return Boolean(filterSelectionClasses(element.getAttribute("class")));
    case "name":
      return Boolean(element.getAttribute("name") ?? element.getAttribute("aria-label"));
    case "innerText":
      return element instanceof HTMLElement && element.innerText.trim().length > 0;
    default:
      return element.hasAttribute(key);
  }
};

const isValidMatchSelector = (selector: string) => {
  if (!selector) {
    return false;
  }

  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return false;
  }

  return CSS.supports(`selector(${selector})`);
};

const matchesSelector = (element: Element, selector: string) => {
  if (!isValidMatchSelector(selector)) {
    return false;
  }

  return element.matches(selector);
};

const isBoundingBox = (value: unknown): value is ElementSize & { x: number; y: number } =>
  Boolean(
    value &&
    typeof value === "object" &&
    Number.isFinite((value as { x?: unknown }).x) &&
    Number.isFinite((value as { y?: unknown }).y) &&
    Number.isFinite((value as { width?: unknown }).width) &&
    Number.isFinite((value as { height?: unknown }).height),
  );

const normalizeTag = (value: string) => value.trim().toLowerCase();

export const tagMatches = (element: Element, tag: string) => {
  const expectedTag = normalizeTag(tag);
  if (!expectedTag) {
    return false;
  }

  return element.tagName.toLowerCase() === expectedTag;
};

export const selectorMatches = (element: Element, selector: string) => matchesSelector(element, selector);

export const innerTextMatches = (element: Element, matcher: RegExp | string) => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const text = element.innerText.trim();
  if (!text) {
    return false;
  }

  if (matcher instanceof RegExp) {
    const normalizedFlags = matcher.flags.replace("g", "");
    const normalizedMatcher = new RegExp(matcher.source, normalizedFlags);
    return normalizedMatcher.test(text);
  }

  return matcher.length > 0 && text.includes(matcher);
};

export const bboxMatches = (element: Element, expectedBox: ElementSize & { x: number; y: number }, tolerance = 0) => {
  if (!isBoundingBox(expectedBox) || !Number.isFinite(tolerance) || tolerance < 0) {
    return false;
  }

  const currentBox = getBoundingBox(element);
  return (
    Math.abs(currentBox.x - expectedBox.x) <= tolerance &&
    Math.abs(currentBox.y - expectedBox.y) <= tolerance &&
    Math.abs(currentBox.width - expectedBox.width) <= tolerance &&
    Math.abs(currentBox.height - expectedBox.height) <= tolerance
  );
};

export const propMatches = (element: Element, key: string, value: string) => {
  const propertyValue = getElementPropertyValue(element, key);
  return propertyValue === value;
};

export const propContains = (element: Element, key: string, value: string) => {
  const propertyValue = getElementPropertyValue(element, key);
  return Boolean(propertyValue && propertyValue.includes(value));
};

export const propExists = (element: Element, key: string) => hasElementProperty(element, key);

export const selector = (definition: SelectorDefinition) => ({
  definition,
  apply: () => null,
  query: () => {
    const normalizedBaseSelector = definition.baseSelector?.trim() ?? "";
    const baseSelector =
      normalizedBaseSelector.length > 0 && isValidSelector(normalizedBaseSelector) ? normalizedBaseSelector : "*";
    const elements = Array.from(document.querySelectorAll(baseSelector));
    if (elements.length === 0) {
      return [];
    }

    return elements.filter((candidate) => Boolean(definition.matches(candidate)));
  },
});
