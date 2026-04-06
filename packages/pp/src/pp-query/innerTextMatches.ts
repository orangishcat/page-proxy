const getOwnText = (element: Element) =>
  Array.from(element.childNodes)
    .filter((node): node is Text => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join("")
    .trim();

export const innerTextMatches = (element: Element, matcher: RegExp | string) => {
  const text = getOwnText(element);
  if (!text) {
    return false;
  }

  if (matcher instanceof RegExp) {
    const normalizedFlags = matcher.flags.replace("g", "");
    const normalizedMatcher = new RegExp(matcher.source, normalizedFlags);
    return normalizedMatcher.test(text);
  }

  return matcher.length > 0 && text.includes(matcher);
};
