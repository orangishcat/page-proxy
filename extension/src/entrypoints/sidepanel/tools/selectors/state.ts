import {derived} from 'svelte/store';
import {selectorEntries} from '../code-editor/state';
import { buildCssBlock, normalizeSelector, parseCssRuleBlocks } from '@/lib/utils/css-rule-parsing';

export type SelectorsToolEntry = {
  key: string;
  name: string;
  ruleCount: number;
  rules: string[];
  mode: "pp-api" | "css";
  cssText?: string;
};

export const selectorEntriesDisplay = derived(selectorEntries, (entries): SelectorsToolEntry[] =>
  entries.flatMap((entry, index) => {
    const rules = Array.isArray(entry.rules) ? entry.rules : entry.ruleKeys.map((key) => key);
    const mode = entry.mode === "css" ? "css" : "pp-api";

    if (mode === "css" && rules.length > 1) {
      const blocks = entry.cssText ? parseCssRuleBlocks(entry.cssText) : [];
      return rules.map((rule, ruleIndex) => {
        const selectorName = rule.replace(/^selector:\s*/i, "").trim() || rule;
        const matchingBlock = blocks.find(
          (b) => normalizeSelector(b.selector) === normalizeSelector(selectorName)
        );
        const cssText = matchingBlock
          ? buildCssBlock(matchingBlock.selector, matchingBlock.declarations)
          : entry.cssText;
        return {
          key: `${mode}:${entry.name}:${index}:${ruleIndex}`,
          name: selectorName,
          ruleCount: 1,
          rules: [rule],
          mode,
          cssText,
        } satisfies SelectorsToolEntry;
      });
    }

    if (mode === "css" && rules.length === 1) {
      const rule = rules[0];
      const selectorName = rule.replace(/^selector:\s*/i, "").trim() || entry.name;
      const blocks = entry.cssText ? parseCssRuleBlocks(entry.cssText) : [];
      const matchingBlock = blocks.find(
        (b) => normalizeSelector(b.selector) === normalizeSelector(selectorName)
      );
      const cssText = matchingBlock
        ? buildCssBlock(matchingBlock.selector, matchingBlock.declarations)
        : entry.cssText;
      return [{
        key: `${mode}:${entry.name}:${index}`,
        name: selectorName,
        ruleCount: 1,
        rules,
        mode,
        cssText,
      } satisfies SelectorsToolEntry];
    }

    return [{
      key: `${mode}:${entry.name}:${index}`,
      name: entry.name,
      ruleCount: rules.length,
      rules,
      mode,
      cssText: entry.cssText,
    } satisfies SelectorsToolEntry];
  })
);
