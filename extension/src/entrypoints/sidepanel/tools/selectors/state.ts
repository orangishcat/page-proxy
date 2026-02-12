import {derived} from 'svelte/store';
import {selectorEntries} from '../code-editor/state';

export type SelectorsToolEntry = {
  name: string;
  ruleCount: number;
  rules: string[];
};

export const selectorEntriesDisplay = derived(selectorEntries, (entries): SelectorsToolEntry[] =>
  entries.map((entry) => {
    const rules = Array.isArray(entry.rules) ? entry.rules : entry.ruleKeys.map((key) => key);

    return {
      name: entry.name,
      ruleCount: rules.length,
      rules,
    };
  })
);
