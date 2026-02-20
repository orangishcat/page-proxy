import type { CssSelectorPart } from "../css-inspector";

const nthOfTypePattern = /:nth-of-type\(\s*[^)]*\s*\)/gi;

export const hasNthOfTypeRule = (parts: CssSelectorPart[]) => {
  return parts.some((part) => part.type === "pseudo" && /^:nth-of-type\(/i.test(part.text));
};

export const removeNthOfTypeFromSelectorSource = (selectorSource: string) => {
  if (!nthOfTypePattern.test(selectorSource)) {
    return null;
  }

  nthOfTypePattern.lastIndex = 0;
  return selectorSource.replace(nthOfTypePattern, "");
};
