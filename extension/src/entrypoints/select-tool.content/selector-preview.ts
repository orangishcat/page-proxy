const selectorRulePrefixPattern = /^(?:selector|baseSelector):\s*(.+)$/i;

const normalizeCssSelector = (value: string): string => value.trim().replace(/\s+/g, " ");

export const toPreviewCssSelectors = (selectorName: string, rules: string[]): string[] => {
  const candidates: string[] = [selectorName];
  rules.forEach((rule) => {
    const match = rule.match(selectorRulePrefixPattern);
    if (match?.[1]) candidates.push(match[1]);
  });

  const uniqueSelectors = new Set<string>();
  candidates.forEach((candidate) => {
    const normalized = normalizeCssSelector(candidate);
    if (!normalized) return;
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return;
    if (!CSS.supports(`selector(${normalized})`)) return;
    uniqueSelectors.add(normalized);
  });

  return Array.from(uniqueSelectors);
};
