const normalizeTag = (value: string) => value.trim().toLowerCase();

export const tagMatches = (element: Element, tag: string) => {
  const expectedTag = normalizeTag(tag);
  if (!expectedTag) {
    return false;
  }

  return element.tagName.toLowerCase() === expectedTag;
};
