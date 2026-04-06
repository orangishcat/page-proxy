const selectionClassesToIgnore = new Set(["pp-hover", "pp-selected"]);

export const filterSelectionClasses = (value: string | null) => {
  if (!value) {
    return null;
  }

  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !selectionClassesToIgnore.has(token));

  return tokens.length > 0 ? tokens.join(" ") : null;
};

export const getBoundingBox = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x + window.scrollX,
    y: rect.y + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
};

export const formatBoundingBoxCompact = (box: { x: number; y: number; width: number; height: number }) =>
  `${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${box.width.toFixed(2)}, ${box.height.toFixed(2)}`;

export const getElementPropertyValue = (element: Element, key: string): string | null => {
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

export const hasElementProperty = (element: Element, key: string) => {
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
