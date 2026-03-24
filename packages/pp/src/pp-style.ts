export type StyleValues = Record<string, string>;
export type StyleTarget = Element | Element[];

const psHashAttributeName = "data-ps-hash";

const hashCssString = (value: string) => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
};

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

export const injectCSS = (styleText: string) => {
  if (styleText.trim().length === 0) {
    return false;
  }

  const head = document.head;
  if (!head) {
    return false;
  }

  const hash = hashCssString(styleText);
  const existingStyle = head.querySelector(`style[${psHashAttributeName}="${hash}"]`);
  if (existingStyle) {
    return false;
  }

  const styleElement = document.createElement("style");
  styleElement.setAttribute(psHashAttributeName, hash);
  styleElement.textContent = styleText;
  head.appendChild(styleElement);

  return true;
};
