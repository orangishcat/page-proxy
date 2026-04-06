import { onElementCreated } from "../pp-event";

export type SelectorDefinition<T = HTMLElement> = {
  name: string;
  baseSelector?: string;
  matches: (element: Element) => boolean;
  postMap?: (element: HTMLElement) => T;
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
        let observer: ReturnType<typeof onElementCreated> | null = null;
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
