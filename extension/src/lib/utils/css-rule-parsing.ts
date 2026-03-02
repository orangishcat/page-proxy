import * as css from "css-tree";

const maxSelectorRules = 24;

export const normalizeCssSelectorText = (value: string) => value.trim().replace(/\s+/g, " ");

export const normalizeSelector = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export const parseCssRuleBlocks = (text: string): Array<{ selector: string; declarations: string }> => {
  const ast = css.parse(text, { positions: true });
  const blocks: Array<{ selector: string; declarations: string }> = [];

  if (ast.type !== "StyleSheet") return blocks;

  ast.children.forEach((node) => {
    if (node.type !== "Rule" || !node.loc || !node.prelude.loc || !node.block.loc) return;
    const selector = text.slice(node.prelude.loc.start.offset, node.prelude.loc.end.offset).trim();
    const declarations = text.slice(node.block.loc.start.offset + 1, node.block.loc.end.offset - 1).trim();
    if (selector) blocks.push({ selector, declarations });
  });

  return blocks;
};

export const buildCssBlock = (selector: string, declarations: string) =>
  declarations ? `${selector} {\n  ${declarations.replace(/\n/g, "\n  ")}\n}` : `${selector} {}`;

export const extractCssSelectorsFromStyleText = (styleText: string): string[] => {
  const seen = new Set<string>();
  const results: string[] = [];
  const ast = css.parse(styleText, { positions: true });

  css.walk(ast, {
    visit: "Rule",
    enter(node) {
      if (results.length >= maxSelectorRules || !node.prelude.loc) return;
      const selectorText = styleText.slice(node.prelude.loc.start.offset, node.prelude.loc.end.offset).trim();
      const normalized = normalizeCssSelectorText(selectorText);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      results.push(normalized);
    },
  });

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
