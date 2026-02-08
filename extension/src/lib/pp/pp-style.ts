export type StyleValues = Record<string, string>;

export const applyStyle = (elements: Element[], values: StyleValues) => {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return;
  }

  elements.forEach((element) => {
    if (!('style' in element)) {
      return;
    }

    const styledElement = element as HTMLElement | SVGElement;
    entries.forEach(([key, value]) => {
      styledElement.style.setProperty(key, value);
    });
  });
};
