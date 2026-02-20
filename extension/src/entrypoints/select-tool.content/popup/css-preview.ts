export type SelectorPreviewState = {
  matchingElements: Element[];
  error: string | null;
};

export const getSelectorPreviewState = (selector: string, excludedAncestorSelector = ".pp-no-select-tool"): SelectorPreviewState => {
  const normalizedSelector = selector.trim();
  if (!normalizedSelector) {
    return { matchingElements: [], error: "CSS selector is invalid." };
  }

  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return { matchingElements: [], error: "CSS selector is invalid." };
  }

  if (!CSS.supports(`selector(${normalizedSelector})`)) {
    return { matchingElements: [], error: "CSS selector is invalid." };
  }

  const matchingElements = Array.from(document.querySelectorAll(normalizedSelector)).filter(
    (element) => !element.closest(excludedAncestorSelector),
  );

  if (matchingElements.length === 0) {
    return { matchingElements, error: "CSS selector matches no elements." };
  }

  return { matchingElements, error: null };
};
