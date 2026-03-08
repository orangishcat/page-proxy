export type SelectorPreviewState = {
  matchingElements: Element[];
  error: string | null;
};

const isValidSelector = (selector: string): boolean => {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
};

export const getSelectorPreviewState = (
  selector: string,
  excludedAncestorSelector = ".pp-no-select-tool",
): SelectorPreviewState => {
  const normalizedSelector = selector.trim();
  if (!normalizedSelector) {
    return { matchingElements: [], error: "CSS selector is invalid." };
  }

  if (!isValidSelector(normalizedSelector)) {
    return { matchingElements: [], error: "CSS selector is invalid." };
  }

  const matchingElements = Array.from(document.querySelectorAll(normalizedSelector)).filter(
    (element) => !element.closest(excludedAncestorSelector),
  );

  if (matchingElements.length === 0) {
    return { matchingElements, error: "Selector does not match any elements" };
  }

  return { matchingElements, error: null };
};
