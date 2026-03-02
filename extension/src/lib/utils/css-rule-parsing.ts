const maxSelectorRules = 24;

export const normalizeCssSelectorText = (value: string) => value.trim().replace(/\s+/g, " ");

export const normalizeSelector = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export const parseCssRuleBlocks = (css: string): Array<{ selector: string; declarations: string }> => {
  const blocks: Array<{ selector: string; declarations: string }> = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = rulePattern.exec(css)) !== null) {
    const selector = match[1].trim();
    const declarations = match[2].trim();
    if (selector) blocks.push({ selector, declarations });
  }
  return blocks;
};

export const buildCssBlock = (selector: string, declarations: string) =>
  declarations ? `${selector} {\n  ${declarations.replace(/\n/g, "\n  ")}\n}` : `${selector} {}`;

export const extractCssSelectorsFromStyleText = (styleText: string): string[] => {
  const seen = new Set<string>();
  const results: string[] = [];
  const selectorGroupPattern = /([^{}]+)\{/g;

  for (const match of styleText.matchAll(selectorGroupPattern)) {
    if (results.length >= maxSelectorRules) break;
    const selectorGroup = match[1]?.trim() ?? "";
    if (!selectorGroup || selectorGroup.startsWith("@")) continue;
    const normalized = normalizeCssSelectorText(selectorGroup);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    results.push(normalized);
  }

  return results;
};

export const extractCssBlockForSelector = (code: string, selectorName: string): string | null => {
  const injectPattern = /ps\.injectCSS\s*\(\s*`([\s\S]*?)`\s*\)/g;
  let match;
  while ((match = injectPattern.exec(code)) !== null) {
    const blocks = parseCssRuleBlocks(match[1]);
    const matchingBlock = blocks.find(
      (b) => normalizeSelector(b.selector) === normalizeSelector(selectorName),
    );
    if (matchingBlock) return buildCssBlock(matchingBlock.selector, matchingBlock.declarations);
  }
  return null;
};
