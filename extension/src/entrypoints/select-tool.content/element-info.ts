import { hoverClass, selectedClass, hoveredPreviewClass } from "@/lib/constants/selection";
import type { ElementInfo } from "@/lib/selection";
import { generateElementSelector } from "./popup/selector";

const filteredSelectionClasses = new Set([hoverClass, selectedClass, hoveredPreviewClass]);

export const filterSelectionClasses = (value: string | null): string | null => {
  if (!value) return null;
  const tokens = value
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !filteredSelectionClasses.has(t));
  return tokens.length > 0 ? tokens.join(" ") : null;
};

export const getElementInfo = (element: Element): ElementInfo => {
  const rect = element.getBoundingClientRect();
  const innerText = element instanceof HTMLElement ? element.innerText.trim() : "";
  const attributes = Object.fromEntries(
    Array.from(element.attributes)
      .map((attr) => {
        if (attr.name === "class") {
          const filtered = filterSelectionClasses(attr.value);
          return filtered ? ([attr.name, filtered] as const) : null;
        }
        return [attr.name, attr.value] as const;
      })
      .filter((e): e is readonly [string, string] => e !== null),
  );
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    name: element.getAttribute("name") ?? element.getAttribute("aria-label") ?? null,
    className: filterSelectionClasses(element.getAttribute("class")),
    innerText: innerText.length > 0 && innerText.length < 500 ? innerText : null,
    selector: generateElementSelector(element),
    attributes,
    boundingBox: { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height },
  };
};

export const describeElementCompact = (element: Element | null): string => {
  if (!element) return "none";
  const id = element.id ? `#${element.id}` : "";
  const classes = Array.from(element.classList)
    .filter((t) => t.length > 0 && !filteredSelectionClasses.has(t))
    .slice(0, 2)
    .join(".");
  return `${element.tagName.toLowerCase()}${id}${classes ? `.${classes}` : ""}`;
};

export const getEventTarget = (event: Event): Element | null => {
  for (const target of event.composedPath()) if (target instanceof Element) return target;
  return event.target instanceof Element ? event.target : null;
};
