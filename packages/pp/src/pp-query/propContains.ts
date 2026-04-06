import { getElementPropertyValue } from "./_helpers";

export const propContains = (element: Element, key: string, value: string) => {
  const propertyValue = getElementPropertyValue(element, key);
  return Boolean(propertyValue && propertyValue.includes(value));
};
