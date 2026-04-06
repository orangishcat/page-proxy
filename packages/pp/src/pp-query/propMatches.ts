import { getElementPropertyValue } from "./_helpers";

export const propMatches = (element: Element, key: string, value: string) => {
  const propertyValue = getElementPropertyValue(element, key);
  return propertyValue === value;
};
