/**
 * Evaluates the current selection and returns the selected element and its selector.
 * @param {boolean} selectParent - Whether to select the parent element if no child is selected.
 * @returns {{ ok: boolean; element?: HTMLElement; selector?: string }}
 * Do not edit the function syntax; this is imported as a raw string.
 */
export default function (selectParent) {
  const hoverClass = "pp-hover";
  const selectedClass = "pp-selected";
  const hoveredPreviewClass = "pp-hovered";
  const filteredSelectionClasses = new Set([hoverClass, selectedClass, hoveredPreviewClass]);

  const filterSelectionClasses = (value) => {
    if (!value) {
      return null;
    }

    const tokens = value
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0 && !filteredSelectionClasses.has(token));
    return tokens.length > 0 ? tokens.join(" ") : null;
  };

  const escapeSelector = (value) => {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }

    return value.replace(/[^a-zA-Z0-9_-]/g, (token) => `\\${token}`);
  };

  const getElementSelector = (element) => {
    if (element.id) {
      return `#${escapeSelector(element.id)}`;
    }

    const segments = [];
    let current = element;
    while (current && segments.length < 4) {
      let segment = current.tagName.toLowerCase();
      const classList = Array.from(current.classList)
        .filter((token) => token && !filteredSelectionClasses.has(token))
        .slice(0, 2);
      if (classList.length > 0) {
        segment += `.${classList.map(escapeSelector).join(".")}`;
      }

      const parent = current.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(
          (child) => child instanceof Element && child.tagName === current.tagName,
        );
        if (sameTag.length > 1) {
          segment += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
        }
      }

      segments.unshift(segment);
      if (current.tagName.toLowerCase() === "body") {
        break;
      }

      current = current.parentElement;
    }

    return segments.join(" > ");
  };

  const getElementInfo = (element) => {
    const rect = element.getBoundingClientRect();
    const innerText = element instanceof HTMLElement ? element.innerText.trim() : "";
    const attributes = Object.fromEntries(
      Array.from(element.attributes)
        .map((attribute) => {
          if (attribute.name === "class") {
            const filteredClassName = filterSelectionClasses(attribute.value);
            return filteredClassName ? [attribute.name, filteredClassName] : null;
          }

          return [attribute.name, attribute.value];
        })
        .filter((entry) => entry !== null),
    );

    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      name: element.getAttribute("name") ?? element.getAttribute("aria-label") ?? null,
      className: filterSelectionClasses(element.getAttribute("class")),
      innerText: innerText.length > 0 && innerText.length < 500 ? innerText : null,
      selector: getElementSelector(element),
      attributes,
      boundingBox: {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      },
    };
  };

  try {
    let target = $0 instanceof Element ? $0 : null;
    if (selectParent) {
      target = target?.parentElement ?? null;
      if (target) {
        inspect(target);
      }
    }

    if (!target) {
      return {
        ok: true,
        selection: null,
      };
    }

    return {
      ok: true,
      selection: {
        info: getElementInfo(target),
        frameId: null,
        frameUrl: window.location.href,
        updatedAt: Date.now(),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      selection: null,
      error: message,
    };
  }
}
