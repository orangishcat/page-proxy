export type StyleValues = Record<string, string>;
export type StyleTarget = Element | Element[];

export const applyStyle = (elements: StyleTarget, values: StyleValues) => {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return;
  }

  const targetElements = Array.isArray(elements) ? elements : [elements];

  targetElements.forEach((element) => {
    if (!("style" in element)) {
      throw new Error("Element has no style property");
    }

    const styledElement = element as HTMLElement | SVGElement;
    entries.forEach(([key, value]) => {
      if (value.includes("!important")) {
        styledElement.style.setProperty(key, value.replace("!important", ""), "important");
      } else {
        styledElement.style.setProperty(key, value);
      }
    });
  });
};
