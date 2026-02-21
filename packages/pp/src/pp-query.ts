import { onElementCreated } from "./pp-event";

export type ElementSize = {
  width: number;
  height: number;
};

export type SelectorDefinition<T = HTMLElement> = {
  name: string;
  baseSelector?: string;
  matches: (element: Element) => boolean;
  postMap?: (element: HTMLElement) => T;
};

export type TraverseParentsOptions<T = HTMLElement> = {
  postMap?: (element: HTMLElement) => T;
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

const matchesSelector = (element: Element, selector: string) => {
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

const getOwnText = (element: Element) =>
  Array.from(element.childNodes)
    .filter((node): node is Text => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join("")
    .trim();

export const innerTextMatches = (element: Element, matcher: RegExp | string) => {
  const text = getOwnText(element);
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

export const bboxMatches = (element: Element, expectedBox: ElementSize & { x: number; y: number }, tolerance = 75) => {
  if (!isBoundingBox(expectedBox) || !Number.isFinite(tolerance) || tolerance < 0) {
    return false;
  }

  const currentBox = getBoundingBox(element);
  const expectedRight = expectedBox.x + expectedBox.width;
  const expectedBottom = expectedBox.y + expectedBox.height;
  const currentRight = currentBox.x + currentBox.width;
  const currentBottom = currentBox.y + currentBox.height;

  return (
    Math.abs(currentBox.x - expectedBox.x) <= tolerance &&
    Math.abs(currentBox.y - expectedBox.y) <= tolerance &&
    Math.abs(currentRight - expectedRight) <= tolerance &&
    Math.abs(currentBottom - expectedBottom) <= tolerance
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

export const traverseParents = <T = HTMLElement>(
  el: Element,
  matcher: (element: HTMLElement) => boolean,
  options: TraverseParentsOptions<T> = {},
): T | null => {
  const postMap: (element: HTMLElement) => T = options.postMap ?? ((element: HTMLElement) => element as T);
  let current = el.parentElement;

  while (current) {
    if (current instanceof HTMLElement && matcher(current)) {
      return postMap(current);
    }
    current = current.parentElement;
  }

  return null;
};

export const selector = <T = HTMLElement>(definition: SelectorDefinition<T>) => {
  const matchesElement = (el: Element) => {
    const normalizedBaseSelector = definition.baseSelector?.trim() ?? "";
    const baseSelector = normalizedBaseSelector.length > 0 ? normalizedBaseSelector : "*";
    if (baseSelector !== "*" && !el.matches(baseSelector)) {
      return false;
    }
    return Boolean(definition.matches(el));
  };

  const defaultObserverOptions: MutationObserverInit = { childList: true, subtree: true };

  const mapMatchingElement = (el: Element): T => {
    if (!definition.postMap) {
      return el as T;
    }
    return definition.postMap(el as HTMLElement);
  };

  return {
    definition,
    matches: (el: Element) => matchesElement(el),
    onElementMatches: (
      func: (value: T) => void,
      targetNode: Node = document.body ?? document.documentElement,
      observerOptions: MutationObserverInit = { childList: true, subtree: true },
    ) =>
      onElementCreated((el) => {
        if (matchesElement(el)) {
          func(mapMatchingElement(el));
        }
      }, targetNode, observerOptions),
    query: (): T | null => {
      const normalizedBaseSelector = definition.baseSelector?.trim() ?? "";
      const baseSelector = normalizedBaseSelector.length > 0 ? normalizedBaseSelector : "*";
      const elements = document.querySelectorAll(baseSelector);
      for (const candidate of elements) {
        if (matchesElement(candidate)) {
          return mapMatchingElement(candidate);
        }
      }
      return null;
    },
    queryAll: (): T[] => {
      const normalizedBaseSelector = definition.baseSelector?.trim() ?? "";
      const baseSelector = normalizedBaseSelector.length > 0 ? normalizedBaseSelector : "*";
      const elements = Array.from(document.querySelectorAll(baseSelector));
      if (elements.length === 0) {
        return [];
      }

      return elements.filter((candidate) => matchesElement(candidate)).map((candidate) => mapMatchingElement(candidate));
    },
    waitUntilMatch: (
      targetNode: Node = document.body ?? document.documentElement,
      observerOptions: MutationObserverInit = defaultObserverOptions,
    ): Promise<T> => {
      const immediateMatch = (() => {
        const normalizedBaseSelector = definition.baseSelector?.trim() ?? "";
        const baseSelector = normalizedBaseSelector.length > 0 ? normalizedBaseSelector : "*";
        const elements = document.querySelectorAll(baseSelector);
        for (const candidate of elements) {
          if (matchesElement(candidate)) {
            return candidate;
          }
        }
        return null;
      })();

      if (immediateMatch) {
        return Promise.resolve(mapMatchingElement(immediateMatch));
      }

      return new Promise<T>((resolve) => {
        let observer: MutationObserver | null = null;
        let resolved = false;

        const resolveWithMatch = (element: Element) => {
          if (resolved) {
            return;
          }
          resolved = true;
          observer?.disconnect();
          resolve(mapMatchingElement(element));
        };

        observer = onElementCreated(
          (element) => {
            if (!matchesElement(element)) {
              return;
            }
            resolveWithMatch(element);
          },
          targetNode,
          observerOptions,
        );

        if (resolved) {
          observer.disconnect();
        }
      });
    },
  };
};
