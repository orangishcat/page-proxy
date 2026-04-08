export const transparentDragImage = (() => {
  if (typeof Image === "undefined") {
    return null;
  }

  const image = new Image();
  image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  return image;
})();

const needsDirectAppend = (snippet: string) => /^[.#[:]/.test(snippet);

export const appendSelectorSnippet = (baseValue: string, snippetValue: string) => {
  const base = baseValue.trim();
  const normalizedSnippet = snippetValue === " " ? " " : snippetValue.trim();

  if (!normalizedSnippet && snippetValue !== " ") {
    return base;
  }
  if (!base) {
    return normalizedSnippet;
  }
  if (normalizedSnippet === " ") {
    return `${base} `;
  }
  if (
    normalizedSnippet === "," ||
    normalizedSnippet === ">" ||
    normalizedSnippet === "+" ||
    normalizedSnippet === "~"
  ) {
    return `${base} ${normalizedSnippet} `;
  }
  if (base.endsWith(",") || base.endsWith(">") || base.endsWith("+") || base.endsWith("~")) {
    return `${base} ${normalizedSnippet}`;
  }
  if (needsDirectAppend(normalizedSnippet)) {
    return `${base}${normalizedSnippet}`;
  }
  return `${base} ${normalizedSnippet}`;
};

export const findNearestWordBreak = (text: string, offset: number) => {
  const breakChars = new Set([".", ",", " "]);
  const candidates = [0, text.length];

  for (let index = 0; index < text.length; index += 1) {
    if (breakChars.has(text[index])) {
      candidates.push(index, index + 1);
    }
  }

  let best = candidates[0] ?? 0;
  let bestDistance = Math.abs(offset - best);

  for (const candidate of candidates) {
    const distance = Math.abs(offset - candidate);
    if (distance < bestDistance || (distance === bestDistance && candidate > best)) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
};

export const buildDroppedFilterInsertText = (documentText: string, insertOffset: number, code: string) => {
  let nextIndex = insertOffset;
  while (nextIndex < documentText.length && /\s/.test(documentText[nextIndex])) {
    nextIndex += 1;
  }

  if (documentText[nextIndex] === "=" && documentText[nextIndex + 1] === ">") {
    return code;
  }

  let previousIndex = insertOffset - 1;
  while (previousIndex >= 0 && /\s/.test(documentText[previousIndex])) {
    previousIndex -= 1;
  }

  if (previousIndex < 0) {
    return code;
  }

  const previous = documentText[previousIndex];
  const secondPrevious = previousIndex > 0 ? documentText[previousIndex - 1] : "";
  const isLogicalAnd = secondPrevious === "&" && previous === "&";
  const isLogicalOr = secondPrevious === "|" && previous === "|";
  if (isLogicalAnd || isLogicalOr) {
    return code;
  }

  const matchLine = documentText.match(/^(\s*)["']matches["']\s*:/m);
  const matchIndent = matchLine?.[1] ?? "";
  return `\n${matchIndent}  && ${code}`;
};

export const truncatePropertyValue = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}...` : value;
