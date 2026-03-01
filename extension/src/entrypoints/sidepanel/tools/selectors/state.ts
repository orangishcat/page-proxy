import {derived} from 'svelte/store';
import {selectorEntries} from '../code-editor/state';

export type SelectorsToolEntry = {
  key: string;
  name: string;
  ruleCount: number;
  rules: string[];
  mode: "pp-api" | "css";
  cssText?: string;
};

export const selectorEntriesDisplay = derived(selectorEntries, (entries): SelectorsToolEntry[] =>
  entries.map((entry, index) => {
    const rules = Array.isArray(entry.rules) ? entry.rules : entry.ruleKeys.map((key) => key);
    const mode = entry.mode === "css" ? "css" : "pp-api";

    return {
      key: `${mode}:${entry.name}:${index}`,
      name: entry.name,
      ruleCount: rules.length,
      rules,
      mode,
      cssText: entry.cssText,
    };
  })
);
