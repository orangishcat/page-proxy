export type ElementSize = {
  width: number;
  height: number;
};

export type ElementDefinition = {
  name?: string;
  selector: string;
  bbox: ElementSize & {x: number; y: number};
  attributes?: Record<string, string>;
};

export type ElementLookupError =
  | 'empty-selectors'
  | 'invalid-size'
  | 'invalid-selectors'
  | 'not-found';

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
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('selector(*)');

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
    return {element: null, error: 'empty-selectors'};
  }
  if (
    !isPositiveFinite(definition.bbox.width) ||
    !isPositiveFinite(definition.bbox.height)
  ) {
    return {element: null, error: 'invalid-size'};
  }

  const validSelectors = selectorList.filter(isValidSelector);
  if (validSelectors.length === 0) {
    return {element: null, error: 'invalid-selectors'};
  }

  const candidates = validSelectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector))
  );
  if (candidates.length === 0) {
    return {element: null, error: 'not-found'};
  }

  const target =
    candidates.find((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.width >= definition.bbox.width && rect.height >= definition.bbox.height
      );
    }) ?? candidates[0];

  return {element: target, error: null};
};

export const element = (definition: ElementDefinition) => ({
  definition,
  resolve: () => resolveElement(definition)
});

export type StyleDefinition = {
  name: string;
  selector: string;
  properties: Record<string, string>;
  bbox?: ElementSize & {x: number; y: number};
};

export const style = (definition: StyleDefinition) => ({
  definition,
  apply: () => null
});

export const pp = {
  element,
  style
};

export const pageModificationFunctions = ['pp'];
